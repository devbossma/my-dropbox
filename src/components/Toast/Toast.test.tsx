import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider, useToast } from './Toast';

const TestComponent = ({ message, type }: { message: string, type?: string }) => {
    const { showToast } = useToast();
    return (
        <button onClick={() => showToast(message, type as any)}>Show Toast</button>
    );
};

describe('Toast', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders children correctly', () => {
        render(
            <ToastProvider>
                <div data-testid="child">Child Content</div>
            </ToastProvider>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('shows and auto-removes a toast', async () => {
        render(
            <ToastProvider>
                <TestComponent message="Test Toast" type="success" />
            </ToastProvider>
        );

        const btn = screen.getByText('Show Toast');
        fireEvent.click(btn);

        expect(screen.getByText('Test Toast')).toBeInTheDocument();
        expect(screen.getByText('Test Toast')).toHaveClass('toast-success');

        // Advance time by 3 seconds
        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(screen.queryByText('Test Toast')).not.toBeInTheDocument();
    });

    it('shows multiple toasts', async () => {
        render(
            <ToastProvider>
                <TestComponent message="Toast 1" />
                <TestComponent message="Toast 2" />
            </ToastProvider>
        );

        const btns = screen.getAllByText('Show Toast');
        fireEvent.click(btns[0]);
        fireEvent.click(btns[1]);

        expect(screen.getByText('Toast 1')).toBeInTheDocument();
        expect(screen.getByText('Toast 2')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Toast 2')).not.toBeInTheDocument();
    });

    it('throws error if useToast used outside provider', () => {
        // Suppress console.error for this expected error
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => render(<TestComponent message="error" />)).toThrow('useToast must be used within a ToastProvider');

        spy.mockRestore();
    });
});

import { fireEvent } from '@testing-library/react';
