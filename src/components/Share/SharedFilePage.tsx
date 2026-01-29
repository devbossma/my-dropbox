import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { getUrl } from 'aws-amplify/storage';
import { Download, Lock, File as FileIcon, Shield, XCircle, Loader2, AlertCircle } from 'lucide-react';
import * as bcrypt from 'bcryptjs';
import type { Schema } from '../../../amplify/data/resource';
import './SharedFilePage.css';

const client = generateClient<Schema>({
    authMode: 'apiKey'
});

const SharedFilePage: React.FC = () => {
    const { linkId } = useParams<{ linkId: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [linkInfo, setLinkInfo] = useState<any>(null);
    const [password, setPassword] = useState('');
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [accessing, setAccessing] = useState(false);

    useEffect(() => {
        if (!linkId) {
            setError('Invalid link.');
            setLoading(false);
            return;
        }

        // Fetch Link Metadata (Public Read via API Key)
        client.models.ShareLink.get({ id: linkId }).then(({ data, errors }) => {
            if (errors || !data) {
                setError('Link not found or has been removed.');
            } else {
                // Check expiration
                if (data.expiresAt) {
                    const expiry = new Date(data.expiresAt);
                    if (new Date() > expiry) {
                        setError('This link has expired.');
                        return;
                    }
                }
                setLinkInfo(data);
            }
        }).catch(err => {
            console.error(err);
            setError('Failed to load link.');
        }).finally(() => {
            setLoading(false);
        });
    }, [linkId]);

    const handleAccess = async () => {
        if (!linkId || !linkInfo) return;
        setAccessing(true);
        setError(null);

        try {
            // Verify Password (client-side bcrypt compare)
            if (linkInfo.passwordHash) {
                if (!password) {
                    setError('Please enter the password.');
                    setAccessing(false);
                    return;
                }
                const match = await bcrypt.compare(password, linkInfo.passwordHash);
                if (!match) {
                    setError('Incorrect password.');
                    setAccessing(false);
                    return;
                }
            }

            // Increment visit count
            try {
                await client.models.ShareLink.update({
                    id: linkId,
                    visitCount: (linkInfo.visitCount || 0) + 1
                });
            } catch (e) {
                console.warn("Failed to update visit count", e);
            }

            // Get the S3 presigned URL
            // Note: For public access to work, the storage path needs guest access
            // Since owner files are private, we'll need a different approach
            // For now, show a message that download requires the owner to make it accessible

            // Try to get URL (this might fail if not publicly accessible)
            try {
                const urlResult = await getUrl({
                    path: linkInfo.s3Key,
                    options: {
                        expiresIn: 900 // 15 minutes
                    }
                });
                setDownloadUrl(urlResult.url.toString());
                // Auto-trigger download
                window.location.href = urlResult.url.toString();
            } catch (storageError) {
                console.error("Storage access error:", storageError);
                setError('File is not publicly accessible. The owner needs to enable sharing for this file.');
            }

        } catch (e: any) {
            console.error("Access failed", e);
            setError(e.message || "Failed to access file.");
        } finally {
            setAccessing(false);
        }
    };

    if (loading) {
        return (
            <div className="shared-page-container">
                <Loader2 className="spinner" size={48} />
                <p>Loading...</p>
            </div>
        );
    }

    if (error && !linkInfo) {
        return (
            <div className="shared-page-container">
                <div className="error-card">
                    <XCircle size={48} color="#ef4444" />
                    <h2>Unavailable</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="shared-page-container">
            <div className="shared-card">
                <div className="shared-header">
                    <div className="share-icon-circle">
                        <FileIcon size={32} color="var(--primary-color)" />
                    </div>
                    <h1>{linkInfo?.fileName}</h1>
                    <p className="shared-meta">Shared File</p>
                </div>

                {!downloadUrl ? (
                    <div className="shared-action-area">
                        {linkInfo?.passwordHash && (
                            <div className="password-section">
                                <label className="input-label"><Lock size={16} /> Password Required</label>
                                <input
                                    type="password"
                                    placeholder="Enter password"
                                    className="password-input"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAccess()}
                                />
                            </div>
                        )}

                        {error && (
                            <div className="error-msg">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <button className="access-btn" onClick={handleAccess} disabled={accessing}>
                            {accessing ? 'Verifying...' : 'Download File'}
                            {!accessing && <Download size={20} />}
                        </button>
                    </div>
                ) : (
                    <div className="success-area">
                        <Shield size={48} color="#22c55e" />
                        <h2>Download Started!</h2>
                        <p>If it didn't start, <a href={downloadUrl} className="retry-link">click here</a>.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SharedFilePage;
