'use client';

import {lazy, Suspense, useState} from "react";
import Link from "next/link";
import {Constants, createSecretLink} from '../utils/util';
import {siteHost} from '../utils/siteConfig';

const ShowNewLink = lazy(() => import('./ShowNewLink'));

function LinkReadyFallback() {
    return (
        <p style={{color: 'var(--text-secondary)', padding: '20px 0', textAlign: 'center'}}>
            Preparing secure link...
        </p>
    );
}

export default function NewMessage() {
    const [secretMessage, setSecretMessage] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [duration, setDuration] = useState(Constants.defaultDuration);
    const [needOptions, setNeedOptions] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [newLink, setNewLink] = useState("");

    const handleChange = (event) => {
        const {id, value} = event.target;
        switch (id) {
        case "secretMessage":
            setSecretMessage(value);
            break;
        case "secretKey":
            setSecretKey(value);
            break;
        case "duration":
            setDuration(value);
            break;
        default:
            break;
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true);

        try {
            const {link} = await createSecretLink(secretMessage, {
                secretKey,
                durationDays: parseInt(duration, 10),
            });

            if (link) {
                setSecretMessage("");
                setSecretKey("");
                setDuration(Constants.defaultDuration);
                setNeedOptions(false);
                setIsLoading(false);
                setNewLink(link);
                return;
            }
        } catch (error) {}

        setIsLoading(false);
    };

    if (newLink) {
        return (
            <Suspense fallback={<LinkReadyFallback />}>
                <ShowNewLink
                    newLink={newLink}
                    onReset={() => setNewLink("")}
                />
            </Suspense>
        );
    }

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <div className="form-field">
                    <label className="form-label" htmlFor="secretMessage">Your secret message, end-to-end encrypted.</label>
                    <textarea
                        autoFocus
                        className="form-textarea"
                        id="secretMessage"
                        placeholder="Paste a password, API key, private note, or any sensitive text..."
                        rows={5}
                        value={secretMessage}
                        onChange={handleChange}
                    />
                </div>

                {needOptions && (
                    <div className="options-panel">
                        <div className="options-grid">
                            <div className="form-field" style={{marginBottom: 0}}>
                                <label className="form-label" htmlFor="secretKey">Additional passphrase</label>
                                <input
                                    className="form-input"
                                    id="secretKey"
                                    placeholder="Optional extra security"
                                    value={secretKey}
                                    onChange={handleChange}
                                    type="text"
                                />
                                <p className="form-help">Recipient will need this to decrypt</p>
                            </div>
                            <div className="form-field" style={{marginBottom: 0}}>
                                <label className="form-label" htmlFor="duration">Self-destruct after</label>
                                <select className="form-select" id="duration" value={duration} onChange={handleChange}>
                                    <option value="1">1 day</option>
                                    <option value="3">3 days</option>
                                    <option value="7">7 days</option>
                                    <option value="30">30 days</option>
                                </select>
                                <p className="form-help">Link expires even if unread</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="form-actions">
                    <button
                        className="btn btn-ghost"
                        onClick={() => setNeedOptions(!needOptions)}
                        type="button"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        {needOptions ? 'Hide options' : 'Options'}
                    </button>
                    <button
                        className="btn btn-primary btn-lg"
                        disabled={secretMessage.length === 0 || isLoading}
                        type="submit"
                    >
                        {!isLoading ? "Create secret link" : "Encrypting..."}
                    </button>
                </div>
            </form>

            <section className="seo-section">
                <h1>Share Secrets with Encrypted One-Time Links</h1>
                <p>
                    {siteHost} creates encrypted one-time links
                    that automatically self-destruct after being read. End-to-end encrypted in your
                    browser before anything leaves your device — we never see your data.
                </p>

                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-card-header">
                            <div className="feature-card-icon" aria-hidden="true">&#x1f512;</div>
                            <h2>End-to-end encrypted</h2>
                        </div>
                        <p>AES encryption happens in your browser. The server only stores ciphertext.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-header">
                            <div className="feature-card-icon" aria-hidden="true">&#x1f4a5;</div>
                            <h2>One-time access</h2>
                        </div>
                        <p>Each link works exactly once. After reading, the data is permanently deleted.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-header">
                            <div className="feature-card-icon" aria-hidden="true">&#x23f1;&#xfe0f;</div>
                            <h2>Auto-expiry</h2>
                        </div>
                        <p>Links self-destruct after 1 to 30 days, even if nobody opens them.</p>
                    </div>
                    <Link href="/password-generator" className="feature-card feature-card-link">
                        <div className="feature-card-header">
                            <div className="feature-card-icon" aria-hidden="true">&#x1f511;</div>
                            <h2>Password Generator</h2>
                        </div>
                        <p>Create a strong, high-entropy password in your browser for critical accounts.</p>
                    </Link>
                    <a href="https://www.npmjs.com/package/@1time/cli" className="feature-card feature-card-link" target="_blank" rel="noopener noreferrer">
                        <div className="feature-card-header">
                            <div className="feature-card-icon" aria-hidden="true">&#x1f4bb;</div>
                            <h2>CLI</h2>
                        </div>
                        <p>Share secrets from your terminal. <code style={{fontSize: '0.85em'}}>printf 'secret' | 1time send</code></p>
                    </a>
                </div>

                <h2>How it works</h2>
                <p>
                    Type or paste your secret above. {siteHost} encrypts it with a unique key using AES
                    encryption directly in your browser. You get a one-time link containing the
                    decryption key. Share it with your recipient — once they open it, the secret is
                    decrypted in their browser and permanently deleted from our servers.
                </p>

                <h2>Perfect for sharing</h2>
                <p>
                    Passwords, API keys, SSH keys, private notes, access tokens, two-factor backup codes,
                    database credentials, configuration secrets, or any text you need to share
                    securely just once.
                </p>

            </section>
        </div>
    );
}
