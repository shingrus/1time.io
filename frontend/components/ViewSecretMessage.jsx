'use client';

import '../styles/view.css';
import {useState, useEffect} from 'react';
import {useRouter} from "next/navigation";
import {Constants, copyTextToClipboard, decryptSecretMessage, hashSecretKey, postJson} from '../utils/util';
import {createQrSvg} from '../utils/qr';

export default function ViewSecretMessage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [secretMessage, setSecretMessage] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [needSecretKey, setNeedSecretKey] = useState(false);
    const [isWrongKey, setIsWrongKey] = useState(false);
    const [isNoMessage, setIsNoMessage] = useState(false);
    const [copied, setCopied] = useState(false);
    const [linkKey, setLinkKey] = useState("");
    const [isQrLoading, setIsQrLoading] = useState(false);
    const [qrSvg, setQrSvg] = useState("");
    const hasSecretMessage = secretMessage.length > 0;
    const isPreRead = !hasSecretMessage && !isNoMessage;

    // Extract the link key from hash or pathname (client-side only)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hash = window.location.hash;
            if (hash && hash.length > 1) {
                setLinkKey(hash.slice(1));
                return;
            }
            const path = window.location.pathname;
            if (path.startsWith("/v/")) {
                setLinkKey(path.slice(3).replace(/\/$/, ''));
            }
        }
    }, []);

    const handleChange = (event) => {
        setSecretKey(event.target.value);
    };

    const handleSubmit = async (event) => {
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
            const data = await postJson('get', {
                id,
                hashedKey,
            });

            if (data.status === "ok" &&
                typeof (data.cryptedMessage) !== "undefined" &&
                data.cryptedMessage.length > 0
            ) {
                const decryptedMessage = await decryptSecretMessage(data.cryptedMessage, fullSecretKey);
                setIsLoading(false);
                setSecretMessage(decryptedMessage);
                return;
            }

            if (data.status === "wrong key") {
                setIsLoading(false);
                setIsWrongKey(true);
                setNeedSecretKey(true);
                return;
            }

            if (data.status === "no message") {
                setIsLoading(false);
                setIsNoMessage(true);
                return;
            }
        } catch {}

        setIsLoading(false);
    };

    const handleCopy = async () => {
        const didCopy = await copyTextToClipboard(secretMessage);
        if (didCopy) {
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    const handleToggleQr = async () => {
        if (qrSvg) {
            setQrSvg("");
            return;
        }

        if (!linkKey || typeof window === 'undefined') {
            return;
        }

        setIsQrLoading(true);

        try {
            setQrSvg(await createQrSvg(`${window.location.origin}/v/#${linkKey}`));
        } finally {
            setIsQrLoading(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                {/* Wrong key warning */}
                {isWrongKey && (
                    <div className="alert alert-warning">
                        Wrong passphrase. Please try again.
                    </div>
                )}

                {/* Secret key input */}
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

                {/* Decrypted message */}
                {hasSecretMessage && (
                    <div className="message-panel">
                        <div className="message-panel-header">
                            <span className="status-dot"></span>
                            Decrypted message
                        </div>
                        <div className="message-panel-body">
                            <pre>{secretMessage}</pre>
                        </div>
                        <div className="message-panel-footer">
                            <button
                                className="btn btn-success btn-sm"
                                onClick={handleCopy}
                                type="button"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    {copied
                                        ? <polyline points="20 6 9 17 4 12"/>
                                        : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>
                                    }
                                </svg>
                                {copied ? "Copied!" : "Copy"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Read button */}
                {isPreRead && (
                    <>
                    <div className="message-panel message-panel-locked">
                        <div className="message-panel-header">
                            Encrypted message
                        </div>
                        <div className="message-panel-body message-panel-body-locked">
                            <div className="view-secret-placeholder">
                                <div className="view-secret-line view-secret-line-wide"></div>
                                <div className="view-secret-line"></div>
                                <div className="view-secret-line view-secret-line-short"></div>
                                <div className="view-secret-line view-secret-line-medium"></div>
                            </div>
                            <div className="view-secret-fog">
                                <button
                                    className="btn btn-success btn-lg"
                                    type="submit"
                                    disabled={isLoading}
                                >
                                    {!isLoading ? "Decrypt & read" : "Decrypting..."}
                                </button>
                            </div>
                        </div>
                    </div>
                    {linkKey && (
                        <div className="view-secondary-actions">
                            <button
                                className="btn btn-secondary btn-lg"
                                disabled={isQrLoading}
                                type="button"
                                onClick={handleToggleQr}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M3 3h6v6H3z"/>
                                    <path d="M15 3h6v6h-6z"/>
                                    <path d="M3 15h6v6H3z"/>
                                    <path d="M15 15h3"/>
                                    <path d="M18 12v3"/>
                                    <path d="M21 15v6"/>
                                    <path d="M15 21h3"/>
                                    <path d="M21 21h.01"/>
                                </svg>
                                {isQrLoading ? "Loading QR..." : qrSvg ? "Hide QR code" : "Show QR code"}
                            </button>
                        </div>
                    )}
                    {qrSvg && (
                        <section className="view-qr-panel" aria-live="polite">
                            <p className="view-qr-panel-title">Scan from another device</p>
                            <p className="view-qr-panel-note">
                                This QR encodes the same one-time link for this secret.
                            </p>
                            <div className="view-qr-panel-code">
                                <div
                                    aria-label="Secret link QR code"
                                    dangerouslySetInnerHTML={{__html: qrSvg}}
                                />
                            </div>
                        </section>
                    )}
                    </>
                )}

                {/* Destroyed state */}
                {isNoMessage && !hasSecretMessage && (
                    <div className="destroyed-notice">
                        <p>This message has already been read or has expired.</p>
                        <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => router.push('/')}
                        >
                            Create your own secret link
                        </button>
                    </div>
                )}

                {/* Post-read CTA */}
                {hasSecretMessage && (
                    <div className="view-cta">
                        <p className="view-cta-destroyed">This message has been permanently destroyed from our servers.</p>
                        <div className="view-cta-box">
                            <p className="view-cta-heading">Need to share a secret yourself?</p>
                            <p className="view-cta-desc">Create an encrypted, self-destructing link in seconds. Free, no signup required.</p>
                            <button
                                className="btn btn-primary"
                                type="button"
                                onClick={() => router.push('/')}
                            >
                                Create a secure link
                            </button>
                        </div>
                    </div>
                )}
            </form>
            <div className="view-powered-by">
                <a href="https://1time.io" target="_blank" rel="noopener noreferrer">
                    Powered by <strong>1time.io</strong>
                </a>
                <span className="view-powered-by-tagline">Free, open-source, zero-knowledge encryption. Your secrets are encrypted in the browser — the server never sees them.</span>
            </div>
        </div>
    );
}
