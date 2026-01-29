import { generateClient } from 'aws-amplify/data';
import { copy, remove } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

/**
 * Recursively deletes a folder and all its contents.
 * Relies on DynamoDB Stream triggers to handle S3 object deletion and storage usage updates.
 */
export async function deleteFolderRecursively(folderId: string): Promise<void> {
    // 1. Get contents
    const { data: files } = await client.models.FileMetadata.list({
        filter: { folderId: { eq: folderId } }
    });
    const { data: subFolders } = await client.models.Folder.list({
        filter: { parentFolderId: { eq: folderId } }
    });

    // 2. Delete all files in this folder
    // Triggers will handle S3 delete and storage usage decrement
    for (const file of files) {
        if (!file.isDeleted) {
            await client.models.FileMetadata.delete({ id: file.id });
        }
    }

    // 3. Recurse for subfolders
    for (const subFolder of subFolders) {
        await deleteFolderRecursively(subFolder.id);
        // After emptying subfolder, delete it
        await client.models.Folder.delete({ id: subFolder.id });
    }
}

/**
 * Recursively renames a folder, which involves:
 * 1. Updating the folder's name and path.
 * 2. Recursively updating all subfolders' paths.
 * 3. Moving all contained files in S3 to new keys and updating their metadata.
 */
export async function renameFolderRecursively(
    folderId: string,
    oldFolderPath: string, // e.g., "A/B"
    newFolderPath: string, // e.g., "A/C"
    identityId: string
): Promise<void> {

    // 1. Get contents
    const { data: files } = await client.models.FileMetadata.list({
        filter: { folderId: { eq: folderId } }
    });
    const { data: subFolders } = await client.models.Folder.list({
        filter: { parentFolderId: { eq: folderId } }
    });

    // 2. Move files (S3 Move + DB Update)
    // path structure: user-files/{identityId}/{folderPath}/{fileName}
    // file.s3Key is the full key.

    for (const file of files) {
        if (file.isDeleted) continue;

        // Construct new S3 Key
        // Old Key: user-files/{identityId}/{oldFolderPath}/{fileName}
        // New Key: user-files/{identityId}/{newFolderPath}/{fileName}
        // Be careful with slashes

        // We can just replace the prefix in the s3key if we are sure
        // But let's be robust.

        const oldKey = file.s3Key;
        const newKey = oldKey.replace(
            `/${oldFolderPath}/`,
            `/${newFolderPath}/`
        );

        if (oldKey === newKey) continue; // Should not happen if paths differ

        try {
            // S3 Copy
            await copy({
                source: { path: oldKey },
                destination: { path: newKey }
            });

            // S3 Delete Old
            await remove({ path: oldKey });

            // DB Update
            await client.models.FileMetadata.update({
                id: file.id,
                s3Key: newKey,
                folderPath: newFolderPath
            });
        } catch (err) {
            console.error(`Failed to move file ${file.fileName}`, err);
            // Attempt to continue? Or throw?
            throw err;
        }
    }

    // 3. Recurse Subfolders
    for (const subFolder of subFolders) {
        // Calculate new path for subfolder
        // Old sub path: {oldFolderPath}/{subName}
        // New sub path: {newFolderPath}/{subName}

        // Check if path relies on name? Yes.

        // Note: subFolder.path is full logic path e.g. "Root/Parent/Child" or just "Parent/Child"?
        // In FileManager.tsx: path: currentFolder ? `${currentFolder.path}/${name}` : name
        // So it is relative to root? No, it's cumulative.

        // Let's derive it precisely.
        // We know subFolder.path MUST start with oldFolderPath

        const oldSubPath = subFolder.path;
        const newSubPath = oldSubPath.replace(oldFolderPath, newFolderPath);

        // Update Subfolder DB
        await client.models.Folder.update({
            id: subFolder.id,
            path: newSubPath
        });

        // Recurse
        await renameFolderRecursively(subFolder.id, oldSubPath, newSubPath, identityId);
    }
}
