import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FileManager from './FileManager';
import { fetchAuthSession } from 'aws-amplify/auth';

// Use vi.hoisted to create the mock object before vi.mock is processed
const { mockClient } = vi.hoisted(() => {
    return {
        mockClient: {
            models: {
                Folder: {
                    list: vi.fn(),
                    get: vi.fn(),
                    create: vi.fn(),
                    update: vi.fn(),
                    delete: vi.fn(),
                    observeQuery: vi.fn(),
                },
                FileMetadata: {
                    list: vi.fn(),
                    observeQuery: vi.fn(),
                    delete: vi.fn(),
                    update: vi.fn(),
                },
            },
        }
    };
});

// Mock Amplify
vi.mock('aws-amplify/data', () => ({
    generateClient: vi.fn(() => mockClient)
}));

vi.mock('aws-amplify/auth', () => ({
    fetchAuthSession: vi.fn()
}));

vi.mock('aws-amplify/storage', () => ({
    getUrl: vi.fn()
}));

// Mock components
vi.mock('../FileExplorer/FileExplorer', () => ({
    default: ({ folderName }: { folderName: string }) => <div data-testid="file-explorer">{folderName || 'Home'}</div>
}));

vi.mock('../FileUploader/FileUploader', () => ({
    default: () => <div data-testid="file-uploader" />
}));

vi.mock('../FilePreview/FilePreviewModal', () => ({
    default: () => <div data-testid="preview-modal" />
}));

vi.mock('../Share/ShareModal', () => ({
    default: () => <div data-testid="share-modal" />
}));

// Mock icons
vi.mock('lucide-react', () => ({
    FolderPlus: () => <span data-testid="folder-plus-icon" />,
    Home: () => <span data-testid="home-icon">Home</span>,
    ChevronRight: () => <span data-testid="chevron-right-icon" />
}));

// Mock Toast
vi.mock('../Toast/Toast', () => ({
    useToast: () => ({
        showToast: vi.fn()
    })
}));

describe('FileManager', () => {
    const defaultProps = {
        storageUsed: 0,
        storageLimit: 20 * 1024 * 1024 * 1024,
        onStorageChange: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default behaviors for each test
        mockClient.models.Folder.list.mockResolvedValue({ data: [] });
        mockClient.models.Folder.create.mockResolvedValue({ data: {} });
        mockClient.models.Folder.observeQuery.mockReturnValue({
            subscribe: vi.fn(({ next }) => {
                next({ items: [] });
                return { unsubscribe: vi.fn() };
            })
        });

        mockClient.models.FileMetadata.list.mockResolvedValue({ data: [] });
        mockClient.models.FileMetadata.observeQuery.mockReturnValue({
            subscribe: vi.fn(({ next }) => {
                next({ items: [] });
                return { unsubscribe: vi.fn() };
            })
        });

        (fetchAuthSession as any).mockResolvedValue({ identityId: 'test-user-id' });
    });

    it('renders loading session and then breadcrumbs', async () => {
        await act(async () => {
            render(<FileManager {...defaultProps} />);
        });

        const homeIcons = await screen.findAllByTestId('home-icon');
        expect(homeIcons.length).toBeGreaterThan(0);
        expect(screen.queryByText(/Initializing Session/i)).not.toBeInTheDocument();
    });

    it('renders sub-components after loading', async () => {
        await act(async () => {
            render(<FileManager {...defaultProps} />);
        });

        expect(await screen.findByTestId('file-explorer')).toBeInTheDocument();
        expect(screen.getByTestId('file-uploader')).toBeInTheDocument();
    });

    it('handles create folder flow', async () => {
        vi.spyOn(window, 'prompt').mockReturnValue('New Folder');

        await act(async () => {
            render(<FileManager {...defaultProps} />);
        });

        const createBtn = await screen.findByRole('button', { name: /New Folder/i });

        await act(async () => {
            fireEvent.click(createBtn);
        });

        expect(mockClient.models.Folder.create).toHaveBeenCalled();
    });
});
