const path = require('path');

module.exports = {
  mode: 'production',
  entry: './index.js', // replace with path to your Lambda function's entry point
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2'
  },
  target: 'node',
  externals: {
    '@aws-sdk/s3-request-presigner': '@aws-sdk/s3-request-presigner',
    '@aws-sdk/client-s3': '@aws-sdk/client-s3'
  }
};