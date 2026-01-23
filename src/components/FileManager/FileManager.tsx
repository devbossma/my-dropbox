import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getUrl, remove } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../amplify/data/resource';
import FileExplorer from '../FileExplorer/FileExplorer';
import FileUploader from '../FileUploader/FileUploader';
import { FolderPlus, Home, ChevronRight } from 'lucide-react';
import './FileManager.css';

const client = generateClient<Schema>();

type Folder = Schema['Folder']['type'];
type FileMetadata = Schema['FileMetadata']['type'];

export default function FileManager() {
    const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<Folder[]>([]);
    const [files, setFiles] = useState<FileMetadata[]>([]);
    const [subFolders, setSubFolders] = useState<Folder[]>([]);
    const [identityId, setIdentityId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Get Identity ID for S3 paths
    useEffect(() => {
        fetchAuthSession().then(session => {
            if (session.identityId) {
                setIdentityId(session.identityId);
            }
        });
    }, []);

    // Subscribe to data
    useEffect(() => {
        if (!identityId) return;

        setLoading(true);
        const folderId = currentFolder ? currentFolder.id : null;

        // Sub to Folders
        // Note: Filtering by parentFolderId might need an index if using 'list'. 
        // observeQuery handles local filtering mostly or needs GSI. 
        // For MVP, we list all and filter? Or assume parentFolderId is filterable?
        // Generically 'list' returns all. We should filter.
        // Ideally we add a secondary index on parentFolderId.
        // For now, let's assume observeQuery works fine.

        // Using filter in observeQuery:
        const folderSub = client.models.Folder.observeQuery({
            filter: {
                parentFolderId: { eq: folderId ?? 'root' } // Use 'root' for top level if we store it as 'root' or use a check? 
                // In schema, parentFolderId is a.id() which makes it optional? 
                // If it's optional, we filter by attributeExists: false?
                // Amplify Gen 2 filter for null: { attributeExists: false }? Or { eq: null }?
            }
        }).subscribe({
            next: ({ items }) => {
                // Filter manually if needed, but the filter above should work if parentFolderId is stored reliably.
                // If top level folders have no parentFolderId, we need to handle that.
                // Let's assume top level folders have parentFolderId = 'root' for simplicity in this implementation logic
                // providing we modify createFolder to enforce it.
                setSubFolders(items);
            },
            error: (err) => console.error('Folder sub error', err)
        });

        const fileSub = client.models.FileMetadata.observeQuery({
            filter: {
                folderId: { eq: folderId ?? 'root' }
            }
        }).subscribe({
            next: ({ items }) => {
                // Filter out deleted files if we used soft delete
                const activeFiles = items.filter(f => !f.isDeleted);
                setFiles(activeFiles);
                setLoading(false);
                console.log("Filtered Files in current folder:", activeFiles);
            },
            error: (err) => console.error('File sub error', err)
        });

        // DEBUG: List ALL files to check if they exist but are hidden by filter
        const debugSub = client.models.FileMetadata.observeQuery().subscribe({
            next: ({ items }) => console.log('DEBUG: ALL FILES IN DB:', items),
            error: (e) => console.log('DEBUG Error:', e)
        });

        return () => {
            folderSub.unsubscribe();
            fileSub.unsubscribe();
            debugSub.unsubscribe();
        };
    }, [currentFolder, identityId]);

    const handleCreateFolder = async () => {
        const name = prompt("Enter folder name:");
        if (!name) return;

        await client.models.Folder.create({
            name,
            parentFolderId: currentFolder ? currentFolder.id : 'root',
            path: currentFolder ? `${currentFolder.path}/${name}` : name,
        });
    };

    const handleDeleteFile = async (id: string, key: string) => {
        if (!confirm("Are you sure you want to delete this file?")) return;

        // We update metadata to isDeleted=true OR delete the record?
        // Trigger is on REMOVE. So we should delete the record.
        await client.models.FileMetadata.delete({ id });

        // The trigger will handle S3 deletion.
        // Optimistic UI update handled by subscription.
    };

    const handleDownload = async (key: string) => {
        try {
            const link = await getUrl({
                path: key,
                // Ensure access level matches storage config. 
                // We configured 'user-files/{entity_id}/*' for authenticated users.
                // getUrl usually defaults to 'guest' or 'public' if not specified? 
                // Actually, Gen 2 uses 'path' directly. S3 bucket policies control access.
                // Amplify Gen 2 gets a presigned URL.
            });
            window.open(link.url.toString(), '_blank');
        } catch (error) {
            console.error("Download error", error);
            alert("Failed to download file.");
        }
    };

    const handleNavigate = (folder: Folder) => {
        setBreadcrumbs([...breadcrumbs, folder]);
        setCurrentFolder(folder);
    };

    const handleNavigateUp = (index: number) => {
        if (index === -1) {
            setCurrentFolder(null);
            setBreadcrumbs([]);
        } else {
            const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
            setBreadcrumbs(newBreadcrumbs);
            setCurrentFolder(newBreadcrumbs[newBreadcrumbs.length - 1]);
        }
    };

    if (!identityId) return <div className="loading">Initializing Session...</div>;

    const currentPathString = currentFolder
        ? `user-files/${identityId}/${currentFolder.path}/`
        : `user-files/${identityId}/`;

    return (
        <div className="file-manager">
            {/* Toolbar / Breadcrumbs */}
            <div className="fm-toolbar">
                <div className="breadcrumbs">
                    <button className={`crumb ${!currentFolder ? 'active' : ''}`} onClick={() => handleNavigateUp(-1)}>
                        <Home size={18} />
                    </button>
                    {breadcrumbs.map((folder, index) => (
                        <div key={folder.id} className="crumb-group">
                            <ChevronRight size={16} className="separator" />
                            <button className="crumb" onClick={() => handleNavigateUp(index)}>
                                {folder.name}
                            </button>
                        </div>
                    ))}
                </div>

                <button className="create-folder-btn primary" onClick={handleCreateFolder}>
                    <FolderPlus size={18} />
                    <span>New Folder</span>
                </button>
            </div>

            <FileUploader
                currentPath={currentPathString}
                currentFolderId={currentFolder ? currentFolder.id : 'root'}
                onUploadStart={() => {
                    /* Optional: show global loader */
                    console.log("Upload started");
                }}
                onUploadSuccess={() => {
                    console.log("Upload success - waiting for sync");
                    // Trigger might take a moment.
                }}
            />

            <FileExplorer
                files={files}
                folders={subFolders}
                onNavigate={handleNavigate}
                onDeleteFile={handleDeleteFile}
                onDeleteFolder={() => alert("Folder deletion not implemented in this version.")}
                onDownload={handleDownload}
            />
        </div>
    );
}
