import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShareModal from './ShareModal';

// Mock Amplify
vi.mock('aws-amplify/storage', () => ({
    copy: vi.fn(),
    getUrl: vi.fn(),
    uploadData: vi.fn(),
}));
vi.mock('aws-amplify/data', () => ({
    generateClient: () => ({
        models: {
            ShareLink: {
                create: vi.fn().mockResolvedValue({ data: { id: 'test-link-id' }, errors: null }),
            }
        }
    })
}));
// Mock UUID
vi.mock('uuid', () => ({ v4: () => 'uuid-123' }));
// Mock Bclrypt
vi.mock('bcryptjs', () => ({
    genSalt: vi.fn(),
    hash: vi.fn().mockResolvedValue('hashed-pass'),
}));

import { copy, getUrl, uploadData } from 'aws-amplify/storage';

describe('ShareModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        file: { id: 'f1', fileName: 'test.txt', s3Key: 'key/test.txt' }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (copy as any).mockResolvedValue({});
        (getUrl as any).mockResolvedValue({ url: new URL('http://blob') });
        (uploadData as any).mockReturnValue({ result: Promise.resolve() });
    });

    it('renders nothing when closed', () => {
        render(<ShareModal {...defaultProps} isOpen={false} />);
        expect(screen.queryByText(/Share "test.txt"/)).not.toBeInTheDocument();
    });

    it('renders and allows link generation', async () => {
        render(<ShareModal {...defaultProps} />);
        expect(screen.getByText(/Share "test.txt"/)).toBeInTheDocument();

        const generateBtn = screen.getByText('Generate Link');
        fireEvent.click(generateBtn);

        expect(screen.getByText(/Preparing file|Copying file/)).toBeInTheDocument();

        await waitFor(() => {
            expect(copy).toHaveBeenCalledWith(expect.objectContaining({
                source: { path: 'key/test.txt' }
            }));
        });

        await waitFor(() => {
            expect(screen.getByDisplayValue(/http:\/\/localhost:3000\/s\/test-link-id/)).toBeInTheDocument(); // window.location.origin might vary in test env
        });
    });

    it('handles copy failure with fallback', async () => {
        // Fail copy
        (copy as any).mockRejectedValueOnce(new Error('Copy failed'));
        // Success fallback
        (getUrl as any).mockResolvedValue({ url: 'http://fallback-url' });
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            blob: async () => new Blob(['content']),
        });

        render(<ShareModal {...defaultProps} />);
        const generateBtn = screen.getByText('Generate Link');
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(copy).toHaveBeenCalled();
        });

        // Wait for fallback
        await waitFor(() => {
            expect(getUrl).toHaveBeenCalled();
            expect(uploadData).toHaveBeenCalled();
        });
    });
});
