![Cover Image](assets/cover.svg)

This is a simple serverless application that uses AWS Lambda, Stripe and Brevo to deliver files to customers after they have made a payment via your Stripe Payment Link.
Because Themeforest, Gumroad and KoFi may be nice, but why not manage your own payment links and have a straight-forward user experience?

## Demo

[Expand to see the demo of the finished solution](https://github.com/MNeverOff/stripe-link-file-delivery/assets/3989091/4ae214e3-33a3-461c-89b5-65b08a02b562)

## In-depth guide

You can read a detailed guide on setting this up in [my blog.](neveroff.dev/blog/download-file-stripe-payment-link/) (under construction).

## Getting started without the guide

1. Check out the repository into a local folder, open the terminal at the root folder.
2. Do `cd email-delivery` followed by `npm install && zip -r ../email-delivery.zip .`  and then `cd ../file-delivery` followed by `npm install && zip -r ../file-delivery.zip .`. This will generate the node_modules folders necessary for Lambdas to work.
3. Go to the AWS Console and create a new Lambda function for each of the zipped folders, using the `index.mjs` as the handler.
4. Configure the API Gateway to point to the Lambda functions and supply the Stage Varibles as per the `index.mjs` files in both file and email delivery folders.
5. Configure the Environment variables as per the `index.mjs` files in both file and email delivery folders.
6. Configure the Stripe Payment Link to point to the API Gateway URL for the `file-delivery` Lambda.
7. Configure a new Stripe Webhook on the `checkout.session.completed` event to point to the API Gateway URL for the `email-delivery` Lambda.
8. Use the Stripe Test mode to ensure that your customer path is working as expected and an email is sent out with the file download link.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.
