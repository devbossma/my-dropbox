import { useRef, useState } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';
import { UploadCloud } from 'lucide-react';
import './FileUploader.css';

interface FileUploaderProps {
    currentPath: string; // "user-files/{identityId}/folder1/folder2/"
    currentFolderId: string; // Add this
    onUploadStart: () => void;
    onUploadSuccess: () => void;
}

export default function FileUploader({ currentPath, currentFolderId, onUploadStart, onUploadSuccess }: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            console.log("Files dropped:", e.dataTransfer.files);
            handleUpload(e.dataTransfer.files);
        }
    };

    const handleUpload = async (files: FileList) => {
        console.log("Handle Upload called with:", files.length, "files");
        console.log("Uploading to path:", currentPath);
        onUploadStart();
        try {
            // Get current user ID to set as owner
            const { userId } = await getCurrentUser();

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`Starting upload for: ${file.name}`);
                const operation = uploadData({
                    path: `${currentPath}${file.name}`,
                    data: file,
                    options: {
                        metadata: {
                            owner: userId,
                            folderid: currentFolderId // Pass folder ID (S3 lowercases keys)
                        },
                        onProgress: ({ transferredBytes, totalBytes }) => {
                            if (totalBytes) {
                                console.log(`Upload progress ${Math.round(transferredBytes / totalBytes * 100)}%`);
                            }
                        },
                    }
                });
                const result = await operation.result;
                console.log('Upload Succeeded: ', result);
            }
            onUploadSuccess();
        } catch (error) {
            console.error('Upload Failed Error:', error);
            if (error instanceof Error) {
                console.error('Error Message:', error.message);
                console.error('Error Stack:', error.stack);
            }
            alert(`Upload failed: ${error}`);
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
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
            <UploadCloud size={48} className="upload-icon" />
            <p>Drag & drop files here, or click to select</p>
        </div>
    );
}
