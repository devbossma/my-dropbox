import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

/**
 * Recalculates the total storage used by summing up all FileMetadata sizes
 * and updates the UserProfile.storageUsed field.
 * Returns the calculated total size in bytes.
 */
export async function syncStorageUsage(): Promise<number> {
    try {
        console.log('Starting storage sync...');

        let allFiles: Array<Schema['FileMetadata']['type']> = [];
        let nextToken: string | null | undefined = undefined;

        // Loop to fetch all pages
        while (true) {
            const response: { data: Array<Schema['FileMetadata']['type']>; nextToken?: string | null } = await client.models.FileMetadata.list({
                nextToken: nextToken ?? undefined,
                limit: 1000,
                filter: {
                    isDeleted: { ne: true } // Only count active files
                }
            });

            allFiles = [...allFiles, ...response.data];
            nextToken = response.nextToken;

            if (!nextToken) break;
        }

        // 2. Sum up sizes
        const totalSize = allFiles.reduce((sum, file) => sum + (file.fileSize || 0), 0);
        console.log(`Calculated total size from ${allFiles.length} files: ${totalSize} bytes`);

        // 3. Update UserProfile
        const { data: profiles } = await client.models.UserProfile.list();
        if (profiles.length > 0) {
            const profile = profiles[0];
            if (profile.storageUsed !== totalSize) {
                console.log(`Updating profile storageUsed from ${profile.storageUsed} to ${totalSize}`);
                await client.models.UserProfile.update({
                    id: profile.id,
                    storageUsed: totalSize
                });
            } else {
                console.log('Profile storage usage is already correct.');
            }
        }

        return totalSize;
    } catch (error) {
        console.error('Failed to sync storage usage:', error);
        throw error;
    }
}
