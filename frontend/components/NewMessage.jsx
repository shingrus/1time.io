'use client';

import {useState} from "react";
import Link from "next/link";
import ShowNewLink from './ShowNewLink';
import {Constants, createSecretLink} from '../utils/util';

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
            <ShowNewLink
                newLink={newLink}
                onReset={() => setNewLink("")}
            />
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
                <h1>End-to-end encrypted. Self-destruct.</h1>
                <p>
                    OneTimeLink.me creates encrypted one-time links
                    that automatically destroy themselves after being read. Your data is encrypted in the
                    browser before it ever leaves your device - we never see it.
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
                </div>

                <h2>How it works</h2>
                <p>
                    Type or paste your secret above. onetimelink.me encrypts it with a unique key using AES
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

                <h2>Free security tools</h2>
                <div className="tools-grid">
                    <Link href="/password-generator" className="tool-card">
                        <strong>Password Generator</strong>
                        <span>All-purpose password and passphrase tool</span>
                    </Link>
                    <Link href="/passphrase-generator" className="tool-card">
                        <strong>Passphrase Generator</strong>
                        <span>Memorable multi-word passphrases</span>
                    </Link>
                    <Link href="/password-generator-14-characters" className="tool-card">
                        <strong>14-Character Password</strong>
                        <span>Quick passwords for most sites</span>
                    </Link>
                    <Link href="/password-generator-16-characters" className="tool-card">
                        <strong>16-Character Password</strong>
                        <span>The sweet spot of security</span>
                    </Link>
                    <Link href="/wifi-password-generator" className="tool-card">
                        <strong>WiFi Password Generator</strong>
                        <span>Easy-to-type network passwords</span>
                    </Link>
                    <Link href="/api-key-generator" className="tool-card">
                        <strong>API Key Generator</strong>
                        <span>Random tokens for developers</span>
                    </Link>
                </div>
            </section>
        </div>
    );
}
