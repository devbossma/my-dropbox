import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { S3Event } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

export const handler = async (event: S3Event) => {
    const tableName = process.env.TABLE_NAME;
    const userProfileTableName = process.env.USER_PROFILE_TABLE_NAME;

    if (!tableName) throw new Error('TABLE_NAME is not set');

    for (const record of event.Records) {
        const s3 = record.s3;
        const key = decodeURIComponent(s3.object.key.replace(/\+/g, " "));
        const size = s3.object.size || 0;
        const bucket = s3.bucket.name;

        const parts = key.split('/');
        const fileName = parts.pop() || key;
        const folderPath = parts.join('/');

        const isRoot = parts.length === 2 && parts[0] === 'user-files';
        let folderId = isRoot ? 'root' : undefined;
        let mimeType = 'unknown';

        let owner = 'unknown';
        try {
            const headData = await s3Client.send(new HeadObjectCommand({
                Bucket: bucket,
                Key: key
            }));

            if (headData.Metadata) {
                owner = headData.Metadata.owner || 'unknown';
                folderId = headData.Metadata.folderid || folderId;
                mimeType = headData.Metadata.mimetype || 'unknown';

                if (headData.Metadata['skip-db-trigger'] === 'true') {
                    console.log(`Skipping DB trigger for ${key}`);
                    continue;
                }
            }
        } catch (err) {
            console.error('Error fetching S3 metadata:', err);
        }

        if (record.eventName.startsWith('ObjectCreated')) {
            // Check for existing version - SIMPLE LOOKUP using s3Key as ID
            let version = 1;
            let previousFileSize = 0;
            let existingCreatedAt: string | undefined;

            try {
                const existingItem = await docClient.send(new GetCommand({
                    TableName: tableName,
                    Key: { id: key }  // id = s3Key (original working model)
                }));

                if (existingItem.Item) {
                    version = (existingItem.Item.version || 0) + 1;
                    previousFileSize = existingItem.Item.fileSize || 0;
                    existingCreatedAt = existingItem.Item.createdAt;
                    console.log(`File exists. Incrementing version from ${existingItem.Item.version} to ${version}`);
                }
            } catch (err) {
                console.log("Error checking existing item, assuming version 1", err);
            }

            await docClient.send(new PutCommand({
                TableName: tableName,
                Item: {
                    id: key,  // id = s3Key (simple and reliable)
                    fileName: fileName,
                    fileSize: size,
                    s3Key: key,
                    mimeType: mimeType,
                    folderPath: folderPath,
                    folderId: folderId,
                    lastModified: Date.now(),
                    createdAt: existingCreatedAt || new Date().toISOString(),  // Preserve original createdAt
                    updatedAt: new Date().toISOString(),
                    owner: owner,
                    isDeleted: false,
                    version: version
                }
            }));

            // Update UserProfile storage usage
            if (userProfileTableName && owner !== 'unknown') {
                try {
                    const sizeDelta = size - previousFileSize;
                    if (sizeDelta !== 0) {
                        const scanResult = await docClient.send(new ScanCommand({
                            TableName: userProfileTableName,
                            FilterExpression: '#owner = :ownerVal',
                            ExpressionAttributeNames: { '#owner': 'owner' },
                            ExpressionAttributeValues: { ':ownerVal': owner }
                        }));

                        if (scanResult.Items && scanResult.Items.length > 0) {
                            const profileId = scanResult.Items[0].id;
                            await docClient.send(new UpdateCommand({
                                TableName: userProfileTableName,
                                Key: { id: profileId },
                                UpdateExpression: 'SET storageUsed = if_not_exists(storageUsed, :zero) + :delta, updatedAt = :now',
                                ExpressionAttributeValues: {
                                    ':delta': sizeDelta,
                                    ':zero': 0,
                                    ':now': new Date().toISOString()
                                }
                            }));
                            console.log(`Updated storage usage for ${owner}: +${sizeDelta} bytes`);
                        }
                    }
                } catch (err) {
                    console.error('Error updating storage usage:', err);
                }
            }
        }
    }
};