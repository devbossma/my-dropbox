import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faParachuteBox } from '@fortawesome/free-solid-svg-icons';
import { ChevronDown, LogOut, Trash2 } from 'lucide-react';
import './Header.css';

interface HeaderProps {
    user?: { username: string };
    signOut: () => void;
    deleteMe: () => void;
    isDeleting: false;
}

const Header: React.FC<HeaderProps> = ({ user, signOut, deleteMe, isDeleting }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="app-top-bar">
            <div className="top-bar-left">
                <div className="logo-small">
                    <FontAwesomeIcon icon={faParachuteBox} size="lg" style={{ color: "#3b82fc" }} />
                    <span className="logo-text">MyDropBox</span>
                </div>
            </div>

            <div className="top-bar-right">
                <div className="user-menu-container" ref={menuRef}>
                    <button
                        className={`user-menu-trigger ${isMenuOpen ? 'active' : ''}`}
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <div className="user-avatar">
                            {(user?.username?.[0] || 'U').toUpperCase()}
                        </div>
                        <span className="username-display">{user?.username}</span>
                        <ChevronDown size={16} className={`chevron-icon ${isMenuOpen ? 'open' : ''}`} />
                    </button>

                    {isMenuOpen && (
                        <div className="user-dropdown-menu">
                            <div className="menu-header">
                                <span className="menu-label">Account</span>
                                <span className="menu-email">{user?.username}</span>
                            </div>
                            <div className="menu-divider"></div>
                            <button className="menu-item" onClick={() => { setIsMenuOpen(false); signOut(); }}>
                                <LogOut size={16} />
                                <span>Sign out</span>
                            </button>
                            <button
                                className="menu-item danger"
                                onClick={() => { setIsMenuOpen(false); deleteMe(); }}
                                disabled={isDeleting}
                            >
                                <Trash2 size={16} />
                                <span>Delete Account</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
