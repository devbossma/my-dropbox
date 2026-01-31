import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Header from './Header';
import { getOrCreateProfile } from '../../utils/profileUtils';
import { getUrl } from 'aws-amplify/storage';

// Mock FontAwesome
vi.mock('@fortawesome/react-fontawesome', () => ({
    FontAwesomeIcon: () => <span data-testid="fa-icon" />,
}));
vi.mock('@fortawesome/free-solid-svg-icons', () => ({
    faParachuteBox: {},
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
    ChevronDown: () => <span data-testid="chevron-down" />,
    LogOut: () => <span data-testid="logout-icon" />,
    User: () => <span data-testid="user-icon" />,
    Menu: () => <span data-testid="menu-icon" />,
}));

// Mock utils and Amplify
vi.mock('../../utils/profileUtils', () => ({
    getOrCreateProfile: vi.fn(),
}));

vi.mock('aws-amplify/storage', () => ({
    getUrl: vi.fn(),
}));

describe('Header', () => {
    const mockUser = {
        username: 'testuser',
        signInDetails: { loginId: 'test@example.com' }
    };

    const defaultProps = {
        user: mockUser,
        signOut: vi.fn(),
        onToggleSidebar: vi.fn(),
        onViewChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (getOrCreateProfile as any).mockResolvedValue({
            displayName: 'Test User',
            email: 'test@example.com',
            avatarUrl: null
        });
    });

    it('renders logo and mobile menu toggle', async () => {
        await act(async () => {
            render(<Header {...defaultProps} />);
        });

        expect(screen.getByText('MyDropBox')).toBeInTheDocument();
        expect(screen.getByTestId('menu-icon')).toBeInTheDocument();
    });

    it('displays user display name from profile', async () => {
        await act(async () => {
            render(<Header {...defaultProps} />);
        });

        expect(await screen.findByText('Test User')).toBeInTheDocument();
    });

    it('toggles dropdown menu on click', async () => {
        await act(async () => {
            render(<Header {...defaultProps} />);
        });

        const trigger = screen.getByRole('button', { name: /Test User/i });

        await act(async () => {
            fireEvent.click(trigger);
        });

        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('Profile & Settings')).toBeInTheDocument();
        expect(screen.getByText('Sign out')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(trigger);
        });

        expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
    });

    it('calls signOut when sign out clicked', async () => {
        await act(async () => {
            render(<Header {...defaultProps} />);
        });

        const trigger = screen.getByRole('button', { name: /Test User/i });
        await act(async () => {
            fireEvent.click(trigger);
        });

        const signOutBtn = screen.getByText('Sign out');
        fireEvent.click(signOutBtn);

        expect(defaultProps.signOut).toHaveBeenCalled();
    });

    it('calls onViewChange when Profile clicked', async () => {
        await act(async () => {
            render(<Header {...defaultProps} />);
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Test User/i }));
        });

        const profileBtn = screen.getByText('Profile & Settings');
        fireEvent.click(profileBtn);

        expect(defaultProps.onViewChange).toHaveBeenCalledWith('profile');
    });

    it('calls onToggleSidebar when menu toggle clicked', async () => {
        await act(async () => {
            render(<Header {...defaultProps} />);
        });

        const toggleBtn = screen.getByTestId('menu-icon').closest('button');
        fireEvent.click(toggleBtn!);

        expect(defaultProps.onToggleSidebar).toHaveBeenCalled();
    });

    it('handles avatar url resolution', async () => {
        (getOrCreateProfile as any).mockResolvedValue({
            displayName: 'Test User',
            avatarUrl: 'avatars/test.jpg'
        });
        (getUrl as any).mockResolvedValue({ url: new URL('http://example.com/avatar.jpg') });

        await act(async () => {
            render(<Header {...defaultProps} />);
        });

        const avatarImg = await screen.findByAltText('Avatar');
        expect(avatarImg).toHaveAttribute('src', 'http://example.com/avatar.jpg');
    });
});
