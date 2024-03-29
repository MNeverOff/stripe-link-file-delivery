import HTTPS from 'https';
import URL from 'url';
import Stripe from 'stripe';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Specifying the IAM User with S3 access to generate long-lived Signed URLs
const s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
});

async function request(url, data, headers, blocking) {
    return new Promise((resolve, reject) => {
        const options = {
            ...URL.parse(url),
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': data.length
            }
        };

        if (blocking) {
            let req = HTTPS.request(options, function (res) {
                let body = ''
                res.on('data', (chunk) => { body += chunk })
                res.on('end', () => { resolve(body) })
            })
            req.write(data)
            req.end()
        } else {
            let req = HTTPS.request(options)
            req.write(data)
            req.end(null, null, () => {
                /* Request has been fully sent */
                resolve(req)
            });
        }
    });
}

export const handler = async (event) => {
    const stripe = new Stripe(event.stageVariables.stripe_secret_api_key);

    if (!event.queryStringParameters) {
        return {
            statusCode: 400,
            body: 'Bad Request: No query parameters supplied.'
        };
    }
    else if (!event.queryStringParameters.session_id) {
        return {
            statusCode: 400,
            body: 'Bad Request: Missing session_id query parameter.'
        };
    }

    const session_id = event.queryStringParameters.session_id;
    let session;
    let chargeSucceeded = false;

    // A crude way to check if the charge has succeeded, retrying 20 times with a 250ms delay - so giving it 5 seconds to succeed
    // TODO: Improve. Add a redirect to "payment exception" page with contact for support.
    for (let i = 0; i < 20; i++) {
        try {
            session = await stripe.checkout.sessions.retrieve(session_id);
            if (session.payment_status === 'paid') {
                chargeSucceeded = true;
                console.log(`Charge succeeded for session id ${session_id} after ${i+1} attempts. Environment: ${event.stageVariables.environment}.`);
                break;
            }
        } catch (error) {
            console.error(`Failed to retrieve session: ${error.message} after ${i+1} attempts. Environment: ${event.stageVariables.environment}.`);
            return {
                statusCode: 400,
                body: `Payment exception. Contact ${process.env.support_email}.\nError Details: Failed to retrieve session: ${error.message} after ${i+1} attempts. Environment: ${event.stageVariables.environment}.`
            };
        }
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (chargeSucceeded) {
        let recipientEmail = session?.customer_details?.email;

        if (!recipientEmail) {
            recipientEmail = process.env.fallback_email;
        }

        const command = new GetObjectCommand({
            Bucket: process.env.bucket_name,
            Key: process.env.object_key
        });
    
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: parseInt(process.env.link_expiration, 10) });
        const redirectUrl = `${process.env.redirect_host}${encodeURIComponent(presignedUrl)}${process.env.utm_parameters}`;

        const emailBody = {
            templateId: parseInt(process.env.brevo_template_id, 10),
            to: [{ email: recipientEmail }],
            params: { download_url: redirectUrl }
        };

        const url = 'https://api.sendinblue.com/v3/smtp/email';
        const data = JSON.stringify(emailBody);
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'api-key': process.env.brevo_api_key
        };

        if (process.env.email_mode === "ensure-delivery") {
            try {
                await request(url, data, headers, true);
                console.log(`Email was sent for session id ${session_id}.`);
            } catch (err) {
                console.log(`Failed to send email for session id ${session_id}.`, err);
            }
        } else {
            await request(url, data, headers, false)
            .then(() => {
                console.log(`Email request was sent for session id ${session_id}.`);
            }).catch(err => {
                console.log(`Failed to send email for session id ${session_id}.`, err);
            });
        }

        console.log(`Redirecting to ${redirectUrl} in environment ${event.stageVariables.environment}.`);

        return {
            statusCode: 302,
            headers: {
                Location: redirectUrl
            },
            body: ''
        };
    } else {
        console.log(`Charge did not succeed for session id ${session_id}. Environment: ${event.stageVariables.environment}.`);
        return {
            statusCode: 400,
            body: `Payment exception. Contact ${process.env.support_email}.\nError Details: Charge did not succeed for session id ${session_id}. Environment: ${event.stageVariables.environment}.`
        };
    }
};