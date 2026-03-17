import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn(() => '/');

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => mockPathname(),
    useSearchParams: () => new URLSearchParams({ rs: 'testRandomKey1', id: 'testId123' }),
}));

// Mock next/link as a simple anchor
vi.mock('next/link', () => ({
    default: ({ href, children, ...props }) =>
        React.createElement('a', { href, ...props }, children),
}));

import NewMessage from '../components/NewMessage';
import ShowNewLink from '../components/ShowNewLink';
import ViewSecretMessage from '../components/ViewSecretMessage';
import PasswordGenerator from '../components/PasswordGenerator';

beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/');
    global.fetch = vi.fn();
    window.scrollTo = vi.fn();
    Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: vi.fn().mockResolvedValue(undefined),
        },
    });
});

describe('NewMessage component', () => {
    it('renders the message form and reveals advanced options', async () => {
        const user = userEvent.setup();

        render(<NewMessage />);

        const submitButton = screen.getByRole('button', { name: /create secret link/i });
        expect(submitButton).toBeDisabled();

        await user.type(screen.getByLabelText(/your secret message/i), 'top secret');
        expect(submitButton).toBeEnabled();

        await user.click(screen.getByRole('button', { name: /options/i }));
        expect(screen.getByLabelText(/additional passphrase/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/self-destruct after/i)).toBeInTheDocument();
    });

    it('submits a new secret and navigates to the generated link page', async () => {
        const user = userEvent.setup();
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                status: 'ok',
                newId: 'abc123',
            }),
        });

        render(<NewMessage />);

        await user.type(screen.getByLabelText(/your secret message/i), 'ship it');
        await user.click(screen.getByRole('button', { name: /create secret link/i }));

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        expect(fetch).toHaveBeenCalledWith(
            '/api/saveSecret',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: expect.any(String),
            }),
        );

        const requestPayload = JSON.parse(fetch.mock.calls[0][1].body);
        expect(requestPayload).toEqual(expect.objectContaining({
            secretMessage: expect.any(String),
            hashedKey: expect.any(String),
            duration: 604800,
        }));

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith(
                expect.stringMatching(/\/new\?rs=.+&id=abc123/)
            );
        });
    });
});

describe('ShowNewLink component', () => {
    it('displays the generated link and auto-copies it', async () => {
        render(<ShowNewLink />);

        const linkInput = screen.getByLabelText(/secret one-time link/i);
        expect(linkInput).toBeInTheDocument();
        expect(linkInput.value).toContain('/v/#');
        expect(linkInput.value).toContain('testRandomKey1');
        expect(linkInput.value).toContain('testId123');

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /link already copied/i })).toBeInTheDocument();
        });
    });
});

describe('PasswordGenerator component', () => {
    it('renders with the correct preset for password-generator', () => {
        render(<PasswordGenerator presetPath="/password-generator" />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Password Generator');
        expect(screen.getByRole('button', { name: /share as link/i })).toBeInTheDocument();
    });

    it('creates a one-time link from the password generator and navigates', async () => {
        const user = userEvent.setup();
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                status: 'ok',
                newId: 'gen123',
            }),
        });

        render(<PasswordGenerator presetPath="/password-generator" />);

        await user.click(await screen.findByRole('button', { name: /share as link/i }));

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        expect(fetch).toHaveBeenCalledWith(
            '/api/saveSecret',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: expect.any(String),
            }),
        );

        const requestPayload = JSON.parse(fetch.mock.calls[0][1].body);
        expect(requestPayload).toEqual(expect.objectContaining({
            secretMessage: expect.any(String),
            hashedKey: expect.any(String),
            duration: 604800,
        }));

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith(
                expect.stringMatching(/\/new\?rs=.+&id=gen123/)
            );
        });
    });
});

describe('ViewSecretMessage component', () => {
    it('shows the pre-read state with decrypt button', () => {
        render(<ViewSecretMessage />);

        expect(screen.getByText(/someone sent you a secret message/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /decrypt & read/i })).toBeInTheDocument();
    });

    it('treats invalid view links as destroyed after submit', async () => {
        const user = userEvent.setup();

        render(<ViewSecretMessage />);

        await user.click(await screen.findByRole('button', { name: /decrypt & read/i }));

        expect(await screen.findByText(/already been read or has expired/i)).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });
});
