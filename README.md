# DynamoDB Archival Example

This is an example project based on [this AWS blog](https://aws.amazon.com/blogs/database/archive-data-from-amazon-dynamodb-to-amazon-s3-using-ttl-and-amazon-kinesis-integration/ "AWS Blog") that demonstrates how to archive data from Amazon DynamoDB to Amazon S3 using Time to Live (TTL) and Amazon Kinesis Data Streams.

You will need to have Docker running as the Lambda functions require it to build the dependencies.

## Useful commands

* `npm run build`   compile typescript to js
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk synth`   emits the synthesized CloudFormation template
