import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FilePreviewModal from './FilePreviewModal';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    X: () => <span data-testid="close-icon" />,
    Download: () => <span data-testid="download-icon" />,
    FileText: () => <span data-testid="file-text-icon" />,
    Music: () => <span data-testid="music-icon" />,
    File: () => <span data-testid="file-icon" />,
    ExternalLink: () => <span data-testid="external-link-icon" />
}));

describe('FilePreviewModal', () => {
    const mockFile = {
        id: '1',
        fileName: 'test-image.jpg',
        fileSize: 1024 * 1024 // 1 MB
    };

    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        file: mockFile,
        fileUrl: 'http://example.com/test.jpg',
        onDownload: vi.fn()
    };

    it('renders nothing when closed', () => {
        render(<FilePreviewModal {...defaultProps} isOpen={false} />);
        expect(screen.queryByText(/test-image.jpg/i)).not.toBeInTheDocument();
    });

    it('renders image preview correctly', () => {
        render(<FilePreviewModal {...defaultProps} />);
        expect(screen.getByText(/test-image.jpg/i)).toBeInTheDocument();
        expect(screen.getByText(/1.00 MB/i)).toBeInTheDocument();
        const img = screen.getByAltText('test-image.jpg');
        expect(img).toHaveAttribute('src', 'http://example.com/test.jpg');
    });

    it('renders video preview correctly', () => {
        const videoFile = { ...mockFile, fileName: 'test-video.mp4' };
        const { container } = render(<FilePreviewModal {...defaultProps} file={videoFile} />);
        const videoElement = container.querySelector('video');
        expect(videoElement).toBeInTheDocument();
        expect(videoElement).toHaveAttribute('src', defaultProps.fileUrl);
    });

    it('renders audio preview correctly', () => {
        const audioFile = { ...mockFile, fileName: 'test-audio.mp3' };
        render(<FilePreviewModal {...defaultProps} file={audioFile} />);
        expect(screen.getByTestId('music-icon')).toBeInTheDocument();
        const audioElement = document.querySelector('audio');
        expect(audioElement).toBeInTheDocument();
        expect(audioElement).toHaveAttribute('src', defaultProps.fileUrl);
    });

    it('renders pdf preview correctly', () => {
        const pdfFile = { ...mockFile, fileName: 'test.pdf' };
        render(<FilePreviewModal {...defaultProps} file={pdfFile} />);
        const iframe = screen.getByTitle('PDF Preview');
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('src', defaultProps.fileUrl);
    });

    it('renders text preview correctly', () => {
        const textFile = { ...mockFile, fileName: 'test.txt' };
        render(<FilePreviewModal {...defaultProps} file={textFile} />);
        const iframe = screen.getByTitle('Text Preview');
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('src', defaultProps.fileUrl);
    });

    it('renders unsupported message for unknown types', () => {
        const unknownFile = { ...mockFile, fileName: 'test.unknown' };
        render(<FilePreviewModal {...defaultProps} file={unknownFile} />);
        expect(screen.getByText(/No preview available/i)).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', () => {
        render(<FilePreviewModal {...defaultProps} />);
        const closeBtn = screen.getByTitle(/Close/i);
        fireEvent.click(closeBtn);
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onDownload when download button clicked', () => {
        render(<FilePreviewModal {...defaultProps} />);
        const downloadBtn = screen.getByTitle(/Download/i);
        fireEvent.click(downloadBtn);
        expect(defaultProps.onDownload).toHaveBeenCalled();
    });
});
