import { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, type AttributeValue } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, ScanCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBStreamEvent } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

export const handler = async (event: DynamoDBStreamEvent) => {
    console.log('Processed DynamoDB Stream Event:', JSON.stringify(event, null, 2));
    const bucketName = process.env.BUCKET_NAME;
    const tableName = process.env.TABLE_NAME;
    const userProfileTableName = process.env.USER_PROFILE_TABLE_NAME;

    if (!bucketName) throw new Error('BUCKET_NAME is not set');

    for (const record of event.Records) {
        if (record.eventName === 'REMOVE') {
            const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage as unknown as Record<string, AttributeValue>) : null;
            if (oldImage && oldImage.s3Key) {
                // Delete S3 object
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: oldImage.s3Key
                }));
                console.log(`Deleted file: ${oldImage.s3Key}`);

                // Decrement storage usage
                if (userProfileTableName && oldImage.owner && oldImage.fileSize) {
                    try {
                        const scanResult = await docClient.send(new ScanCommand({
                            TableName: userProfileTableName,
                            FilterExpression: '#owner = :ownerVal',
                            ExpressionAttributeNames: { '#owner': 'owner' },
                            ExpressionAttributeValues: { ':ownerVal': oldImage.owner }
                        }));
                        if (scanResult.Items && scanResult.Items.length > 0) {
                            const profile = scanResult.Items[0];
                            const newUsage = Math.max(0, (profile.storageUsed || 0) - oldImage.fileSize);
                            await docClient.send(new UpdateCommand({
                                TableName: userProfileTableName,
                                Key: { id: profile.id },
                                UpdateExpression: 'SET storageUsed = :newUsage, updatedAt = :now',
                                ExpressionAttributeValues: {
                                    ':newUsage': newUsage,
                                    ':now': new Date().toISOString()
                                }
                            }));
                        }
                    } catch (err) {
                        console.error('Error updating storage usage:', err);
                    }
                }
            }
        } else if (record.eventName === 'MODIFY') {
            const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage as unknown as Record<string, AttributeValue>) : null;
            const newImage = record.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage as unknown as Record<string, AttributeValue>) : null;

            if (!oldImage || !newImage) continue;

            const isRename = oldImage.fileName !== newImage.fileName;
            const isMove = oldImage.s3Key !== newImage.s3Key;

            if (isRename || isMove) {
                const folderPath = newImage.folderPath || '';
                const newS3Key = folderPath ? `${folderPath}/${newImage.fileName}` : newImage.fileName;

                if (newS3Key === oldImage.s3Key) {
                    console.log("No effective S3 key change needed.");
                    continue;
                }

                console.log(`Renaming/Moving S3 object: ${oldImage.s3Key} -> ${newS3Key}`);

                try {
                    // 1. Get metadata
                    const headData = await s3Client.send(new HeadObjectCommand({
                        Bucket: bucketName,
                        Key: oldImage.s3Key
                    }));

                    // 2. S3 Copy with skip flag
                    await s3Client.send(new CopyObjectCommand({
                        Bucket: bucketName,
                        CopySource: `${bucketName}/${encodeURIComponent(oldImage.s3Key)}`,
                        Key: newS3Key,
                        Metadata: {
                            ...(headData.Metadata || {}),
                            'skip-db-trigger': 'true'
                        },
                        MetadataDirective: 'REPLACE'
                    }));

                    // 3. Delete old S3 object
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: bucketName,
                        Key: oldImage.s3Key
                    }));

                    // 4. Delete old DB record and create new one with new s3Key as ID
                    if (tableName) {
                        await docClient.send(new DeleteCommand({
                            TableName: tableName,
                            Key: { id: oldImage.id }
                        }));

                        await docClient.send(new PutCommand({
                            TableName: tableName,
                            Item: {
                                ...newImage,
                                id: newS3Key,  // NEW ID = new s3Key
                                s3Key: newS3Key,
                                updatedAt: new Date().toISOString()
                            }
                        }));
                        console.log("DB migration complete (delete old + create new)");
                    }

                } catch (err) {
                    console.error("S3 Move failed:", err);
                }
            }
        }
    }
};