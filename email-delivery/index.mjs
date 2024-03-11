import axios from 'axios';
import stripe from 'stripe';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
});

export const handler = async (event) => {
    const body = event.body;
    const signature = event.headers['Stripe-Signature'];
    const endpointSecret = event.stageVariables.stripe_endpoint_secret_key;

    let stripeEvent;
    let recipientEmail;
    let redirectUrl;

    try {
        stripeEvent = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
            console.log(`Webhook signature verification failed.`, err.message);
        return {
            statusCode: 400,
            body: `Webhook Error: ${err.message}`
        };
    }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;

        if (session.payment_status === 'paid') {
            recipientEmail = session.customer_details.email;

            if (!recipientEmail) {
                recipientEmail = process.env.fallback_email;
            }

            const params = {
                Bucket: process.env.bucket_name,
                Key: process.env.object_key,
                Expires: 60 * 60 * 24 * 30 // 30 days
            };
            const presignedUrl = s3.getSignedUrl('getObject', params);
            redirectUrl = `${process.env.redirect_host}${encodeURIComponent(presignedUrl)}${process.env.utm_parameters}`;

            const emailBody = {
                templateId: 1,
                to: [{ email: recipientEmail }], // use the email from the webhook
                params: { downloadURL: redirectUrl }
            };

            try {
                await axios.post('https://api.sendinblue.com/v3/smtp/email', emailBody, {
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
        }
        else {
            console.log(`Payment status is different from paid: ${session.payment_status}.`);
            return {
                statusCode: 400,
                body: `Received ${stripeEvent.type}, payment status is different from paid: ${session.payment_status}, handled by ${event.stageVariables.environment} env.`
            };
        }

    } else {
        console.log(`Unhandled event type ${stripeEvent.type}.`);
    }

    return {
        statusCode: 200,
        body: `Received ${stripeEvent.type}, sent an email to ${recipientEmail} with a redirect link ${redirectUrl} handled by ${event.stageVariables.environment} env.`
    };
};