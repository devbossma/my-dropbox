import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { S3Event } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

export const handler = async (event: S3Event) => {
    console.log('Processed S3 Event:', JSON.stringify(event, null, 2));
    const tableName = process.env.TABLE_NAME;

    if (!tableName) {
        throw new Error('TABLE_NAME is not set');
    }

    for (const record of event.Records) {
        const s3 = record.s3;
        const key = decodeURIComponent(s3.object.key.replace(/\+/g, " "));
        const size = s3.object.size;
        const bucket = s3.bucket.name;

        const parts = key.split('/');
        const fileName = parts.pop() || key;
        const folderPath = parts.join('/');

        // Determine folderId (Initial Logic / Fallback)
        const isRoot = parts.length === 2 && parts[0] === 'user-files';
        let folderId = isRoot ? 'root' : undefined;
        let mimeType = 'unknown';

        // Fetch Metadata to get Owner and FolderID
        let owner = 'unknown';
        try {
            const headData = await s3Client.send(new HeadObjectCommand({
                Bucket: bucket,
                Key: key
            }));

            // Check Owner
            if (headData.Metadata && headData.Metadata.owner) {
                owner = headData.Metadata.owner;
                console.log(`Found owner in metadata: ${owner}`);
            }

            // Check FolderID
            // Note: S3 metadata keys are lowercase
            if (headData.Metadata && headData.Metadata.folderid) {
                folderId = headData.Metadata.folderid;
                console.log(`Found folderid in metadata: ${folderId}`);
            }
            
            if (headData.Metadata && headData.Metadata.mimetype) {
                mimeType = headData.Metadata.mimetype;
                console.log(`Found mimetype in metadata: ${mimeType}`);
            }
        } catch (err) {
            console.error('Error fetching S3 metadata:', err);
        }

        // Handle ObjectCreated
        if (record.eventName.startsWith('ObjectCreated')) {
            // Check for existing version
            let version = 1;
            try {
                const existingItem = await docClient.send(new GetCommand({
                    TableName: tableName,
                    Key: { id: key }
                }));

                if (existingItem.Item && existingItem.Item.version) {
                    version = existingItem.Item.version + 1;
                    console.log(`File exists. Incrementing version from ${existingItem.Item.version} to ${version}`);
                }
            } catch (err) {
                console.log("Error checking existing item, assuming version 1", err);
            }

            await docClient.send(new PutCommand({
                TableName: tableName,
                Item: {
                    id: key,
                    fileName: fileName,
                    fileSize: size,
                    s3Key: key,
                    mimeType: mimeType,
                    folderPath: folderPath,
                    folderId: folderId,
                    lastModified: Date.now(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    owner: owner,
                    isDeleted: false,
                    version: version
                }
            }));
        }
    }
};
