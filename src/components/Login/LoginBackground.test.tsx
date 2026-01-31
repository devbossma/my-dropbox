import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginBackground from './LoginBackground';

// Mock assets
vi.mock('../../assets/cloud-regular-full.svg', () => ({ default: 'cloud-regular.svg' }));
vi.mock('../../assets/cloud-solid-full.svg', () => ({ default: 'cloud-solid.svg' }));

describe('LoginBackground', () => {
    it('renders the background container and clouds', () => {
        const { container } = render(<LoginBackground />);

        expect(container.querySelector('.login-animation-container')).toBeInTheDocument();
        expect(container.querySelector('.clouds-layer')).toBeInTheDocument();
        expect(container.querySelector('.sky-gradient')).toBeInTheDocument();

        const clouds = container.querySelectorAll('.cloud');
        expect(clouds.length).toBe(8);
    });
});
