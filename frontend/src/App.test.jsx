import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn(() => '/');
const mockClipboardWriteText = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => mockPathname(),
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
import StatsSnapshot from '../components/StatsSnapshot';
import { Constants, decryptSecretMessage, encryptSecretMessage, getRandomString, getStatsPageName, hashSecretKey } from '../utils/util';

beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/');
    mockClipboardWriteText.mockResolvedValue(undefined);
    window.history.pushState({}, '', '/');
    global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url === '/api/stat') {
            return {
                ok: true,
                json: async () => ({}),
            };
        }

        if (url === '/api/ss') {
            return {
                ok: true,
                json: async () => ({
                    overallStoredSecrets: 0,
                    overallStoredFiles: 0,
                    pendingPageHits: {},
                    pendingPageHitsTotal: 0,
                    flushIntervalSeconds: 10,
                }),
            };
        }

        return {
            ok: true,
            json: async () => ({
                status: 'ok',
            }),
        };
    });
    window.scrollTo = vi.fn();
    Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: mockClipboardWriteText,
        },
    });
});

describe('NewMessage component', () => {
    it('renders the message form with always-visible options', async () => {
        const user = userEvent.setup();

        render(<NewMessage />);

        const submitButton = screen.getByRole('button', { name: /create secret link/i });
        expect(submitButton).toBeDisabled();
        expect(screen.getByLabelText(/additional passphrase/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/expire after/i)).toBeInTheDocument();

        await user.type(screen.getByLabelText(/your secret message/i), 'top secret');
        expect(submitButton).toBeEnabled();
    });

    it('submits a new secret and navigates to the generated link page', async () => {
        const user = userEvent.setup();
        fetch.mockImplementation(async (url) => {
            if (url === '/api/stat') {
                return {
                    ok: true,
                    json: async () => ({
                        status: 'ok',
                        overallStoredSecrets: 100,
                    }),
                };
            }

            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    newId: 'abc123',
                }),
            };
        });

        render(<NewMessage />);

        await user.type(screen.getByLabelText(/your secret message/i), 'ship it');
        await user.click(screen.getByRole('button', { name: /create secret link/i }));

        await waitFor(() => {
            expect(fetch.mock.calls.some(([url]) => url === '/api/saveSecret')).toBe(true);
        });

        const saveSecretCall = fetch.mock.calls.find(([url]) => url === '/api/saveSecret');
        expect(saveSecretCall).toEqual([
            '/api/saveSecret',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: expect.any(String),
            }),
        ]);

        const requestPayload = JSON.parse(saveSecretCall[1].body);
        expect(requestPayload).toEqual(expect.objectContaining({
            secretMessage: expect.any(String),
            hashedKey: expect.any(String),
            duration: Constants.defaultDuration * 86400,
        }));

        const linkInput = await screen.findByLabelText(/secret one-time link/i);
        expect(linkInput.value).toContain('/v/#');
        expect(linkInput.value).toContain('abc123');
        expect(mockPush).not.toHaveBeenCalled();
    });
});

describe('ShowNewLink component', () => {
    it('displays the generated link and auto-copies it', async () => {
        render(<ShowNewLink newLink="http://localhost:3001/v/#AbCdEfGhIjKlMnOpQr-_testId123" onReset={vi.fn()} />);

        const linkInput = await screen.findByLabelText(/secret one-time link/i);
        expect(linkInput).toBeInTheDocument();
        expect(screen.getByText(/this link works only once/i)).toBeInTheDocument();
        expect(linkInput.value).toContain('/v/#');
        expect(linkInput.value).toContain('AbCdEfGhIjKlMnOpQr-_');
        expect(linkInput.value).toContain('testId123');

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /link already copied/i })).toBeInTheDocument();
        });
    });

    it('loads the QR UI only after the user requests it', async () => {
        const user = userEvent.setup();

        render(
            <ShowNewLink
                newLink="http://localhost:3001/v/#AbCdEfGhIjKlMnOpQr-_testId123"
                onReset={vi.fn()}
            />
        );

        expect(screen.queryByLabelText(/secret link qr code/i)).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /show qr code/i }));

        await screen.findByText(/scan from another device/i);
        expect(await screen.findByLabelText(/secret link qr code/i)).toBeInTheDocument();
    });
});

describe('PasswordGenerator component', () => {
    it('renders with the correct preset for password-generator', () => {
        const {container} = render(<PasswordGenerator presetPath="/password-generator" />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Password Generator');
        expect(screen.getByRole('button', { name: /share as link/i })).toBeInTheDocument();
        expect(container.querySelector('.gen-output-copy')).not.toBeNull();
    });

    it('creates a one-time link from the password generator and navigates', async () => {
        const user = userEvent.setup();
        fetch.mockImplementation(async (url) => {
            if (url === '/api/stat') {
                return {
                    ok: true,
                    json: async () => ({
                        status: 'ok',
                        overallStoredSecrets: 100,
                    }),
                };
            }

            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    newId: 'gen123',
                }),
            };
        });

        render(<PasswordGenerator presetPath="/password-generator" />);

        await user.click(await screen.findByRole('button', { name: /share as link/i }));

        await waitFor(() => {
            expect(fetch.mock.calls.some(([url]) => url === '/api/saveSecret')).toBe(true);
        });

        const saveSecretCall = fetch.mock.calls.find(([url]) => url === '/api/saveSecret');
        expect(saveSecretCall).toEqual([
            '/api/saveSecret',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: expect.any(String),
            }),
        ]);

        const requestPayload = JSON.parse(saveSecretCall[1].body);
        expect(requestPayload).toEqual(expect.objectContaining({
            secretMessage: expect.any(String),
            hashedKey: expect.any(String),
            duration: Constants.defaultDuration * 86400,
        }));

        const linkInput = await screen.findByLabelText(/secret one-time link/i);
        expect(linkInput.value).toContain('/v/#');
        expect(linkInput.value).toContain('gen123');
        expect(mockPush).not.toHaveBeenCalled();
    });
});

describe('StatsSnapshot component', () => {
    it('renders the in-memory stats snapshot', async () => {
        fetch.mockImplementation(async (url) => {
            if (url === '/api/ss') {
                return {
                    ok: true,
                    json: async () => ({
                        overallStoredSecrets: 12,
                        overallStoredFiles: 5,
                        pendingPageHits: {
                            home: 2,
                            blog: 1,
                        },
                        pendingPageHitsTotal: 3,
                        flushIntervalSeconds: 10,
                    }),
                };
            }

            return {
                ok: true,
                json: async () => ({}),
            };
        });

        render(<StatsSnapshot />);

        expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('In-Memory Stats');
        expect(await screen.findByText('12')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('home')).toBeInTheDocument();
        expect(screen.getByText('blog')).toBeInTheDocument();
    });
});

describe('ViewSecretMessage component', () => {
    it('shows the pre-read state with reveal button', () => {
        render(<ViewSecretMessage />);

        expect(screen.getByText(/someone sent you a secret/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reveal the secret/i })).toBeInTheDocument();
    });

    it('loads the QR UI on the view page only after the user requests it', async () => {
        const user = userEvent.setup();
        window.history.pushState({}, '', '/v/#AbCdEfGhIjKlMnOpQr-_testId123');

        render(<ViewSecretMessage />);

        expect(screen.queryByLabelText(/secret link qr code/i)).not.toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: /show qr code/i }));

        await screen.findByText(/scan from another device/i);
        expect(await screen.findByLabelText(/secret link qr code/i)).toBeInTheDocument();
    });

    it('treats invalid view links as destroyed after submit', async () => {
        const user = userEvent.setup();

        render(<ViewSecretMessage />);

        await user.click(await screen.findByRole('button', { name: /reveal the secret/i }));

        expect(await screen.findByText(/already been read or has expired/i)).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe('crypto util', () => {
    it('groups tracked routes into shared stats buckets', () => {
        expect(getStatsPageName('/')).toBe('home');
        expect(getStatsPageName('/blog/how-to-share-passwords-securely')).toBe('blog');
        expect(getStatsPageName('/password-generator-16-characters')).toBe('password');
        expect(getStatsPageName('/passphrase-generator')).toBe('password');
        expect(getStatsPageName('/api-key-generator')).toBe('password');
        expect(getStatsPageName('/about')).toBeNull();
    });

    it('round-trips HKDF-derived encryption and auth for a secret', async () => {
        const fullSecretKey = 'extra-passphraseAbCd1234';
        const {encryptedMessage, hashedKey} = await encryptSecretMessage('hello hkdf', fullSecretKey);

        await expect(hashSecretKey(fullSecretKey)).resolves.toBe(hashedKey);
        await expect(decryptSecretMessage(encryptedMessage, fullSecretKey)).resolves.toBe('hello hkdf');
    });

    it('generates 20-character url-safe random keys', () => {
        const randomKey = getRandomString(Constants.randomKeyLen);

        expect(Constants.randomKeyLen).toBe(20);
        expect(randomKey).toHaveLength(20);
        expect(randomKey).toMatch(/^[A-Za-z0-9_-]+$/);
    });
});
