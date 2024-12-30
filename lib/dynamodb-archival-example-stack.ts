import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FilterCriteria, FilterRule, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { AttributeType, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { AnyPrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { DynamoEventSource, KinesisEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Stream } from 'aws-cdk-lib/aws-kinesis';
import * as path from 'node:path';

export class DynamodbArchivalExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambda = new NodejsFunction(this, 'WriteLambda', {
      entry: path.join(__dirname, '../lambda/write', 'handler.ts'), // the path to the TypeScript file
      functionName: 'WriteLambda',
      handler: 'index.handler',
      bundling: {
        minify: true, // enables code minification
        sourceMap: true, // includes source map for easier debugging
        target: 'es2020', // specify the ECMAScript version target
        externalModules: ['aws-sdk'], // modules to exclude from bundling (they are available in Lambda runtime)
        // add any additional bundling options as needed
      },
    });

    const table = new Table(this, 'DynamoTable', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      tableName: 'dynamodb-archival-poc',
      timeToLiveAttribute: 'expirationTime',
      removalPolicy: RemovalPolicy.DESTROY,
      deletionProtection: false,
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // streaming stuff

    // Create the Kinesis stream
    const kinesisStream = new Stream(this, 'MyKinesisStream');

    // Create the S3 bucket to store the records
    const s3Bucket = new Bucket(this, 'ArchiveBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      bucketName: `archival-poc-${this.account}`,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create the Lambda function to process and write the records to S3
    const streamingLambda = new NodejsFunction(this, 'StreamingLambda', {
      entry: path.join(__dirname, '../lambda/streaming', 'handler.ts'), // the path to the TypeScript file
      environment: {
        BUCKET_NAME: s3Bucket.bucketName,
      },
      bundling: {
        minify: true, // enables code minification
        sourceMap: true, // includes source map for easier debugging
        target: 'es2020', // specify the ECMAScript version target
        externalModules: ['aws-sdk'], // modules to exclude from bundling (they are available in Lambda runtime)
        // add any additional bundling options as needed
      },
      functionName: 'StreamingLambda',
      handler: 'index.handler',
    });

    // Configure the DynamoDB stream as the event source for the Lambda function
    streamingLambda.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: StartingPosition.LATEST,
        filters: [
          FilterCriteria.filter({
            eventName: FilterRule.isEqual('REMOVE'),
            userIdentity: {
              type: FilterRule.isEqual('Service'),
              principalId: FilterRule.isEqual('dynamodb.amazonaws.com'),
            },
          }),
        ],
      }),
    );

    // Create a Kinesis event source for the Lambda function to process the Kinesis stream records
    streamingLambda.addEventSource(
      new KinesisEventSource(kinesisStream, {
        batchSize: 100,
        startingPosition: StartingPosition.TRIM_HORIZON,
      }),
    );

    // Grant necessary permissions to the Lambda function and Kinesis stream
    kinesisStream.grantWrite(streamingLambda);
    s3Bucket.grantWrite(streamingLambda);
    s3Bucket.grantPut(streamingLambda);
    table.grantStreamRead(streamingLambda);
    table.grantWriteData(lambda);

    s3Bucket.addToResourcePolicy(
      new PolicyStatement({
        resources: [s3Bucket.arnForObjects('*'), s3Bucket.bucketArn],
        actions: ['s3:PutObject'],

        principals: [new AnyPrincipal()],
        conditions: {
          StringLike: {
            'aws:PrincipalArn': [
              streamingLambda.role?.roleArn,
            ],
          },
        },
      }),
    );
  }
}
