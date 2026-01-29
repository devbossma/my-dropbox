import { useRef, useState } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';
import { UploadCloud } from 'lucide-react';
import { useToast } from '../Toast/Toast';
import { formatBytes, hasEnoughStorage, getRemainingStorage } from '../../utils/storageUtils';
import './FileUploader.css';

interface FileUploaderProps {
    currentPath: string; // "user-files/{identityId}/folder1/folder2/"
    currentFolderId: string;
    onUploadStart: () => void;
    onUploadSuccess: () => void;
    onProgress?: (progress: number) => void;
    storageUsed: number;      // Current storage usage in bytes
    storageLimit: number;     // Storage limit in bytes
}

export default function FileUploader({
    currentPath,
    currentFolderId,
    onUploadStart,
    onUploadSuccess,
    onProgress,
    storageUsed,
    storageLimit
}: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUpload(Array.from(e.dataTransfer.files));
        }
    };

    const handleUpload = async (files: File[]) => {
        // Calculate total size of files to upload
        const totalFilesSize = files.reduce((sum, file) => sum + file.size, 0);

        // Check if there's enough storage
        if (!hasEnoughStorage(storageUsed, totalFilesSize, storageLimit)) {
            const remaining = getRemainingStorage(storageUsed, storageLimit);
            showToast(
                `Not enough storage. You need ${formatBytes(totalFilesSize)} but only have ${formatBytes(remaining)} available.`,
                'error'
            );
            return;
        }

        onUploadStart();
        try {
            // Get current user ID to set as owner
            const { userId } = await getCurrentUser();

            for (const file of files) {
                const operation = uploadData({
                    path: `${currentPath}${file.name}`,
                    data: file,
                    options: {
                        metadata: {
                            owner: userId,
                            folderid: currentFolderId,
                            mimeType: file.type,
                        },
                        onProgress: ({ transferredBytes, totalBytes }) => {
                            if (totalBytes) {
                                const percent = Math.round(transferredBytes / totalBytes * 100);
                                onProgress?.(percent);
                            }
                        },
                    }
                });
                await operation.result;
            }
            onUploadSuccess();
        } catch (error) {
            console.error('Upload Failed Error:', error);
            showToast('Upload failed', 'error');
        }
    };

    return (
        <div
            className={`file-uploader ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
        >
            <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        const files = Array.from(e.target.files); // Copy files before resetting
                        e.target.value = ''; // Reset input so the same file can be uploaded again
                        handleUpload(files);
                    }
                }}
            />
            <UploadCloud size={48} className="upload-icon" />
            <p>Drag & drop files here, or click to select</p>
        </div>
    );
}
