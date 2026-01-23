import { defineFunction } from '@aws-amplify/backend';

export const s3Trigger = defineFunction({
    name: 's3-trigger-handler',
    entry: './handler.ts',
    resourceGroupName: 'storage',
    timeoutSeconds: 60,
});
