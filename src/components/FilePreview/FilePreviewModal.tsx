import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Music, File as FileIcon, ExternalLink } from 'lucide-react';
import './FilePreviewModal.css';

interface FilePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    file: {
        fileName: string;
        id: string;
        fileSize?: number;
    } | null;
    fileUrl: string | null;
    onDownload: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ isOpen, onClose, file, fileUrl, onDownload }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line
            setLoading(true);
            setError(false);
        }
    }, [isOpen, fileUrl]);

    if (!isOpen || !file) return null;

    const getFileType = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '')) return 'image';
        if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) return 'video';
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) return 'audio';
        if (['pdf'].includes(ext || '')) return 'pdf';
        if (['txt', 'md', 'json', 'ts', 'js', 'css', 'html'].includes(ext || '')) return 'text';
        return 'unknown';
    };

    const fileType = getFileType(file.fileName);

    const handleLoad = () => {
        setLoading(false);
    };

    const handleError = () => {
        setLoading(false);
        setError(true);
    };

    // Formatted size
    const sizeDisplay = file.fileSize
        ? (file.fileSize / 1024 / 1024).toFixed(2) + ' MB'
        : 'Unknown size';

    return (
        <div className="preview-overlay" onClick={onClose}>
            <div className="preview-container" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="preview-header">
                    <div className="preview-info">
                        <span className="preview-filename">{file.fileName}</span>
                        <span className="preview-meta">{sizeDisplay} • {fileType.toUpperCase()}</span>
                    </div>
                    <div className="preview-actions">
                        <button className="preview-btn" onClick={onDownload} title="Download">
                            <Download size={20} />
                        </button>
                        {fileUrl && (
                            <a href={fileUrl} target="_blank" rel="noreferrer" className="preview-btn" title="Open in new tab">
                                <ExternalLink size={20} />
                            </a>
                        )}
                        <button className="preview-btn close" onClick={onClose} title="Close">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="preview-content">
                    {loading && !error && fileType !== 'unknown' && (
                        <div className="loading-spinner"></div>
                    )}

                    {error && (
                        <div className="preview-unsupported">
                            <FileIcon size={48} />
                            <p>Failed to load preview.</p>
                            <button className="download-link" onClick={onDownload}>Download to view</button>
                        </div>
                    )}

                    {!error && fileUrl && (
                        <>
                            {fileType === 'image' && (
                                <img
                                    src={fileUrl}
                                    alt={file.fileName}
                                    className="preview-image"
                                    onLoad={handleLoad}
                                    onError={handleError}
                                    style={{ display: loading ? 'none' : 'block' }}
                                />
                            )}

                            {fileType === 'video' && (
                                <video
                                    src={fileUrl}
                                    controls
                                    autoPlay
                                    className="preview-video"
                                    onLoadedData={handleLoad}
                                    onError={handleError}
                                    style={{ display: loading ? 'none' : 'block' }}
                                />
                            )}

                            {fileType === 'audio' && (
                                <div className="preview-audio-wrapper" style={{ display: loading ? 'none' : 'flex' }}>
                                    <Music size={64} className="audio-icon-large" />
                                    <audio
                                        src={fileUrl}
                                        controls
                                        className="preview-audio"
                                        onLoadedData={handleLoad}
                                        onError={handleError}
                                    />
                                </div>
                            )}

                            {fileType === 'pdf' && (
                                <iframe
                                    src={fileUrl}
                                    className="preview-pdf"
                                    onLoad={handleLoad}
                                    onError={handleError}
                                    title="PDF Preview"
                                />
                            )}

                            {fileType === 'text' && (
                                <iframe
                                    src={fileUrl}
                                    className="preview-frame"
                                    style={{ background: '#fff', display: loading ? 'none' : 'block' }}
                                    onLoad={handleLoad}
                                    onError={handleError}
                                    title="Text Preview"
                                />
                            )}

                            {(fileType === 'unknown') && (
                                <div className="preview-unsupported">
                                    <FileText size={64} />
                                    <p>No preview available for this file type.</p>
                                    <button className="download-link" onClick={onDownload}>Download File</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FilePreviewModal;
