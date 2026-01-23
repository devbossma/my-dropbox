import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBStreamEvent } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const s3Client = new S3Client({});

export const handler = async (event: DynamoDBStreamEvent) => {
    console.log('Processed DynamoDB Stream Event:', JSON.stringify(event, null, 2));
    const bucketName = process.env.BUCKET_NAME;

    if (!bucketName) {
        throw new Error('BUCKET_NAME is not set');
    }

    for (const record of event.Records) {
        if (record.eventName === 'REMOVE') {
            // Handle Deletion
            const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage as any) : null;
            if (oldImage && oldImage.s3Key) {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: oldImage.s3Key
                }));
                console.log(`Deleted file: ${oldImage.s3Key}`);
            }
        } else if (record.eventName === 'MODIFY') {
            // Handle Rename (Check if s3Key changed)
            const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage as any) : null;
            const newImage = record.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage as any) : null;

            if (oldImage && newImage && oldImage.s3Key !== newImage.s3Key) {
                console.log(`Renaming file from ${oldImage.s3Key} to ${newImage.s3Key}`);

                // Copy Object
                await s3Client.send(new CopyObjectCommand({
                    Bucket: bucketName,
                    CopySource: `${bucketName}/${encodeURIComponent(oldImage.s3Key)}`,
                    Key: newImage.s3Key
                }));

                // Delete Old Object
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: oldImage.s3Key
                }));
            }
        }
    }
};
