import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faParachuteBox } from '@fortawesome/free-solid-svg-icons';
import { ChevronDown, LogOut, User, Menu } from 'lucide-react';
import { getOrCreateProfile, type UserProfileData } from '../../utils/profileUtils';
import { getUrl } from 'aws-amplify/storage';
import './Header.css';

interface HeaderProps {
    user?: { username: string; signInDetails?: { loginId?: string } };
    signOut: () => void;
    onToggleSidebar: () => void;
    onViewChange: (view: 'files' | 'profile') => void;
}

const Header: React.FC<HeaderProps> = ({ user, signOut, onToggleSidebar, onViewChange }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string>('');

    useEffect(() => {
        const loadProfile = async () => {
            if (user) {
                try {
                    const data = await getOrCreateProfile({
                        username: user.username,
                        email: user.signInDetails?.loginId
                    });
                    setProfile(data);

                    if (data?.avatarUrl) {
                        try {
                            if (data.avatarUrl.startsWith('http')) {
                                setAvatarUrl(data.avatarUrl);
                            } else {
                                const result = await getUrl({ path: data.avatarUrl });
                                setAvatarUrl(result.url.toString());
                            }
                        } catch (e) {
                            console.error('Failed to resolve avatar url', e);
                        }
                    }
                } catch (e) {
                    console.error('Failed to load profile for header', e);
                }
            }
        };
        loadProfile();

        // Listen for profile updates (optional: simplified for now via refresh on view load)
        const interval = setInterval(loadProfile, 5000); // Polling for simple sync
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayName = profile?.displayName || user?.username || 'User';
    const emailDisplay = profile?.email || user?.username || '';

    return (
        <header className="app-top-bar">
            <div className="top-bar-left">
                <button className="mobile-menu-toggle" onClick={onToggleSidebar}>
                    <Menu size={24} />
                </button>
                <div className="logo-small" onClick={() => onViewChange('files')} style={{ cursor: 'pointer' }}>
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
                        <div className="user-avatar" style={{ overflow: 'hidden' }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                (displayName?.[0] || 'U').toUpperCase()
                            )}
                        </div>
                        <span className="username-display">{displayName}</span>
                        <ChevronDown size={16} className={`chevron-icon ${isMenuOpen ? 'open' : ''}`} />
                    </button>

                    {isMenuOpen && (
                        <div className="user-dropdown-menu">
                            <div className="menu-header">
                                <span className="menu-email">{emailDisplay}</span>
                            </div>
                            <div className="menu-divider"></div>

                            <button className="menu-item" onClick={() => { setIsMenuOpen(false); onViewChange('profile'); }}>
                                <User size={16} />
                                <span>Profile & Settings</span>
                            </button>

                            <button className="menu-item" onClick={() => { setIsMenuOpen(false); signOut(); }}>
                                <LogOut size={16} />
                                <span>Sign out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
