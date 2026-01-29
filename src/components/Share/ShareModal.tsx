import React, { useState } from 'react';
import { X, Link as LinkIcon, Lock, Calendar, Copy, Check, Shield, Loader2 } from 'lucide-react';
import { generateClient } from 'aws-amplify/data';
import { copy, getUrl, uploadData } from 'aws-amplify/storage';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { Schema } from '../../../amplify/data/resource';
import './ShareModal.css';

const client = generateClient<Schema>();

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    file: {
        id: string;
        fileName: string;
        s3Key: string;
    } | null;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, file }) => {
    const [isPasswordProtected, setIsPasswordProtected] = useState(false);
    const [password, setPassword] = useState('');
    const [hasExpiration, setHasExpiration] = useState(false);
    const [expirationDate, setExpirationDate] = useState('');
    const [generatedLink, setGeneratedLink] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [copied, setCopied] = useState(false);

    if (!isOpen || !file) return null;

    const handleGenerateLink = async () => {
        setIsLoading(true);
        setStatusMessage('Preparing file for sharing...');

        try {
            // Generate a unique ID for this share link
            const shareId = uuidv4();

            // Create the public shared file path
            const sharedS3Key = `shared-files/${shareId}/${file.fileName}`;

            setStatusMessage('Copying file to shared location...');

            // Copy the file from private to public path
            try {
                await copy({
                    source: { path: file.s3Key },
                    destination: { path: sharedS3Key }
                });
            } catch (copyError) {
                console.warn("Direct copy failed, attempting manual download/upload...", copyError);

                try {
                    // Fallback: Download then Upload
                    const link = await getUrl({ path: file.s3Key });
                    const response = await fetch(link.url);
                    if (!response.ok) throw new Error('Failed to download source file');
                    const blob = await response.blob();

                    await uploadData({
                        path: sharedS3Key,
                        data: blob,
                        options: {
                            metadata: {
                                originalName: file.fileName,
                                shareId: shareId
                            }
                        }
                    }).result;

                } catch (fallbackError: any) {
                    console.error("Fallback copy failed:", fallbackError);
                    alert(`Failed to prepare file for sharing. Details: ${fallbackError.message || JSON.stringify(fallbackError)}`);
                    setIsLoading(false);
                    return;
                }
            }

            setStatusMessage('Creating share link...');

            // Hash password if needed
            let passwordHash = undefined;
            if (isPasswordProtected && password) {
                const salt = await bcrypt.genSalt(10);
                passwordHash = await bcrypt.hash(password, salt);
            }

            // Set expiration if needed
            let expiresAt = undefined;
            if (hasExpiration && expirationDate) {
                expiresAt = new Date(expirationDate).toISOString();
            }

            // Create ShareLink record with the PUBLIC s3Key
            const { data: newLink, errors } = await client.models.ShareLink.create({
                fileId: file.id,
                fileName: file.fileName,
                s3Key: sharedS3Key, // Use the PUBLIC path, not the private one
                passwordHash,
                expiresAt
            });

            if (errors) {
                console.error("Share creation errors", errors);
                alert("Failed to create share link");
                return;
            }

            if (newLink) {
                const link = `${window.location.origin}/s/${newLink.id}`;
                setGeneratedLink(link);
                setStatusMessage('');
            }
        } catch (e) {
            console.error("Failed to generate link", e);
            alert("An error occurred.");
        } finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const reset = () => {
        setGeneratedLink('');
        setPassword('');
        setIsPasswordProtected(false);
        setHasExpiration(false);
        setExpirationDate('');
        setStatusMessage('');
        onClose();
    };

    return (
        <div className="share-modal-overlay" onClick={reset}>
            <div className="share-modal-content" onClick={e => e.stopPropagation()}>
                <div className="share-header">
                    <h2><LinkIcon size={24} /> Share "{file.fileName}"</h2>
                    <button className="icon-btn" onClick={reset}><X size={24} /></button>
                </div>

                {!generatedLink ? (
                    <div className="share-form">
                        <div className="share-option">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={isPasswordProtected}
                                    onChange={e => setIsPasswordProtected(e.target.checked)}
                                    disabled={isLoading}
                                />
                                <Lock size={18} />
                                Password Protection
                            </label>
                            {isPasswordProtected && (
                                <div className="option-input-wrapper">
                                    <input
                                        type="password"
                                        className="share-input"
                                        placeholder="Set a password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="share-option">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={hasExpiration}
                                    onChange={e => setHasExpiration(e.target.checked)}
                                    disabled={isLoading}
                                />
                                <Calendar size={18} />
                                Expiration Date
                            </label>
                            {hasExpiration && (
                                <div className="option-input-wrapper">
                                    <input
                                        type="datetime-local"
                                        className="share-input"
                                        value={expirationDate}
                                        onChange={e => setExpirationDate(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            )}
                        </div>

                        {statusMessage && (
                            <div className="status-message">
                                <Loader2 size={16} className="spinner-inline" />
                                {statusMessage}
                            </div>
                        )}

                        <button
                            className="generate-btn"
                            onClick={handleGenerateLink}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Generating...' : 'Generate Link'}
                            {!isLoading && <Shield size={18} />}
                        </button>
                    </div>
                ) : (
                    <div className="link-result">
                        <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-secondary)' }}>Link generated successfully:</p>
                        <div className="link-display">
                            <input readOnly value={generatedLink} />
                            <button className="copy-btn" onClick={copyToClipboard}>
                                {copied ? <Check size={18} color="#22c55e" /> : <Copy size={18} />}
                            </button>
                        </div>
                        <button className="generate-btn" onClick={reset}>Done</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShareModal;
