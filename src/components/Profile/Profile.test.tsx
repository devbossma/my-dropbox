import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Profile from './Profile';
import { getOrCreateProfile } from '../../utils/profileUtils';
import { updatePassword, fetchAuthSession } from 'aws-amplify/auth';
import { uploadData, getUrl } from 'aws-amplify/storage';

// Use vi.hoisted for early mock registration
const { mockClient } = vi.hoisted(() => ({
    mockClient: {
        models: {
            UserProfile: {
                list: vi.fn(),
                update: vi.fn(),
                get: vi.fn(),
            }
        }
    }
}));

vi.mock('aws-amplify/data', () => ({
    generateClient: vi.fn(() => mockClient)
}));

vi.mock('aws-amplify/auth', () => ({
    updatePassword: vi.fn(),
    fetchAuthSession: vi.fn()
}));

vi.mock('aws-amplify/storage', () => ({
    uploadData: vi.fn(),
    getUrl: vi.fn()
}));

vi.mock('../../utils/profileUtils', () => ({
    getOrCreateProfile: vi.fn()
}));

// Mock icons
vi.mock('lucide-react', () => ({
    User: () => <span data-testid="user-icon" />,
    Shield: () => <span data-testid="shield-icon" />,
    Trash2: () => <span data-testid="trash-icon" />,
    Edit2: () => <span data-testid="edit-icon" />,
    Save: () => <span data-testid="save-icon" />,
    X: () => <span data-testid="close-icon" />,
    Key: () => <span data-testid="key-icon" />,
    Lock: () => <span data-testid="lock-icon" />,
    Camera: () => <span data-testid="camera-icon" />
}));

describe('Profile', () => {
    const mockUser = {
        username: 'testuser',
        userId: 'user-123',
        signInDetails: { loginId: 'test@example.com' }
    };

    const defaultProps = {
        user: mockUser,
        onDeleteAccount: vi.fn(),
        isDeleting: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (getOrCreateProfile as any).mockResolvedValue({
            id: 'profile-1',
            displayName: 'Test User',
            email: 'test@example.com',
            plan: 'FREE',
            storageUsed: 1024 * 1024,
            avatarUrl: null
        });
        (fetchAuthSession as any).mockResolvedValue({ identityId: 'test-identity-id' });
    });

    it('renders profile information correctly', async () => {
        await act(async () => {
            render(<Profile {...defaultProps} />);
        });

        expect(await screen.findByRole('heading', { level: 1, name: /Test User/i })).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('FREE')).toBeInTheDocument();
        expect(screen.getByText('1 MB / 15 MB')).toBeInTheDocument();
    });

    it('handles display name editing', async () => {
        mockClient.models.UserProfile.update.mockResolvedValue({
            data: { id: 'profile-1', displayName: 'New Name' }
        });

        await act(async () => {
            render(<Profile {...defaultProps} />);
        });

        const editBtns = screen.getAllByTestId('edit-icon');
        fireEvent.click(editBtns[0].closest('button')!);

        const input = screen.getByDisplayValue('Test User');
        fireEvent.change(input, { target: { value: 'New Name' } });

        const saveBtn = screen.getByTestId('save-icon').closest('button');
        await act(async () => {
            fireEvent.click(saveBtn!);
        });

        expect(mockClient.models.UserProfile.update).toHaveBeenCalledWith(expect.objectContaining({
            displayName: 'New Name'
        }));
        expect(screen.getByText('New Name')).toBeInTheDocument();
    });

    it('opens password change modal and submits', async () => {
        (updatePassword as any).mockResolvedValue({});

        await act(async () => {
            render(<Profile {...defaultProps} />);
        });

        const changePasswordBtn = screen.getByTitle('Change Password');
        fireEvent.click(changePasswordBtn);

        expect(screen.getByText('Change Password')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Current Password'), { target: { value: 'old-pass' } });
        fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), { target: { value: 'new-password' } });
        fireEvent.change(screen.getByPlaceholderText('Confirm New Password'), { target: { value: 'new-password' } });

        const submitBtn = screen.getByText('Update Password');
        await act(async () => {
            fireEvent.submit(submitBtn.closest('form')!);
        });

        expect(updatePassword).toHaveBeenCalledWith({
            oldPassword: 'old-pass',
            newPassword: 'new-password'
        });
        expect(screen.getByText(/Password updated successfully/i)).toBeInTheDocument();
    });

    it('calls onDeleteAccount when delete button is clicked', async () => {
        await act(async () => {
            render(<Profile {...defaultProps} />);
        });

        const deleteBtn = screen.getByRole('button', { name: /Delete Account/i });
        fireEvent.click(deleteBtn);

        expect(defaultProps.onDeleteAccount).toHaveBeenCalled();
    });

    it('handles avatar upload', async () => {
        const mockResult = { result: Promise.resolve() };
        (uploadData as any).mockReturnValue(mockResult);
        (getUrl as any).mockResolvedValue({ url: new URL('http://example.com/new-avatar.jpg') });
        mockClient.models.UserProfile.update.mockResolvedValue({ data: {} });

        await act(async () => {
            render(<Profile {...defaultProps} />);
        });

        const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;

        await act(async () => {
            fireEvent.change(input, { target: { files: [file] } });
        });

        expect(uploadData).toHaveBeenCalled();
        expect(mockClient.models.UserProfile.update).toHaveBeenCalled();

        const avatarImg = await screen.findByAltText('Profile');
        expect(avatarImg).toHaveAttribute('src', 'http://example.com/new-avatar.jpg');
    });
});
