import { File as FileIcon, Folder as FolderIcon, MoreVertical, Trash2, Download, Edit2 } from 'lucide-react';
import './FileExplorer.css';
import type { Schema } from '../../../amplify/data/resource';
import { getUrl } from 'aws-amplify/storage';


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
}

export default function FileExplorer({ files, folders, folderSizes, onNavigate, onDeleteFile, onDeleteFolder, onRenameFolder, onDownload, onRenameFile }: FileExplorerProps) {

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="file-explorer">
            {/* Header */}
            <div className="file-list-header">
                <span className="col-name">Name</span>
                <span className="col-size">Size</span>
                <span className="col-version">Ver</span>
                <span className="col-date">Date</span>
                <span className="col-actions"></span>
            </div>

            <div className="file-list-body">
                {/* Folders */}
                {folders.map(folder => (
                    <div key={folder.id} className="file-row folder-row" onClick={() => onNavigate(folder)}>
                        <div className="col-name">
                            <FolderIcon className="row-icon folder-icon" size={20} />
                            <span>{folder.name}</span>
                        </div>
                        <div className="col-size">
                            {folderSizes[folder.id] !== undefined && folderSizes[folder.id] > 0
                                ? formatSize(folderSizes[folder.id])
                                : '-'}
                        </div>
                        <div className="col-date">-</div>
                        <div className="col-actions">
                            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onRenameFolder(folder.id, folder.name); }} title="Rename">
                                <Edit2 size={16} />
                            </button>
                            <button className="icon-btn delete-btn" onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} title="Delete">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Files */}
                {files.map(file => (
                    <div key={file.id} className="file-row">
                        <div className="col-name">
                            <FileIcon className="row-icon file-icon" size={20} />
                            <span>{file.fileName}</span>
                        </div>
                        <div className="col-size">{formatSize(file.fileSize)}</div>
                        <div className="col-version">
                            {file.version ? <span className="version-badge">v{file.version}</span> : <span className="version-badge">v1</span>}
                        </div>
                        <div className="col-date">{new Date(file.createdAt).toLocaleDateString()}</div>
                        <div className="col-actions">
                            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onDownload(file.s3Key); }} title="Download" >
                                <Download size={16} />
                            </button>
                            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onRenameFile(file.id, file.fileName); }} title="Rename">
                                <Edit2 size={16} />
                            </button>
                            <button className="icon-btn delete-btn" onClick={(e) => { e.stopPropagation(); onDeleteFile(file.id, file.s3Key); }} title="Delete">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}

                {folders.length === 0 && files.length === 0 && (
                    <div className="empty-state">
                        <p>This folder is empty.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
