// @vitest-environment node
import { handler } from '../../../amplify/functions/s3-trigger/handler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { S3Event } from 'aws-lambda';

// Hoist Mocks
const { s3Mock, docMock } = vi.hoisted(() => {
    return {
        s3Mock: { send: vi.fn<(...args: unknown[]) => unknown>() },
        docMock: { send: vi.fn<(...args: unknown[]) => unknown>() }
    };
});

vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: class {
        send = s3Mock.send;
    },
    HeadObjectCommand: class {
        input: unknown;
        commandName = 'HeadObject';
        constructor(input: unknown) {
            this.input = input;
        }
    },
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: class { },
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(() => docMock),
    },
    PutCommand: class {
        input: unknown;
        commandName = 'Put';
        constructor(input: unknown) {
            this.input = input;
        }
    },
    UpdateCommand: class {
        input: unknown;
        commandName = 'Update';
        constructor(input: unknown) {
            this.input = input;
        }
    },
    GetCommand: class {
        input: unknown;
        commandName = 'Get';
        constructor(input: unknown) {
            this.input = input;
        }
    },
    ScanCommand: class {
        input: unknown;
        commandName = 'Scan';
        constructor(input: unknown) {
            this.input = input;
        }
    },
    QueryCommand: class {
        input: unknown;
        commandName = 'Query';
        constructor(input: unknown) {
            this.input = input;
        }
    },
}));

describe('S3 Trigger Handler (Simple Lookup)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('TABLE_NAME', 'FileMetadata');
        vi.stubEnv('USER_PROFILE_TABLE_NAME', '');

        s3Mock.send.mockResolvedValue({
            Metadata: {
                folderid: 'root',
                owner: 'user1',
                mimetype: 'text/plain'
            },
            ContentLength: 1024
        });

        docMock.send.mockResolvedValue({ Items: [], Item: null });
    });

    it('processes ObjectCreated event and creates new record', async () => {
        const event = {
            Records: [
                {
                    eventName: 'ObjectCreated:Put',
                    s3: {
                        bucket: { name: 'test-bucket' },
                        object: { key: 'user-files/user1/test.txt', size: 1024 }
                    }
                }
            ]
        } as unknown as S3Event;

        await handler(event);

        // Should call Get, then Put (Simple Lookup)
        expect(docMock.send).toHaveBeenCalledTimes(2);
        const firstCallArgs = docMock.send.mock.calls[0][0] as { commandName: string; input: unknown };
        const secondCallArgs = docMock.send.mock.calls[1][0] as { commandName: string; input: unknown };
        expect(firstCallArgs.commandName).toBe('Get');
        expect(secondCallArgs.commandName).toBe('Put');
    });

    it('merges with existing record', async () => {
        const key = 'user-files/user1/test.txt';
        const existingCreatedAt = '2023-01-01T00:00:00Z';

        // Mock GetCommand success
        docMock.send.mockImplementation(async (command: unknown) => {
            const cmd = command as { commandName: string };
            if (cmd.commandName === 'Get') {
                return { Item: { id: key, version: 2, createdAt: existingCreatedAt } };
            }
            return { Items: [] };
        });

        const event = {
            Records: [
                {
                    eventName: 'ObjectCreated:Put',
                    s3: {
                        bucket: { name: 'test-bucket' },
                        object: { key: key, size: 1024 }
                    }
                }
            ]
        } as unknown as S3Event;

        await handler(event);

        expect(docMock.send).toHaveBeenCalledTimes(2); // Get, then Put
        const mergeCall1Args = docMock.send.mock.calls[0][0] as { commandName: string; input: { Item: Record<string, unknown> } };
        const mergeCall2Args = docMock.send.mock.calls[1][0] as { commandName: string; input: { Item: Record<string, unknown> } };
        expect(mergeCall1Args.commandName).toBe('Get');
        expect(mergeCall2Args.commandName).toBe('Put');

        const putItem = mergeCall2Args.input.Item;
        expect(putItem.id).toBe(key);
        expect(putItem.version).toBe(3);
        expect(putItem.createdAt).toBe(existingCreatedAt);
    });
});
