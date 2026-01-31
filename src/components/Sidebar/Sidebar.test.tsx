import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Sidebar from './Sidebar';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    Files: () => <span data-testid="files-icon" />,
    Clock: () => <span data-testid="clock-icon" />,
    Star: () => <span data-testid="star-icon" />,
    Trash2: () => <span data-testid="trash-icon" />,
    Cloud: () => <span data-testid="cloud-icon" />,
    Settings: () => <span data-testid="settings-icon" />,
    Users: () => <span data-testid="users-icon" />,
    HardDrive: () => <span data-testid="hard-drive-icon" />
}));

describe('Sidebar', () => {
    const defaultProps = {
        storageUsed: '1.5 GB',
        storageTotal: '20 GB',
        storagePercentage: 7.5,
        storageStatus: 'healthy' as const,
        isOpen: true,
        onClose: vi.fn(),
        currentView: 'files' as const,
        onViewChange: vi.fn(),
    };

    afterEach(() => {
        vi.clearAllMocks();
        // Reset window.innerWidth if it was modified
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    });

    it('renders all navigation items', () => {
        render(<Sidebar {...defaultProps} />);

        expect(screen.getByText('All Files')).toBeInTheDocument();
        expect(screen.getByText('Recent')).toBeInTheDocument();
        expect(screen.getByText('Starred')).toBeInTheDocument();
        expect(screen.getByText('Trash')).toBeInTheDocument();
        expect(screen.getByText('Shared with me')).toBeInTheDocument();
        expect(screen.getByText('File requests')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('displays storage information correctly', () => {
        render(<Sidebar {...defaultProps} />);

        expect(screen.getByText('1.5 GB / 20 GB')).toBeInTheDocument();
        const progressBar = document.querySelector('.storage-progress');
        expect(progressBar).toHaveStyle({ width: '7.5%' });
        expect(progressBar).toHaveClass('storage-healthy');
    });

    it('calls onViewChange and handles mobile close', () => {
        Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });

        render(<Sidebar {...defaultProps} />);

        const settingsBtn = screen.getByText('Settings').closest('button');
        fireEvent.click(settingsBtn!);

        expect(defaultProps.onViewChange).toHaveBeenCalledWith('profile');
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('does not call onClose on desktop view change', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

        render(<Sidebar {...defaultProps} />);

        const settingsBtn = screen.getByText('Settings').closest('button');
        fireEvent.click(settingsBtn!);

        expect(defaultProps.onViewChange).toHaveBeenCalledWith('profile');
        expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('handles overlay click to close', () => {
        render(<Sidebar {...defaultProps} />);

        const overlay = document.querySelector('.sidebar-overlay');
        expect(overlay).toBeInTheDocument();
        fireEvent.click(overlay!);

        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('applies open class when isOpen is true', () => {
        const { container } = render(<Sidebar {...defaultProps} />);
        expect(container.querySelector('.sidebar')).toHaveClass('open');
    });

    it('does not apply open class when isOpen is false', () => {
        const { container } = render(<Sidebar {...defaultProps} isOpen={false} />);
        expect(container.querySelector('.sidebar')).not.toHaveClass('open');
        expect(container.querySelector('.sidebar-overlay')).not.toBeInTheDocument();
    });
});
