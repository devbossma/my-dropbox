import { useState, useMemo } from 'react';
import { Trash2, Download, Edit2, Search, ChevronDown, Eye, Link as LinkIcon } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFile,
    faFilePdf,
    faFileImage,
    faFileVideo,
    faFileAudio,
    faFileCode,
    faFileLines,
    faFileArchive,
    faFolder as faFolderSolid
} from '@fortawesome/free-solid-svg-icons';
import './FileExplorer.css';
import type { Schema } from '../../../amplify/data/resource';



type Folder = Schema['Folder']['type'];
type FileMetadata = Schema['FileMetadata']['type'];

interface FileExplorerProps {
    files: FileMetadata[];
    folders: Folder[];
    folderSizes: Record<string, number>;
    onNavigate: (folder: Folder) => void;
    onDeleteFile: (id: string, key: string) => void;
    onDeleteFolder: (id: string) => void;
    onRenameFolder: (id: string, name: string) => void;
    onDownload: (key: string) => void;
    onRenameFile: (id: string, currentName: string) => void;
    folderName: string;
    onPreview?: (file: FileMetadata) => void;
    onShare?: (file: FileMetadata) => void;
}

export default function FileExplorer({ files, folders, folderSizes, onNavigate, onDeleteFile, onDeleteFolder, onRenameFolder, onDownload, onRenameFile, folderName, onPreview, onShare }: FileExplorerProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredFolders = useMemo(() =>
        folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [folders, searchQuery]);

    const filteredFiles = useMemo(() =>
        files.filter(f => f.fileName.toLowerCase().includes(searchQuery.toLowerCase())),
        [files, searchQuery]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (mimeType?: string | null, fileName?: string) => {
        if (!mimeType) {
            // Fallback to extension if mimeType is missing
            const ext = fileName?.split('.').pop()?.toLowerCase();
            if (ext === 'pdf') return faFilePdf;
            if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return faFileArchive;
            return faFile;
        }

        if (mimeType.includes('pdf')) return faFilePdf;
        if (mimeType.startsWith('image/')) return faFileImage;
        if (mimeType.startsWith('video/')) return faFileVideo;
        if (mimeType.startsWith('audio/')) return faFileAudio;
        if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css')) return faFileCode;
        if (mimeType.startsWith('text/')) return faFileLines;
        if (mimeType.includes('zip') || mimeType.includes('compressed')) return faFileArchive;

        return faFile;
    };

    return (
        <div className="file-explorer">
            <div className="explorer-header">
                <div className="header-title">
                    <h2>{folderName}</h2>
                    <ChevronDown size={20} className="title-chevron" />
                </div>
                <div className="search-container">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="grid-body">
                {/* Folders */}
                {filteredFolders.map(folder => (
                    <div key={folder.id} className="grid-item folder-item" onClick={() => onNavigate(folder)}>
                        <div className="item-icon-wrapper">
                            <FontAwesomeIcon icon={faFolderSolid} className="item-icon folder-icon-grid" style={{ fontSize: '48px' }} />
                            <div className="item-actions">
                                <button className="mini-btn" onClick={(e) => { e.stopPropagation(); onRenameFolder(folder.id, folder.name); }} title="Rename">
                                    <Edit2 size={14} />
                                </button>
                                <button className="mini-btn delete-btn" onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} title="Delete">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="item-info">
                            <span className="item-name">{folder.name}</span>
                            <span className="item-meta">
                                {folderSizes[folder.id] !== undefined && folderSizes[folder.id] > 0
                                    ? formatSize(folderSizes[folder.id])
                                    : 'Empty'}
                            </span>
                        </div>
                    </div>
                ))}

                {/* Files */}
                {filteredFiles.map(file => (
                    <div key={file.id} className="grid-item file-item" onClick={() => onPreview && onPreview(file)}>
                        {file.version !== undefined && file.version !== null && (
                            <span className="version-badge">v{file.version}</span>
                        )}
                        <div className="item-icon-wrapper">
                            <FontAwesomeIcon icon={getFileIcon(file.mimeType, file.fileName)} className="item-icon file-icon-grid" style={{ fontSize: '48px' }} />
                            <div className="item-actions">
                                <button className="mini-btn" onClick={(e) => { e.stopPropagation(); if (onPreview) onPreview(file); }} title="Preview">
                                    <Eye size={14} />
                                </button>
                                <button className="mini-btn" onClick={(e) => { e.stopPropagation(); if (onShare) onShare(file); }} title="Share">
                                    <LinkIcon size={14} />
                                </button>
                                <button className="mini-btn" onClick={(e) => { e.stopPropagation(); onDownload(file.s3Key); }} title="Download" >
                                    <Download size={14} />
                                </button>
                                <button className="mini-btn" onClick={(e) => { e.stopPropagation(); onRenameFile(file.id, file.fileName); }} title="Rename">
                                    <Edit2 size={14} />
                                </button>
                                <button className="mini-btn delete-btn" onClick={(e) => { e.stopPropagation(); onDeleteFile(file.id, file.s3Key); }} title="Delete">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="item-info">
                            <span className="item-name">{file.fileName}</span>
                            <span className="item-meta">
                                {formatSize(file.fileSize)}
                            </span>
                        </div>
                    </div>
                ))}

                {filteredFolders.length === 0 && filteredFiles.length === 0 && (
                    <div className="empty-state">
                        <p>{searchQuery ? 'No results found.' : 'This folder is empty.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
