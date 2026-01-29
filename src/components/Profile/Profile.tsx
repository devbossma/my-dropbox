import React, { useEffect, useState } from 'react';
import { User, Shield, Trash2, Edit2, Save, X, Key, Lock, Camera } from 'lucide-react';
import { getOrCreateProfile, type UserProfileData } from '../../utils/profileUtils';
import { generateClient } from 'aws-amplify/data';
import { updatePassword, fetchAuthSession } from 'aws-amplify/auth';
import { uploadData, getUrl } from 'aws-amplify/storage';
import type { Schema } from '../../../amplify/data/resource';
import {
    formatBytes,
    getStorageLimitBytes,
    getStoragePercentage,
    getStorageStatus,
    type StoragePlan
} from '../../utils/storageUtils';
import './Profile.css';

const client = generateClient<Schema>();

interface ProfileProps {
    user?: {
        username: string;
        userId?: string;
        signInDetails?: {
            loginId?: string;
        }
    };
    onDeleteAccount: () => void;
    isDeleting: boolean;
}

const Profile: React.FC<ProfileProps> = ({ user, onDeleteAccount, isDeleting }) => {
    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string>('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Password Change State
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    // Derived storage values
    const userPlan = (profile?.plan as StoragePlan) || 'FREE';
    const storageLimit = getStorageLimitBytes(userPlan);
    const storagePercentage = getStoragePercentage(profile?.storageUsed || 0, storageLimit);
    const storageStatus = getStorageStatus(storagePercentage);

    useEffect(() => {
        const loadProfile = async () => {
            if (user) {
                const email = user.signInDetails?.loginId;
                const data = await getOrCreateProfile({
                    username: user.username,
                    email: email
                });
                setProfile(data);
                setEditName(data?.displayName || user.username);
                if (data?.avatarUrl) {
                    try {
                        if (data.avatarUrl.startsWith('http')) {
                            setAvatarUrl(data.avatarUrl);
                        } else {
                            const result = await getUrl({ path: data.avatarUrl });
                            setAvatarUrl(result.url.toString());
                        }
                    } catch (e) {
                        console.error('Failed to get avatar URL', e);
                    }
                }
            }
            setIsLoading(false);
        };
        loadProfile();
    }, [user]);

    const handleSave = async () => {
        if (!profile) return;
        try {
            const { data: updatedProfile, errors } = await client.models.UserProfile.update({
                id: profile.id,
                displayName: editName
            });

            if (errors) {
                alert('Error updating profile');
                console.error(errors);
                return;
            }

            setProfile(updatedProfile);
            setIsEditing(false);
        } catch (e) {
            console.error(e);
            alert('Failed to update profile');
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !profile) return;

        try {
            setIsUploading(true);
            const { identityId } = await fetchAuthSession();
            const extension = file.name.split('.').pop();
            const path = `avatars/${identityId}/avatar.${extension}`;

            await uploadData({
                path,
                data: file,
                options: { contentType: file.type }
            }).result;

            const urlResult = await getUrl({ path });
            setAvatarUrl(urlResult.url.toString());

            await client.models.UserProfile.update({
                id: profile.id,
                avatarUrl: path
            });

            setProfile(prev => prev ? { ...prev, avatarUrl: path } : null);

        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert('Failed to upload avatar');
        } finally {
            setIsUploading(false);
        }
    };

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError("New passwords do not match.");
            return;
        }

        if (passwordData.newPassword.length < 8) {
            setPasswordError("Password must be at least 8 characters.");
            return;
        }

        try {
            await updatePassword({
                oldPassword: passwordData.oldPassword,
                newPassword: passwordData.newPassword
            });
            setPasswordSuccess("Password updated successfully!");
            setTimeout(() => {
                setIsChangingPassword(false);
                setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
                setPasswordSuccess('');
            }, 2000);
        } catch (err: any) {
            console.error('Password update failed:', err);
            setPasswordError(err.message || "Failed to update password. Check your old password.");
        }
    };

    if (isLoading) {
        return <div className="profile-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>Loading Profile...</div>;
    }

    return (
        <div className="profile-container">
            <header className="profile-header">
                <div className="profile-avatar-wrapper">
                    <div className="profile-avatar-large" onClick={handleAvatarClick} style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            (profile?.displayName?.[0] || user?.username?.[0] || 'U').toUpperCase()
                        )}
                        <div className="avatar-overlay">
                            {isUploading ? <span style={{ color: 'white', fontSize: '0.8rem' }}>...</span> : <Camera size={24} color="white" />}
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarChange}
                        accept="image/*"
                        style={{ display: 'none' }}
                    />
                </div>

                {isEditing ? (
                    <div className="name-edit-container">
                        <input
                            className="name-edit-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                        />
                        <div className="name-edit-actions">
                            <button className="icon-btn save" onClick={handleSave}><Save size={20} /></button>
                            <button className="icon-btn cancel" onClick={() => setIsEditing(false)}><X size={20} /></button>
                        </div>
                    </div>
                ) : (
                    <div className="name-display-container">
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Displayed Name: </span> <br />
                        <h1 className="profile-title">{profile?.displayName || user?.username}</h1>
                        <button className="icon-btn edit" onClick={() => setIsEditing(true)}><Edit2 size={18} /></button>
                    </div>
                )}

                <p className="profile-email">{profile?.email || 'Personal Account'}</p>
            </header>

            <section className="profile-section">
                <h2 className="section-title">
                    <User size={24} />
                    Account Information
                </h2>
                <div className="info-grid">
                    <div className="info-item">
                        <span className="info-label">Current Plan</span>
                        <span className={`plan-badge ${profile?.plan?.toLowerCase()}`}>
                            {profile?.plan || 'FREE'}
                        </span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Storage Used</span>
                        <div className="storage-usage-container">
                            <span className="info-value">{formatBytes(profile?.storageUsed || 0)} / {formatBytes(storageLimit)}</span>
                            <div className="profile-storage-bar">
                                <div
                                    className={`profile-storage-progress storage-${storageStatus}`}
                                    style={{ width: `${storagePercentage}%` }}
                                ></div>
                            </div>
                            <div className="storage-details">
                                <span>{storagePercentage}% used</span>
                                <span className={`storage-status-badge storage-${storageStatus}`}>
                                    {storageStatus === 'critical' ? 'Almost Full' : storageStatus === 'warning' ? 'Getting Full' : 'Healthy'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="info-item">
                        <span className="info-label">User ID</span>
                        <span className="info-value" style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                            {user?.userId || 'Not available'}
                        </span>
                    </div>
                </div>
            </section>

            <section className="profile-section">
                <h2 className="section-title">
                    <Shield size={24} />
                    Security
                </h2>
                <div className="info-grid">
                    <div className="info-item">
                        <span className="info-label">Email Verified</span>
                        <span className="info-value">Yes</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Password</span>
                        <div className="info-value-row">
                            <span className="info-value" style={{ letterSpacing: '3px' }}>••••••••</span>
                            <button className="icon-btn" onClick={() => setIsChangingPassword(true)} title="Change Password">
                                <Edit2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="profile-section danger-zone">
                <h2 className="section-title danger-title">
                    <Trash2 size={24} />
                    Danger Zone
                </h2>
                <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                    Deleting your account is permanent. All your files and data will be wiped immediately.
                    This action cannot be undone.
                </p>
                <button
                    className="delete-account-btn"
                    onClick={onDeleteAccount}
                    disabled={isDeleting}
                >
                    <Trash2 size={20} />
                    {isDeleting ? 'Deleting Account...' : 'Delete Account'}
                </button>
            </section>

            {/* Password Change Modal */}
            {isChangingPassword && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Change Password</h3>
                            <button className="modal-close-btn" onClick={() => setIsChangingPassword(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handlePasswordUpdate} className="password-form">
                            <div className="form-group">
                                <label>Current Password</label>
                                <div className="input-with-icon">
                                    <Key size={16} />
                                    <input
                                        type="password"
                                        value={passwordData.oldPassword}
                                        onChange={e => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                        required
                                        placeholder="Current Password"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>New Password</label>
                                <div className="input-with-icon">
                                    <Lock size={16} />
                                    <input
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        required
                                        minLength={8}
                                        placeholder="Min 8 characters"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Confirm New Password</label>
                                <div className="input-with-icon">
                                    <Lock size={16} />
                                    <input
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        required
                                        placeholder="Confirm New Password"
                                    />
                                </div>
                            </div>

                            {passwordError && <p className="error-msg">{passwordError}</p>}
                            {passwordSuccess && <p className="success-msg">{passwordSuccess}</p>}

                            <button type="submit" className="submit-btn">Update Password</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
