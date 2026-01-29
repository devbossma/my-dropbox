import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getUrl } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Loader } from '@aws-amplify/ui-react';
import type { Schema } from '../../../amplify/data/resource';
import FileExplorer from '../FileExplorer/FileExplorer';
import FileUploader from '../FileUploader/FileUploader';
import FilePreviewModal from '../FilePreview/FilePreviewModal';
import ShareModal from '../Share/ShareModal';
import { FolderPlus, Home, ChevronRight } from 'lucide-react';
import { useToast } from '../Toast/Toast';
import { deleteFolderRecursively, renameFolderRecursively } from '../../utils/folderOperations';
import './FileManager.css';

const client = generateClient<Schema>();

type Folder = Schema['Folder']['type'];
type FileMetadata = Schema['FileMetadata']['type'];

interface FileManagerProps {
    storageUsed: number;
    storageLimit: number;
    onStorageChange?: () => void;
}

export default function FileManager({ storageUsed, storageLimit, onStorageChange }: FileManagerProps) {
    const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<Folder[]>([]);
    const [files, setFiles] = useState<FileMetadata[]>([]);
    const [subFolders, setSubFolders] = useState<Folder[]>([]);
    const [folderSizes, setFolderSizes] = useState<Record<string, number>>({});
    const [identityId, setIdentityId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { showToast } = useToast();

    // Preview State
    const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const refreshFiles = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    // Helper function to recursively calculate folder size
    const calculateFolderSize = async (folderId: string): Promise<number> => {
        let totalSize = 0;

        // Get all files in this folder
        const { data: filesInFolder } = await client.models.FileMetadata.list({
            filter: { folderId: { eq: folderId } }
        });
        const activeFiles = filesInFolder.filter(f => !f.isDeleted);
        totalSize += activeFiles.reduce((sum, f) => sum + (f.fileSize || 0), 0);

        // Get all subfolders and recursively calculate their sizes
        const { data: childFolders } = await client.models.Folder.list({
            filter: { parentFolderId: { eq: folderId } }
        });
        for (const child of childFolders) {
            totalSize += await calculateFolderSize(child.id);
        }

        return totalSize;
    };

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
        const folderSub = client.models.Folder.observeQuery({
            filter: {
                parentFolderId: { eq: folderId ?? 'root' }
            }
        }).subscribe({
            next: async ({ items }) => {
                setSubFolders(items);
                // Calculate sizes for each subfolder
                const sizes: Record<string, number> = {};
                for (const folder of items) {
                    sizes[folder.id] = await calculateFolderSize(folder.id);
                }
                setFolderSizes(sizes);
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
            },
            error: (err) => console.error('File sub error', err)
        });

        return () => {
            folderSub.unsubscribe();
            fileSub.unsubscribe();
        };
    }, [currentFolder, identityId, refreshTrigger]);

    const handleCreateFolder = async () => {
        const name = prompt("Enter folder name:");
        if (!name) return;

        try {
            await client.models.Folder.create({
                name,
                parentFolderId: currentFolder ? currentFolder.id : 'root',
                path: currentFolder ? `${currentFolder.path}/${name}` : name,
                size: 0,
            });
            refreshFiles();
            showToast(`Folder "${name}" created successfully`, 'success');
        } catch (error) {
            console.error("Create folder error", error);
            showToast('Failed to create folder', 'error');
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm("Are you sure you want to delete this folder and ALL its contents? This cannot be undone.")) return;

        setLoading(true);
        try {
            // Recursive delete of content
            await deleteFolderRecursively(folderId);

            // Delete the folder itself
            await client.models.Folder.delete({ id: folderId });

            refreshFiles();
            // Trigger storage refresh (files were deleted)
            setTimeout(() => onStorageChange?.(), 2000);
            showToast('Folder deleted successfully', 'success');
        } catch (error) {
            console.error("Delete folder error", error);
            showToast('Failed to delete folder', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRenameFolder = async (folderId: string, currentName: string) => {
        const newName = prompt("Enter new folder name:", currentName);
        if (!newName || newName === currentName) return;

        setLoading(true);
        try {
            // 1. Get current folder to know full path
            const { data: folder } = await client.models.Folder.get({ id: folderId });
            if (!folder || !identityId) return;

            const oldPath = folder.path;

            // Construct new path
            const pathParts = oldPath.split('/');
            pathParts.pop(); // remove old name
            pathParts.push(newName);
            const newPath = pathParts.join('/');

            // 2. Rename Recursively (Files & Subfolders)
            await renameFolderRecursively(folderId, oldPath, newPath, identityId);

            // 3. Update the folder itself
            await client.models.Folder.update({
                id: folderId,
                name: newName,
                path: newPath
            });

            refreshFiles();
            showToast('Folder renamed successfully', 'success');
        } catch (error) {
            console.error("Rename folder error", error);
            showToast('Failed to rename folder', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFile = async (id: string, _key: string) => {
        if (!confirm("Are you sure you want to delete this file?")) return;

        try {
            await client.models.FileMetadata.delete({ id });
            refreshFiles();
            // Trigger storage refresh after delete
            setTimeout(() => onStorageChange?.(), 2000);
            showToast('File deleted successfully', 'success');
        } catch (error) {
            console.error("Delete file error", error);
            showToast('Failed to delete file', 'error');
        }
    };


    const handleRenameFile = async (id: string, currentName: string) => {
        const newName = prompt("Enter new file name:", currentName);
        if (!newName || newName === currentName) return;

        // Updating just the fileName in DynamoDB. 
        // The Backend Trigger will detect this change and handle the S3 rename + s3Key update automatically.
        try {
            await client.models.FileMetadata.update({
                id,
                fileName: newName
            });
            refreshFiles();
            showToast(`File renamed to "${newName}"`, 'success');
        } catch (error) {
            console.error("Rename error", error);
            showToast('Failed to rename file', 'error');
        }
    };

    const handleDownload = async (key: string) => {
        try {
            const link = await getUrl({
                path: key,
            });

            // Force download by fetching blob
            // Note: This requires CORS configuration on the S3 bucket to allow GET from the frontend domain (localhost).
            const response = await fetch(link.url.toString());
            if (!response.ok) throw new Error('Network response was not ok');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const filename = key.split('/').pop() || 'download';
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download error", error);
            alert("Failed to download file. This might be a CORS issue.");
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

    const handlePreview = async (file: FileMetadata) => {
        setPreviewFile(file);
        setIsPreviewOpen(true);
        setPreviewUrl(null); // Reset while loading

        if (!file.s3Key) {
            console.error("No s3Key for file", file);
            return;
        }

        try {
            const link = await getUrl({ path: file.s3Key });
            setPreviewUrl(link.url.toString());
        } catch (error) {
            console.error("Failed to get preview URL", error);
            showToast("Failed to load preview", "error");
        }
    };

    // Share Handler
    const [shareFile, setShareFile] = useState<FileMetadata | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const handleShare = (file: FileMetadata) => {
        setShareFile(file);
        setIsShareModalOpen(true);
    };

    if (!identityId) return <div className="loading">Initializing Session...</div>;

    const currentPathString = currentFolder
        ? `user-files/${identityId}/${currentFolder.path}/`
        : `user-files/${identityId}/`;

    return (
        <div className="file-manager">
            {/* Toolbar / Breadcrumbs */}
            <div className="fm-toolbar">
                <div className="breadcrumbs-container">
                    <div className="breadcrumbs">
                        <button className={`crumb-btn ${!currentFolder ? 'active' : ''}`} onClick={() => handleNavigateUp(-1)}>
                            <Home size={18} />
                            <span>Home</span>
                        </button>
                        {breadcrumbs.map((folder, index) => (
                            <div key={folder.id} className="crumb-group">
                                <ChevronRight size={14} className="separator" />
                                <button className="crumb-btn" onClick={() => handleNavigateUp(index)}>
                                    {folder.name}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="toolbar-actions" style={{ display: 'flex', gap: '8px' }}>
                    <button className="icon-btn" onClick={refreshFiles} title="Refresh Files" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px' }}>
                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>↻</span>
                    </button>
                    <button className="create-folder-btn primary" onClick={handleCreateFolder}>
                        <FolderPlus size={18} />
                        <span>New Folder</span>
                    </button>
                </div>
            </div>

            <FileUploader
                currentPath={currentPathString}
                currentFolderId={currentFolder ? currentFolder.id : 'root'}
                storageUsed={storageUsed}
                storageLimit={storageLimit}
                onUploadStart={() => {
                    setLoading(true);
                    setUploadProgress(0);
                }}
                onProgress={(progress) => setUploadProgress(progress)}
                onUploadSuccess={() => {
                    setUploadProgress(100);
                    // Trigger might take a moment.
                    setTimeout(() => {
                        refreshFiles();
                        onStorageChange?.(); // Refresh storage after upload
                        setUploadProgress(null);
                    }, 2000);
                }}
            />

            {loading && (
                <div className="loading-bar-container">
                    <Loader
                        variation="linear"
                        percentage={uploadProgress !== null ? uploadProgress : undefined}
                        isDeterminate={uploadProgress !== null}
                    />
                </div>
            )}

            <FileExplorer
                files={files}
                folders={subFolders}
                folderSizes={folderSizes}
                onNavigate={handleNavigate}
                onDeleteFile={handleDeleteFile}
                onDeleteFolder={handleDeleteFolder}
                onRenameFolder={handleRenameFolder}
                onDownload={handleDownload}
                onRenameFile={handleRenameFile}
                folderName={currentFolder?.name || 'Home'}
                onPreview={handlePreview}
                onShare={handleShare}
            />

            <FilePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                file={previewFile}
                fileUrl={previewUrl}
                onDownload={() => previewFile?.s3Key && handleDownload(previewFile.s3Key)}
            />

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                file={shareFile}
            />
        </div>
    );
}
