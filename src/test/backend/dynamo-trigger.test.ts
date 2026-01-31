// @vitest-environment node
import { handler } from '../../../amplify/functions/dynamo-trigger/handler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DynamoDBStreamEvent } from 'aws-lambda';


// Hoist Mocks
const { s3Mock, docMock } = vi.hoisted(() => {
    return {
        s3Mock: { send: vi.fn() },
        docMock: { send: vi.fn() }
    };
});

// Mock S3 Client
vi.mock('@aws-sdk/client-s3', () => {
    return {
        S3Client: class {
            send = s3Mock.send;
        },
        CopyObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        HeadObjectCommand: vi.fn(),
    };
});

// Mock DynamoDB Client (Client + DocumentClient)
vi.mock('@aws-sdk/client-dynamodb', () => {
    return {
        DynamoDBClient: class { },
    };
});

vi.mock('@aws-sdk/lib-dynamodb', () => {
    return {
        DynamoDBDocumentClient: {
            from: vi.fn(() => docMock),
        },
        DeleteCommand: vi.fn(),
        PutCommand: vi.fn(),
        ScanCommand: vi.fn(),
        UpdateCommand: vi.fn(),
    };
});

vi.mock('@aws-sdk/util-dynamodb', () => {
    return {
        unmarshall: vi.fn((x) => x) // Simple pass-through for test (assuming test data is already plain JS objects or we mimic unmarshall behavior if needed)
    };
});


describe('DynamoDB Trigger Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('BUCKET_NAME', 'test-bucket');
        vi.stubEnv('TABLE_NAME', 'FileMetadata');
        vi.stubEnv('USER_PROFILE_TABLE_NAME', 'UserProfile');

        // Default S3/DB responses
        s3Mock.send.mockResolvedValue({});
        docMock.send.mockResolvedValue({});
    });

    it('handles REMOVE event (File Deletion)', async () => {
        const event = {
            Records: [
                {
                    eventName: 'REMOVE',
                    dynamodb: {
                        OldImage: {
                            s3Key: 'user-files/user1/test.txt',
                            owner: 'user1',
                            fileSize: 1024,
                            id: 'file-id-1'
                        }
                    }
                }
            ]
        } as unknown as DynamoDBStreamEvent;

        // Mock Scan for UserProfile to find the user
        docMock.send.mockResolvedValueOnce({
            Items: [{ id: 'user-profile-1', storageUsed: 2048 }]
        });
        // Subsequent calls (Update) return success
        docMock.send.mockResolvedValueOnce({});

        await handler(event);
        expect(s3Mock.send).toHaveBeenCalledTimes(1);
        // Scan called?
        expect(docMock.send).toHaveBeenCalledTimes(2); // Scan + Update
    });

    it('handles MODIFY event (File Rename/Move)', async () => {
        const event = {
            Records: [
                {
                    eventName: 'MODIFY',
                    dynamodb: {
                        OldImage: {
                            s3Key: 'user-files/user1/old.txt',
                            fileName: 'old.txt',
                            id: 'user-files/user1/old.txt'
                        },
                        NewImage: {
                            fileName: 'new.txt',
                            folderPath: 'user-files/user1',
                            s3Key: 'user-files/user1/new.txt',
                            id: 'user-files/user1/old.txt' // ID remains old in the MODIFY object usually, but handler calculates newS3Key
                        }
                    }
                }
            ]
        } as unknown as DynamoDBStreamEvent;

        // Mock S3 HeadObject for metadata preservation
        s3Mock.send.mockResolvedValueOnce({
            Metadata: { owner: 'user1', folderid: 'root' }
        });

        await handler(event);

        // 1. S3 Head (to get metadata)
        // 2. S3 Copy (with flag)
        // 3. DB Put (New Record)
        // 4. S3 Delete Old
        // 5. DB Delete Old

        expect(s3Mock.send).toHaveBeenCalledTimes(3); // Head + Copy + DeleteObject
        expect(docMock.send).toHaveBeenCalledTimes(2); // PutCommand (new) + DeleteCommand (old)

        // Check that PutCommand and DeleteCommand were called
        expect(docMock.send).toHaveBeenCalledTimes(2);
    });
});
