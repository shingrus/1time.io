import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
const mockPathname = vi.fn(() => '/');
const mockClipboardWriteText = vi.fn();

const fileProtocolMocks = vi.hoisted(() => ({
    encryptFile: vi.fn(),
    decryptFile: vi.fn(),
    downloadFile: vi.fn(),
}));

const fileApiMocks = vi.hoisted(() => ({
    saveFile: vi.fn(),
    getFile: vi.fn(),
}));

const protocolMocks = vi.hoisted(() => ({
    hashSecretKey: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => mockPathname(),
}));

vi.mock('../utils/fileProtocol', () => ({
    encryptFile: fileProtocolMocks.encryptFile,
    decryptFile: fileProtocolMocks.decryptFile,
    downloadFile: fileProtocolMocks.downloadFile,
}));

vi.mock('../utils/fileApi', () => ({
    saveFile: fileApiMocks.saveFile,
    getFile: fileApiMocks.getFile,
}));

vi.mock('../utils/protocol.mjs', async () => {
    const actual = await vi.importActual('../utils/protocol.mjs');
    return {
        ...actual,
        hashSecretKey: protocolMocks.hashSecretKey,
    };
});

import SecureFileShare from '../components/SecureFileShare';
import ViewSecretFile from '../components/ViewSecretFile';
import { Constants } from '../utils/util';

beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/');
    mockClipboardWriteText.mockResolvedValue(undefined);
    protocolMocks.hashSecretKey.mockResolvedValue('hashed-file-key');
    window.history.pushState({}, '', '/');
    window.scrollTo = vi.fn();
    Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: mockClipboardWriteText,
        },
    });
});

describe('SecureFileShare component', () => {
    it('creates a file link from an encrypted upload', async () => {
        const user = userEvent.setup();
        const file = new File(['hello world'], 'secret.txt', {type: 'text/plain'});
        const randomKey = 'R'.repeat(Constants.randomKeyLen);

        fileProtocolMocks.encryptFile.mockResolvedValue({
            encryptedBlob: new Blob(['encrypted-bytes']),
            hashedKey: 'hashed-upload-key',
            randomKey,
        });
        fileApiMocks.saveFile.mockImplementation(async (_blob, _hashedKey, _duration, onProgress) => {
            onProgress(0.55);
            return {
                status: 'ok',
                newId: 'file123',
            };
        });

        const {container} = render(<SecureFileShare />);
        const fileInput = container.querySelector('input[type="file"]');

        fireEvent.change(fileInput, {target: {files: [file]}});
        await user.click(screen.getByRole('button', {name: /create file link/i}));

        await waitFor(() => {
            expect(fileProtocolMocks.encryptFile).toHaveBeenCalledWith(file, '');
        });

        expect(fileApiMocks.saveFile).toHaveBeenCalledWith(
            expect.any(Blob),
            'hashed-upload-key',
            Constants.defaultDuration,
            expect.any(Function),
        );

        const linkInput = await screen.findByLabelText(/secret one-time link/i);
        expect(linkInput.value).toContain('/f/#');
        expect(linkInput.value).toContain(randomKey);
        expect(linkInput.value).toContain('file123');
        expect(mockPush).not.toHaveBeenCalled();
    });

    it('rejects oversized files before encryption or upload', () => {
        const largeFile = new File(
            [new Uint8Array(Constants.maxFileSizeBytes + 1)],
            'too-large.bin',
            {type: 'application/octet-stream'},
        );

        const {container} = render(<SecureFileShare />);
        const fileInput = container.querySelector('input[type="file"]');

        fireEvent.change(fileInput, {target: {files: [largeFile]}});

        expect(screen.getByText(/file is too large/i)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /create file link/i})).toBeDisabled();
        expect(fileProtocolMocks.encryptFile).not.toHaveBeenCalled();
        expect(fileApiMocks.saveFile).not.toHaveBeenCalled();
    });
});

describe('ViewSecretFile component', () => {
    it('asks for a passphrase after a wrong-key response', async () => {
        const user = userEvent.setup();
        const randomKey = 'A'.repeat(Constants.randomKeyLen);
        window.history.pushState({}, '', `/f/#${randomKey}file123`);
        fileApiMocks.getFile.mockResolvedValue({status: 'wrong key'});

        render(<ViewSecretFile />);

        await user.click(screen.getByRole('button', {name: /download the file/i}));

        expect(await screen.findByText(/wrong passphrase/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/passphrase required/i)).toBeInTheDocument();

        expect(protocolMocks.hashSecretKey).toHaveBeenCalledWith(randomKey);
        expect(fileApiMocks.getFile).toHaveBeenCalledWith('file123', 'hashed-file-key');
    });

    it('downloads and destroys the file after successful decryption', async () => {
        const user = userEvent.setup();
        const randomKey = 'B'.repeat(Constants.randomKeyLen);
        const meta = {
            name: 'secret.txt',
            type: 'text/plain',
            size: 3,
        };
        const fileBytes = new Uint8Array([4, 5, 6]);

        window.history.pushState({}, '', `/f/#${randomKey}file123`);
        fileApiMocks.getFile.mockResolvedValue({
            status: 'ok',
            data: new Uint8Array([1, 2, 3]),
        });
        fileProtocolMocks.decryptFile.mockResolvedValue({meta, fileBytes});

        render(<ViewSecretFile />);

        await user.click(screen.getByRole('button', {name: /download the file/i}));

        await waitFor(() => {
            expect(fileProtocolMocks.downloadFile).toHaveBeenCalledWith(meta, fileBytes);
        });

        expect(await screen.findByText(/file downloaded and permanently destroyed/i)).toBeInTheDocument();
        expect(fileApiMocks.getFile).toHaveBeenCalledWith('file123', 'hashed-file-key');
        expect(mockPush).not.toHaveBeenCalled();
    });
});
