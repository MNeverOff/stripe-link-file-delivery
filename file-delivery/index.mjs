import Stripe from 'stripe';
import AWS from 'aws-sdk';

const s3 = new AWS.S3();

export const handler = async (event) => {
    const stripe = new Stripe(event.stageVariables.stripe_secret_api_key);
    const sessionId = event.queryStringParameters.sessionId;

    let chargeSucceeded = false;

    for (let i = 0; i < 10; i++) {
        try {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status === 'paid') {
                chargeSucceeded = true;
                break;
            }
        } catch (error) {
            console.error(`Failed to retrieve session: ${error.message}. Environment: ${event.stageVariables.environment}.`);
            return {
                statusCode: 400,
                body: `Failed to retrieve session: ${error.message}. Environment: ${event.stageVariables.environment}.`
            };
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (chargeSucceeded) {
        const params = {
            Bucket: process.env.bucket_name,
            Key: process.env.object_key,
            Expires: 60 * 60 * 24 * 30 // 30 days
        };
        const presignedUrl = s3.getSignedUrl('getObject', params);
        const redirectUrl = `${process.env.redirect_host}${encodeURIComponent(presignedUrl)}${process.env.utm_parameters}`;

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
            body: `Charge did not succeed for session id ${sessionId}. Environment: ${event.stageVariables.environment}.`
        };
    }
};