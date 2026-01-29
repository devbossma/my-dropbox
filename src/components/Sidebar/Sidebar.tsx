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
    isOpen: boolean;
    onClose: () => void;
    currentView: 'files' | 'profile';
    onViewChange: (view: 'files' | 'profile') => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    storageUsed,
    storageTotal,
    storagePercentage,
    isOpen,
    onClose,
    currentView,
    onViewChange
}) => {
    const handleViewChange = (view: 'files' | 'profile') => {
        onViewChange(view);
        if (window.innerWidth <= 900) {
            onClose();
        }
    };

    return (
        <>
            {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <nav className="sidebar-nav">
                    <div className="nav-group">
                        <label className="nav-label">Files</label>
                        <button
                            className={`nav-item ${currentView === 'files' ? 'active' : ''}`}
                            onClick={() => handleViewChange('files')}
                        >
                            <Files size={20} />
                            <span>All Files</span>
                        </button>
                        <button className="nav-item">
                            <Clock size={20} />
                            <span>Recent</span>
                        </button>
                        <button className="nav-item">
                            <Star size={20} />
                            <span>Starred</span>
                        </button>
                        <button className="nav-item">
                            <Trash2 size={20} />
                            <span>Trash</span>
                        </button>
                    </div>

                    <div className="nav-group">
                        <label className="nav-label">Collaboration</label>
                        <button className="nav-item">
                            <Users size={20} />
                            <span>Shared with me</span>
                        </button>
                        <button className="nav-item">
                            <Cloud size={20} />
                            <span>File requests</span>
                        </button>
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

                    <button
                        className={`nav-item settings-btn ${currentView === 'profile' ? 'active' : ''}`}
                        onClick={() => handleViewChange('profile')}
                    >
                        <Settings size={20} />
                        <span>Settings</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
