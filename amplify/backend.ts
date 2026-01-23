import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { s3Trigger } from './functions/s3-trigger/resource';
import { dynamoTrigger } from './functions/dynamo-trigger/resource';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Function as LambdaFunction, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

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

// 1. Trigger S3 -> Lambda -> DynamoDB
const s3TriggerLambda = backend.s3Trigger.resources.lambda as LambdaFunction;
s3TriggerLambda.addEnvironment('TABLE_NAME', fileMetadataTable.tableName);
fileMetadataTable.grantWriteData(s3TriggerLambda);
s3Bucket.grantRead(s3TriggerLambda); // Required for HeadObject to get metadata

s3Bucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(s3TriggerLambda)
);

// --- DynamoDB Trigger Configuration ---
// 2. Trigger DynamoDB -> Lambda -> S3
const dynamoTriggerLambda = backend.dynamoTrigger.resources.lambda as LambdaFunction;
dynamoTriggerLambda.addEnvironment('BUCKET_NAME', s3Bucket.bucketName);
dynamoTriggerLambda.addEnvironment('TABLE_NAME', fileMetadataTable.tableName); // Add Table Name
s3Bucket.grantReadWrite(dynamoTriggerLambda);
s3Bucket.grantDelete(dynamoTriggerLambda);
fileMetadataTable.grantWriteData(dynamoTriggerLambda); // Grant Write Access

// Enable Streams on the table via DynamoEventSource
dynamoTriggerLambda.addEventSource(new DynamoEventSource(fileMetadataTable, {
  startingPosition: StartingPosition.LATEST,
}));