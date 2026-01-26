import React from 'react';
import {
    Files,
    Clock,
    Star,
    Trash2,
    Cloud,
    Settings,
    Users,
    HardDrive
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
    storageUsed: string;
    storageTotal: string;
    storagePercentage: number;
}

const Sidebar: React.FC<SidebarProps> = ({ storageUsed, storageTotal, storagePercentage }) => {
    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">
                <div className="nav-group">
                    <label className="nav-label">Files</label>
                    <a href="#" className="nav-item active">
                        <Files size={20} />
                        <span>All Files</span>
                    </a>
                    <a href="#" className="nav-item">
                        <Clock size={20} />
                        <span>Recent</span>
                    </a>
                    <a href="#" className="nav-item">
                        <Star size={20} />
                        <span>Starred</span>
                    </a>
                    <a href="#" className="nav-item">
                        <Trash2 size={20} />
                        <span>Trash</span>
                    </a>
                </div>

                <div className="nav-group">
                    <label className="nav-label">Collaboration</label>
                    <a href="#" className="nav-item">
                        <Users size={20} />
                        <span>Shared with me</span>
                    </a>
                    <a href="#" className="nav-item">
                        <Cloud size={20} />
                        <span>File requests</span>
                    </a>
                </div>
            </nav>

            <div className="sidebar-footer">
                <div className="storage-card">
                    <div className="storage-info">
                        <HardDrive size={16} />
                        <span>Storage</span>
                        <span className="storage-percent">{storageUsed} / {storageTotal}</span>
                    </div>
                    <div className="storage-bar">
                        <div
                            className="storage-progress"
                            style={{ width: `${storagePercentage}%` }}
                        ></div>
                    </div>
                </div>

                <button className="nav-item settings-btn">
                    <Settings size={20} />
                    <span>Settings</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
