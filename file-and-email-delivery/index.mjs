import Axios from 'axios';
import Stripe from 'stripe';
import AWS from 'aws-sdk';

// Specifying the IAM User with S3 access to generate long-lived Signed URLs
const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
});

export const handler = async (event) => {
    const stripe = new Stripe(event.stageVariables.stripe_secret_api_key);
    const sessionId = event.queryStringParameters.sessionId;

    let chargeSucceeded = false;

    // A crude way to check if the charge has succeeded, retrying 20 times with a 250ms delay - so giving it 5 seconds to succeed
    // TODO: Improve. Add a redirect to "payment exception" page with contact for support.
    for (let i = 0; i < 20; i++) {
        try {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status === 'paid') {
                chargeSucceeded = true;
                console.log(`Charge succeeded for session id ${sessionId} after ${i+1} attempts. Environment: ${event.stageVariables.environment}.`);
                break;
            }
        } catch (error) {
            console.error(`Failed to retrieve session: ${error.message} after ${i+1} attempts. Environment: ${event.stageVariables.environment}.`);
            return {
                statusCode: 400,
                body: `Payment exception. Contact ${process.env.support_email}.<br/>Error Details: Failed to retrieve session: ${error.message} after ${i+1} attempts. Environment: ${event.stageVariables.environment}.`
            };
        }
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (chargeSucceeded) {
        recipientEmail = session.customer_details.email;

        if (!recipientEmail) {
            recipientEmail = process.env.fallback_email;
        }

        const params = {
            Bucket: process.env.bucket_name,
            Key: process.env.object_key,
            Expires: process.env.link_expiration
        };
        const presignedUrl = s3.getSignedUrl('getObject', params);
        const redirectUrl = `${process.env.redirect_host}${encodeURIComponent(presignedUrl)}${process.env.utm_parameters}`;

        const emailBody = {
            templateId: process.env.brevo_template_id,
            to: [{ email: recipientEmail }],
            params: { download_url: redirectUrl }
        };

        try {
            await Axios.post('https://api.sendinblue.com/v3/smtp/email', emailBody, {
                headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': event.stageVariables.brevo_api_key
                }
            });

            console.log(`Email sent for session id ${session.id}`);
        } catch (err) {
            console.log(`Failed to send email for session id ${session.id}`, err);
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
        console.log(`Charge did not succeed for session id ${sessionId}. Environment: ${event.stageVariables.environment}.`);
        return {
            statusCode: 400,
            body: `Payment exception. Contact ${process.env.support_email}.<br/>Error Details: Charge did not succeed for session id ${sessionId}. Environment: ${event.stageVariables.environment}.`
        };
    }
};