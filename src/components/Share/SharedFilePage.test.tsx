import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import SharedFilePage from './SharedFilePage';
import { useParams } from 'react-router-dom';
import { getUrl } from 'aws-amplify/storage';
import * as bcrypt from 'bcryptjs';

// Mock router
vi.mock('react-router-dom', () => ({
    useParams: vi.fn(),
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
    compare: vi.fn(),
}));

// Mock Amplify
const { mockClient } = vi.hoisted(() => ({
    mockClient: {
        models: {
            ShareLink: {
                get: vi.fn(),
                update: vi.fn(),
            }
        }
    }
}));

vi.mock('aws-amplify/data', () => ({
    generateClient: vi.fn(() => mockClient)
}));

vi.mock('aws-amplify/storage', () => ({
    getUrl: vi.fn(),
}));

// Mock icons
vi.mock('lucide-react', () => ({
    Download: () => <span data-testid="download-icon" />,
    Lock: () => <span data-testid="lock-icon" />,
    File: () => <span data-testid="file-icon" />,
    Shield: () => <span data-testid="shield-icon" />,
    XCircle: () => <span data-testid="error-icon" />,
    Loader2: () => <span data-testid="spinner-icon" />,
    AlertCircle: () => <span data-testid="alert-icon" />,
}));

describe('SharedFilePage', () => {
    const mockLinkId = 'test-link-id';

    beforeEach(() => {
        vi.clearAllMocks();
        (useParams as unknown as Mock).mockReturnValue({ linkId: mockLinkId });
    });

    it('renders loading state initially', async () => {
        mockClient.models.ShareLink.get.mockReturnValue(new Promise(() => { })); // Never resolves
        render(<SharedFilePage />);
        expect(screen.getByTestId('spinner-icon')).toBeInTheDocument();
    });

    it('renders error if link not found', async () => {
        mockClient.models.ShareLink.get.mockResolvedValue({ data: null, errors: [{ message: 'Not found' }] });
        render(<SharedFilePage />);
        expect(await screen.findByText('Unavailable')).toBeInTheDocument();
        expect(screen.getByText('Link not found or has been removed.')).toBeInTheDocument();
    });

    it('renders file info for public link', async () => {
        mockClient.models.ShareLink.get.mockResolvedValue({
            data: {
                id: mockLinkId,
                fileName: 'public-file.txt',
                s3Key: 'path/to/file.txt',
                passwordHash: null,
                expiresAt: null
            }
        });

        render(<SharedFilePage />);
        expect(await screen.findByText('public-file.txt')).toBeInTheDocument();
        expect(screen.getByText('Download File')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Enter password')).not.toBeInTheDocument();
    });

    it('requires password for protected link', async () => {
        mockClient.models.ShareLink.get.mockResolvedValue({
            data: {
                id: mockLinkId,
                fileName: 'protected-file.txt',
                s3Key: 'path/to/file.txt',
                passwordHash: 'hashed-password',
                expiresAt: null
            }
        });

        render(<SharedFilePage />);
        expect(await screen.findByText('protected-file.txt')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
    });

    it('handles successful access with password', async () => {
        mockClient.models.ShareLink.get.mockResolvedValue({
            data: {
                id: mockLinkId,
                fileName: 'protected-file.txt',
                s3Key: 'path/to/file.txt',
                passwordHash: 'hashed-password',
                expiresAt: null,
                visitCount: 5
            }
        });
        (bcrypt.compare as any).mockResolvedValue(true);
        (getUrl as any).mockResolvedValue({ url: new URL('http://example.com/download') });
        mockClient.models.ShareLink.update.mockResolvedValue({ data: {} });

        render(<SharedFilePage />);

        const passwordInput = await screen.findByPlaceholderText('Enter password');
        fireEvent.change(passwordInput, { target: { value: 'correct-password' } });

        const downloadBtn = screen.getByText('Download File');
        await act(async () => {
            fireEvent.click(downloadBtn);
        });

        expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', 'hashed-password');
        expect(mockClient.models.ShareLink.update).toHaveBeenCalledWith(expect.objectContaining({
            visitCount: 6
        }));
        expect(screen.getByText('Download Started!')).toBeInTheDocument();
    });

    it('handles incorrect password', async () => {
        mockClient.models.ShareLink.get.mockResolvedValue({
            data: {
                id: mockLinkId,
                fileName: 'protected-file.txt',
                passwordHash: 'hashed-password'
            }
        });
        (bcrypt.compare as any).mockResolvedValue(false);

        render(<SharedFilePage />);

        const passwordInput = await screen.findByPlaceholderText('Enter password');
        fireEvent.change(passwordInput, { target: { value: 'wrong-password' } });

        const downloadBtn = screen.getByText('Download File');
        await act(async () => {
            fireEvent.click(downloadBtn);
        });

        expect(screen.getByText('Incorrect password.')).toBeInTheDocument();
        expect(screen.queryByText('Download Started!')).not.toBeInTheDocument();
    });

    it('shows error for expired link', async () => {
        const expiredDate = new Date(Date.now() - 10000).toISOString();
        mockClient.models.ShareLink.get.mockResolvedValue({
            data: {
                id: mockLinkId,
                expiresAt: expiredDate
            }
        });

        render(<SharedFilePage />);
        expect(await screen.findByText('This link has expired.')).toBeInTheDocument();
    });
});
