import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { s3Trigger } from './functions/s3-trigger/resource';
import { dynamoTrigger } from './functions/dynamo-trigger/resource';
import { EventType, HttpMethods, Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Duration } from 'aws-cdk-lib';
import { SqsDestination } from 'aws-cdk-lib/aws-lambda-destinations';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Function as LambdaFunction, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource, SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';

const backend = defineBackend({
  auth,
  data,
  storage,
  s3Trigger,
  dynamoTrigger,
});

const { cfnUserPool } = backend.auth.resources.cfnResources;
cfnUserPool.usernameAttributes = [];

// --- S3 Trigger Configuration ---
const s3Bucket = backend.storage.resources.bucket;
const fileMetadataTable = backend.data.resources.tables['FileMetadata'];
const userProfileTable = backend.data.resources.tables['UserProfile'];

// --- Dead Letter Queue for Failures ---
const dlq = new Queue(s3Bucket.stack, 'LambdaDLQ', {
  retentionPeriod: Duration.days(14)
});

// 1. Trigger S3 -> Lambda -> DynamoDB
const s3TriggerLambda = backend.s3Trigger.resources.lambda as LambdaFunction;
s3TriggerLambda.addEnvironment('TABLE_NAME', fileMetadataTable.tableName);
s3TriggerLambda.addEnvironment('USER_PROFILE_TABLE_NAME', userProfileTable.tableName);
fileMetadataTable.grantWriteData(s3TriggerLambda);
fileMetadataTable.grantReadData(s3TriggerLambda); // Required for checking existing version
userProfileTable.grantReadWriteData(s3TriggerLambda); // Required for updating storage usage
s3Bucket.grantRead(s3TriggerLambda); // Required for HeadObject to get metadata

s3Bucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(s3TriggerLambda)
);

// Configure Async Retry & DLQ
s3TriggerLambda.configureAsyncInvoke({
  retryAttempts: 2,
  onFailure: new SqsDestination(dlq)
});

// --- DynamoDB Trigger Configuration ---
// 2. Trigger DynamoDB -> Lambda -> S3
const dynamoTriggerLambda = backend.dynamoTrigger.resources.lambda as LambdaFunction;
dynamoTriggerLambda.addEnvironment('BUCKET_NAME', s3Bucket.bucketName);
dynamoTriggerLambda.addEnvironment('TABLE_NAME', fileMetadataTable.tableName); // Add Table Name
dynamoTriggerLambda.addEnvironment('USER_PROFILE_TABLE_NAME', userProfileTable.tableName);
s3Bucket.grantReadWrite(dynamoTriggerLambda);
s3Bucket.grantDelete(dynamoTriggerLambda);
fileMetadataTable.grantWriteData(dynamoTriggerLambda); // Grant Write Access
userProfileTable.grantReadWriteData(dynamoTriggerLambda); // Required for updating storage usage

// Enable Streams on the table via DynamoEventSource
dynamoTriggerLambda.addEventSource(new DynamoEventSource(fileMetadataTable, {
  startingPosition: StartingPosition.LATEST,
  bisectBatchOnError: true,
  retryAttempts: 5,
  onFailure: new SqsDlq(dlq),
}));

// --- CORS Configuration ---
(s3Bucket as Bucket).addCorsRule({
  allowedMethods: [
    HttpMethods.GET,
    HttpMethods.PUT,
    HttpMethods.POST,
    HttpMethods.DELETE,
    HttpMethods.HEAD,
  ],
  allowedOrigins: ['*'], // Allow all domains including localhost
  allowedHeaders: ['*'],
  exposedHeaders: ['ETag'],
});

