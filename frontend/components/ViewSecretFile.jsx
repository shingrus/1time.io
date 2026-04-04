'use client';

import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {Constants} from '../utils/util';
import {hashSecretKey} from '../utils/protocol.mjs';
import {getFile} from '../utils/fileApi';
import {decryptFile, downloadFile} from '../utils/fileProtocol';

export default function ViewSecretFile() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [secretKey, setSecretKey] = useState('');
    const [needSecretKey, setNeedSecretKey] = useState(false);
    const [isWrongKey, setIsWrongKey] = useState(false);
    const [isNoMessage, setIsNoMessage] = useState(false);
    const [linkKey, setLinkKey] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hash = window.location.hash;
            if (hash && hash.length > 1) {
                setLinkKey(hash.slice(1));
                return;
            }
            const path = window.location.pathname;
            if (path.startsWith('/f/')) {
                setLinkKey(path.slice(3).replace(/\/$/, ''));
            }
        }
    }, []);

    const handleChange = (event) => {
        setSecretKey(event.target.value);
    };

    const handleDownload = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        setIsWrongKey(false);

        if (!linkKey || linkKey.length <= Constants.randomKeyLen) {
            setIsLoading(false);
            setIsNoMessage(true);
            return;
        }

        const randomKey = linkKey.substring(0, Constants.randomKeyLen);
        const id = linkKey.substring(Constants.randomKeyLen);
        const fullSecretKey = secretKey + randomKey;

        try {
            const hashedKey = await hashSecretKey(fullSecretKey);
            const result = await getFile(id, hashedKey);

            if (result.status === 'ok' && result.data) {
                const {meta, fileBytes} = await decryptFile(result.data, fullSecretKey);
                downloadFile(meta, fileBytes);
                setIsLoading(false);
                setIsDownloaded(true);
                return;
            }

            if (result.status === 'no message') {
                setIsLoading(false);
                setIsNoMessage(true);
                return;
            }

            if (result.status === 'wrong key') {
                setIsLoading(false);
                setIsWrongKey(true);
                setNeedSecretKey(true);
                return;
            }
        } catch (e) {
            console.error('Decryption failed:', e);
        }

        setIsLoading(false);
        setIsNoMessage(true);
    };

    const isPreRead = !isDownloaded && !isNoMessage;

    return (
        <div>
            <form onSubmit={handleDownload}>
                {isWrongKey && (
                    <div className="alert alert-warning">
                        Wrong passphrase. Please try again.
                    </div>
                )}

                {isPreRead && needSecretKey && (
                    <div className="form-field">
                        <label className="form-label" htmlFor="secretKey">Passphrase required</label>
                        <input
                            autoFocus
                            className="form-input"
                            id="secretKey"
                            placeholder="Enter the passphrase from the sender"
                            value={secretKey}
                            onChange={handleChange}
                            type="text"
                        />
                    </div>
                )}

                {/* Pre-download state */}
                {isPreRead && (
                    <div className="message-panel">
                        <div className="message-panel-header">
                            Encrypted file
                        </div>
                        <div className="message-panel-body view-download-panel">
                            <p className="view-download-note">
                                Downloading will decrypt the file in your browser and permanently remove it from our servers.
                            </p>
                            <button
                                className="btn btn-success btn-lg"
                                type="submit"
                                disabled={isLoading}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                {!isLoading ? 'Download the file' : 'Decrypting...'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Downloaded state */}
                {isDownloaded && (
                    <div className="view-cta">
                        <p className="view-cta-destroyed">File downloaded and permanently destroyed from our servers.</p>
                        <div className="view-cta-box">
                            <p className="view-cta-heading">Need to share a file securely?</p>
                            <p className="view-cta-desc">Create an encrypted, self-destructing link in seconds. Free, no signup required.</p>
                            <button
                                className="btn btn-primary"
                                type="button"
                                onClick={() => router.push('/secure-file-sharing/')}
                            >
                                Share a file
                            </button>
                        </div>
                    </div>
                )}

                {/* Destroyed state */}
                {isNoMessage && !isDownloaded && (
                    <div className="destroyed-notice">
                        <p>This file has already been downloaded or has expired.</p>
                        <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => router.push('/secure-file-sharing/')}
                        >
                            Share a file
                        </button>
                    </div>
                )}
            </form>
            <div className="view-powered-by">
                <a href="https://1time.io" target="_blank" rel="noopener noreferrer">
                    Powered by <strong>1time.io</strong>
                </a>
                <span className="view-powered-by-tagline">Free, open-source, zero-knowledge encryption. Your files are encrypted in the browser — the server never sees them.</span>
            </div>
        </div>
    );
}
