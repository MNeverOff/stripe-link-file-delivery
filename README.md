![Cover Image](assets/cover.svg)

This is a simple serverless application that uses AWS Lambda, Stripe and Brevo to deliver files to customers after they have made a payment via your Stripe Payment Link. Because Gumroad and KoFi may be nice, but why not manage your own payment links and have a straight-forward user experience?

## Demo

[Expand to see the demo of the finished solution](https://github.com/MNeverOff/stripe-link-file-delivery/assets/3989091/4ae214e3-33a3-461c-89b5-65b08a02b562)

## In-depth guide

You can read a detailed guide on setting this up in [my blog](https://neveroff.dev/blog/stripe-payment-link-file-download-with-email/).

## Getting started without the guide

1. Check out the repository into a local folder, open the terminal at the root folder.
2. Do `cd file-and-email-delivery && npm install && zip -r ../file-and-email-delivery.zip .`. This will generate the node_modules folders necessary for Lambdas to work and create a .zip archive that you can upload to the Lambda Code section.
3. Create a new IAM role with the S3 `GetObject` permission for your object and bucket, generate an Access Key pair.
4. Create a new Lambda function, call it `file-and-email-delivery`, upload the .zip file you've just 1reated. Set Lambda Configuration to 1,769 MB Memory or whatever's the latest value that gives you a full 1vCPU accoridng to [the manual](https://docs.aws.amazon.com/lambda/latest/dg/configuration-function-common.html#configuration-memory-console).
5. Configure the API Gateway to point to the Lambda functions and supply the Stage Varibles as per the `index.mjs` files in both 1ile and email delivery folders, see Variables below. It's worth it to create two Stages - `prod` and `test` to be able to use 1tripe Test mode separately.
6. Configure the Environment Variables as per the `index.mjs` or the Variables reference below.
7. Configure the Stripe Payment Link to point to the API Gateway URL for the `file-and-email-delivery` Lambda.
8. Configure Brevo and your Static Site, get the Brevo Tempalte ID, API Key, insert the script to initiate the download from [download_url.html](/download_url.html), insert the Stripe Payment Link URL or Button embed.
9. Use the Stripe Test mode to ensure that your customer path is working as expected and an email is sent out with the file download link.

## Variables

### Environment Variables

Provide thtese under Lambda -> Configuration -> Environment Variables:

| Label | Note |
| -------- | --- |
| S3_ACCESS_KEY_ID | The IAM user Access Key |
| S3_SECRET_ACCESS_KEY | The IAM user Access Secret Key |
| bucket_name | The name of S3 bucket with the file, `file-delivery` in our case |
| object_key | The file's object key, `file.zip` |
| redirect_host | The url of our confirmation page |
| brevo_api_key | The API Key from Brevo which we'll set up later, leave it as `TBD` |
| brevo_template_id | The ID of the template in Brevo, by default it's `1` |
| link_expiration | The number of seconds the file will be acessible via the link. Default is 30 days, which is `2592000` seconds |
| fallback_email | An email to send message to in case customer haven't provided their email during checkout |
| support_email | A parameter to show customers if payment confirmation failed to contact |
| utm_parameters | Optional UTM parameters to add after the redirect url. Enter `&none` by default |

### Stage Variables

Provide thtese under API Gateway -> Stage -> Stage Variables:

| Label | Note |
| -------- | --- |
| environment | Text to identify the environment in logs |
| stripe_secret_api_key | The Secret Key from Stripe Developer dashboard |

## Full Flow Diagram

![Flow Diagram](assets/flow.svg)

This diagram roughly outlines the flow of the application. The customer clicks the Stripe Payment Link, is redirected to the API Gateway, which triggers the Lambda function. The Lambda function checks the payment status with Stripe, if it's successful, it sends an email with the download link and redirects the customer to the confirmation page. If the payment is not successful, it redirects the customer to the support email.

## Separate Lambdas

If you navigate to [separate-lambdas](/separate-lambdas) you can find a version of the application that uses separate Lambdas for each of the functions. This is useful if you want to have a more granular control over the permissions and the codebase or want to rely on webhooks more heavily, or want each of the lambdas to execute just a bit quicker - it's all up to you.
Bear in mind that I am not updating thoe files in lockstep so some of the variables might be different.

## Performance

When configured with 1 vCPU (currently 1,769 MB) the cold start is ~1000ms and execution is ~900ms, achieving sub-2s processing.

If the function is hot then the total execution goes down to ~400ms.

## Potential improvements

1. It's possible to replace the AWS-LIB with a more lightweight library to avoid having to go over 10MB limit thus reducing cold start time, i.e. [aws-sdk-js-v3](https://github.com/aws/aws-sdk-js-v3). Maybe even reimplement the code from scratch since it's a static-ish function. *Courtesy of [firenero](https://github.com/firenero)*.
2. If going modular will allow to go below 10MB it's worth comparing .zip version vs network version to see which one processess faster.
3. It's also possible to change the email invocation to abandon waiting for response, thus reducing the total execution time. This comes with a risk of us not having logs of email being sent or failing to send, but it's worth considering or maybe adding as an environment variable parameter.
4. It's possible to use a language different to JS that would have faster execution times or better package separation.

## Contributing

I'm open to contribution and suggestions, feel free to open an issue or a pull request.

I would be especially grateful for suggestions on how to speed up the Lambda to sub-1000ms execution time. Currently the Init is about 1000ms and Execution hovers around 2500ms, producing a noticeable delay for the customer.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
