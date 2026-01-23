import { defineFunction } from '@aws-amplify/backend';

export const dynamoTrigger = defineFunction({
    name: 'dynamo-trigger-handler',
    entry: './handler.ts',
    timeoutSeconds: 60,
});
