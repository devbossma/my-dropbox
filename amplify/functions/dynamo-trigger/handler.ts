import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';
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
            // Handle Deletion
            const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage as any) : null;
            if (oldImage && oldImage.s3Key) {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: oldImage.s3Key
                }));
                console.log(`Deleted file: ${oldImage.s3Key}`);

                // Decrement UserProfile storage usage
                if (userProfileTableName && oldImage.owner && oldImage.fileSize) {
                    try {
                        // Scan for user profile with matching owner
                        const scanResult = await docClient.send(new ScanCommand({
                            TableName: userProfileTableName,
                            FilterExpression: '#owner = :ownerVal',
                            ExpressionAttributeNames: { '#owner': 'owner' },
                            ExpressionAttributeValues: { ':ownerVal': oldImage.owner }
                        }));

                        if (scanResult.Items && scanResult.Items.length > 0) {
                            const profile = scanResult.Items[0];
                            const currentUsage = profile.storageUsed || 0;
                            const newUsage = Math.max(0, currentUsage - oldImage.fileSize);

                            // Update storageUsed (ensure non-negative)
                            await docClient.send(new UpdateCommand({
                                TableName: userProfileTableName,
                                Key: { id: profile.id },
                                UpdateExpression: 'SET storageUsed = :newUsage, updatedAt = :now',
                                ExpressionAttributeValues: {
                                    ':newUsage': newUsage,
                                    ':now': new Date().toISOString()
                                }
                            }));
                            console.log(`Updated storage usage for ${oldImage.owner}: -${oldImage.fileSize} bytes (now: ${newUsage})`);
                        } else {
                            console.log(`No UserProfile found for owner: ${oldImage.owner}`);
                        }
                    } catch (err) {
                        console.error('Error updating storage usage:', err);
                    }
                }
            }
        } else if (record.eventName === 'MODIFY') {
            const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage as any) : null;
            const newImage = record.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage as any) : null;

            if (!oldImage || !newImage) continue;

            const isRename = oldImage.fileName !== newImage.fileName;
            const isMove = oldImage.s3Key !== newImage.s3Key;

            if (isRename || isMove) {
                console.log(`Rename/Move detected. Migration start: ${oldImage.s3Key} -> (new name)`);

                // Calculate new Key
                const folderPath = newImage.folderPath || '';
                const newS3Key = folderPath ? `${folderPath}/${newImage.fileName}` : newImage.fileName;

                // If the Key hasn't effectively changed (e.g. false alarm), skip
                if (newS3Key === oldImage.s3Key && !isMove) {
                    console.log("No effective key change, skipping.");
                    continue;
                }

                console.log(`Migrating from ${oldImage.s3Key} to ${newS3Key}`);

                try {
                    // 1. Copy Object in S3 (Preserves Metadata by default)
                    await s3Client.send(new CopyObjectCommand({
                        Bucket: bucketName,
                        CopySource: `${bucketName}/${encodeURIComponent(oldImage.s3Key)}`,
                        Key: newS3Key
                    }));
                    console.log("S3 Copy done.");

                    // 2. Delete Old Object in S3
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: bucketName,
                        Key: oldImage.s3Key
                    }));
                    console.log("S3 Delete Old done.");

                    // 3. Delete Old Record in DynamoDB
                    if (tableName) {
                        await docClient.send(new DeleteCommand({
                            TableName: tableName,
                            Key: { id: oldImage.id }
                        }));
                        console.log("DB Delete Old done.");
                    }

                } catch (err) {
                    console.error("Migration failed:", err);
                }
            }
        }
    }
};
