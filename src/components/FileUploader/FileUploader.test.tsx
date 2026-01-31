import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import FileUploader from './FileUploader';
import { uploadData } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';

// Mock Amplify
vi.mock('aws-amplify/storage', () => ({
    uploadData: vi.fn()
}));

vi.mock('aws-amplify/auth', () => ({
    getCurrentUser: vi.fn()
}));

// Mock Toast
const mockShowToast = vi.fn();
vi.mock('../Toast/Toast', () => ({
    useToast: () => ({
        showToast: mockShowToast
    })
}));

// Mock icons
vi.mock('lucide-react', () => ({
    UploadCloud: () => <span data-testid="upload-icon" />
}));

describe('FileUploader', () => {
    const defaultProps = {
        currentPath: 'user-files/test-user/',
        currentFolderId: 'root',
        onUploadStart: vi.fn(),
        onUploadSuccess: vi.fn(),
        onProgress: vi.fn(),
        storageUsed: 0,
        storageLimit: 1024 * 1024 // 1 MB
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentUser as unknown as Mock).mockResolvedValue({ userId: 'test-user-id' });
    });

    it('renders correctly', () => {
        render(<FileUploader {...defaultProps} />);
        expect(screen.getByText(/Drag & drop files here/i)).toBeInTheDocument();
        expect(screen.getByTestId('upload-icon')).toBeInTheDocument();
    });

    it('handles file selection and upload', async () => {
        const mockResult = { result: Promise.resolve() };
        (uploadData as unknown as Mock).mockReturnValue(mockResult);

        render(<FileUploader {...defaultProps} />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;

        const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(defaultProps.onUploadStart).toHaveBeenCalled();
            expect(uploadData).toHaveBeenCalledWith(expect.objectContaining({
                path: 'user-files/test-user/hello.txt',
                data: file
            }));
        });

        await waitFor(() => {
            expect(defaultProps.onUploadSuccess).toHaveBeenCalled();
        });
    });

    it('prevents upload if not enough storage', async () => {
        // Setup props with full storage
        const props = { ...defaultProps, storageUsed: 1024 * 1024 };
        render(<FileUploader {...props} />);

        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['a'.repeat(100)], 'test.txt', { type: 'text/plain' });
        fireEvent.change(input, { target: { files: [file] } });

        expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Not enough storage'), 'error');
        expect(defaultProps.onUploadStart).not.toHaveBeenCalled();
    });

    it('handles drag interactions', () => {
        const { container } = render(<FileUploader {...defaultProps} />);
        const uploader = container.firstChild as HTMLElement;

        fireEvent.dragOver(uploader);
        expect(uploader).toHaveClass('dragging');

        fireEvent.dragLeave(uploader);
        expect(uploader).not.toHaveClass('dragging');

        const file = new File(['drop'], 'drop.txt', { type: 'text/plain' });
        const dropEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            dataTransfer: {
                files: [file]
            }
        };

        fireEvent.drop(uploader, dropEvent);
        expect(uploader).not.toHaveClass('dragging');
        expect(defaultProps.onUploadStart).toHaveBeenCalled();
    });
});
