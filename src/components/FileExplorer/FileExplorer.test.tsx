import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FileExplorer from './FileExplorer';

// Mock FontAwesome to avoid icon rendering issues if any
vi.mock('@fortawesome/react-fontawesome', () => ({
    FontAwesomeIcon: () => <span data-testid="fa-icon" />,
}));
vi.mock('lucide-react', () => ({
    Trash2: () => <span data-testid="trash-icon" />,
    Download: () => <span data-testid="download-icon" />,
    Edit2: () => <span data-testid="edit-icon" />,
    Search: () => <span data-testid="search-icon" />,
    ChevronDown: () => <span data-testid="chevron-icon" />,
    Eye: () => <span data-testid="eye-icon" />,
    Link: () => <span data-testid="link-icon" />,
    FolderPlus: () => <span data-testid="folder-plus-icon" />,
    Home: () => <span data-testid="home-icon" />,
    ChevronRight: () => <span data-testid="chevron-right-icon" />,
}));

// Mock Data
const mockFolders = [
    { id: 'f1', name: 'Folder A', path: 'Folder A', parentFolderId: 'root', createdAt: '', updatedAt: '' },
    { id: 'f2', name: 'Folder B', path: 'Folder B', parentFolderId: 'root', createdAt: '', updatedAt: '' },
];
const mockFiles = [
    { id: 'fi1', fileName: 'File 1.txt', fileSize: 1024, s3Key: 'k1', mimeType: 'text/plain', folderId: 'root', createdAt: '', updatedAt: '' },
    { id: 'fi2', fileName: 'File 2.png', fileSize: 2048, s3Key: 'k2', mimeType: 'image/png', folderId: 'root', createdAt: '', updatedAt: '' },
];
const mockFolderSizes = { 'f1': 500 };

describe('FileExplorer', () => {
    const defaultProps = {
        files: mockFiles,
        folders: mockFolders,
        folderSizes: mockFolderSizes,
        onNavigate: vi.fn(),
        onDeleteFile: vi.fn(),
        onDeleteFolder: vi.fn(),
        onRenameFolder: vi.fn(),
        onDownload: vi.fn(),
        onRenameFile: vi.fn(),
        folderName: 'Home',
        onPreview: vi.fn(),
        onShare: vi.fn(),
        onBulkDelete: vi.fn(),
    };

    it('renders folders and files', () => {
        render(<FileExplorer {...defaultProps} />);
        expect(screen.getByText('Folder A')).toBeInTheDocument();
        expect(screen.getByText('File 1.txt')).toBeInTheDocument();
    });

    it('filters items based on search', () => {
        render(<FileExplorer {...defaultProps} />);
        const searchInput = screen.getByPlaceholderText('Search');
        fireEvent.change(searchInput, { target: { value: 'Folder A' } });

        expect(screen.getByText('Folder A')).toBeInTheDocument();
        expect(screen.queryByText('Folder B')).not.toBeInTheDocument();
        expect(screen.queryByText('File 1.txt')).not.toBeInTheDocument();
    });

    it('handles navigation click', () => {
        render(<FileExplorer {...defaultProps} />);
        const folderA = screen.getByText('Folder A').closest('.grid-item');
        fireEvent.click(folderA!);
        expect(defaultProps.onNavigate).toHaveBeenCalledWith(mockFolders[0]);
    });

    it('handles selection and bulk delete visibility', () => {
        render(<FileExplorer {...defaultProps} />);

        // Ensure bulk delete is hidden initially
        expect(screen.queryByText(/Delete \(/)).not.toBeInTheDocument();

        // Select Folder A
        // The checkbox is inside the grid item (Folder)
        const folderItems = screen.getAllByRole('checkbox');
        // Note: Checkboxes are hidden (opacity 0) but exist in DOM.
        // We can simulate click on the checkbox div wrapper or the input itself.

        const checkboxWrapper = folderItems[0].closest('.selection-checkbox');
        fireEvent.click(checkboxWrapper!);

        // Bulk delete should appear
        expect(screen.getByText('Delete (1)')).toBeInTheDocument();

        // Call Bulk Delete
        const bulkBtn = screen.getByText('Delete (1)');
        fireEvent.click(bulkBtn);
        expect(defaultProps.onBulkDelete).toHaveBeenCalledTimes(1);
    });
});
