import React, {useEffect, useState} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import {Constants, createSecretLink, preloadCryptoJS} from '../utils/util';
import '../styles/home.css';

export default function NewMessage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [secretMessage, setSecretMessage] = useState(location.state?.prefill || "");
    const [secretKey, setSecretKey] = useState("");
    const [duration, setDuration] = useState(Constants.defaultDuration);
    const [needOptions, setNeedOptions] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        preloadCryptoJS();
    }, []);

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
            const {randomKey, newId} = await createSecretLink(secretMessage, {
                secretKey,
                durationDays: parseInt(duration, 10),
            });

            if (newId) {
                navigate("/new", {
                    state: {
                        randomString: randomKey,
                        newId,
                    },
                });
                return;
            }
        } catch (error) {}

        setIsLoading(false);
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <div className="form-field">
                    <label className="form-label" htmlFor="secretMessage">Your secret message</label>
                    <textarea
                        autoFocus
                        className="form-textarea"
                        id="secretMessage"
                        placeholder="Paste a password, API key, private note, or any sensitive text..."
                        rows={5}
                        value={secretMessage}
                        onChange={handleChange}
                        onFocus={preloadCryptoJS}
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
                                    onFocus={preloadCryptoJS}
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
                <h2>Simple. End to End Encrypted. Self-destruct.</h2>
                <p>
                    Stop sending passwords through email and chat. onetimelink.me creates encrypted one-time links
                    that automatically destroy themselves after being read. Your data is encrypted in the
                    browser before it ever leaves your device — we never see it.
                </p>

                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-card-header">
                            <div className="feature-card-icon" aria-hidden="true">&#x1f512;</div>
                            <h3>End-to-end encrypted</h3>
                        </div>
                        <p>AES encryption happens in your browser. The server only stores ciphertext.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-header">
                            <div className="feature-card-icon" aria-hidden="true">&#x1f4a5;</div>
                            <h3>One-time access</h3>
                        </div>
                        <p>Each link works exactly once. After reading, the data is permanently deleted.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-header">
                            <div className="feature-card-icon" aria-hidden="true">&#x23f1;&#xfe0f;</div>
                            <h3>Auto-expiry</h3>
                        </div>
                        <p>Links self-destruct after 1 to 30 days, even if nobody opens them.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-header">
                            <div className="feature-card-icon" aria-hidden="true">&#x1f6ab;</div>
                            <h3>No signup needed</h3>
                        </div>
                        <p>No accounts, no tracking, no cookies. Just paste and share.</p>
                    </div>
                </div>

                <h3>How it works</h3>
                <p>
                    Type or paste your secret above. onetimelink.me encrypts it with a unique key using AES
                    encryption directly in your browser. You get a one-time link containing the
                    decryption key. Share it with your recipient — once they open it, the secret is
                    decrypted in their browser and permanently deleted from our servers.
                </p>

                <h3>Perfect for sharing</h3>
                <p>
                    Passwords, API keys, SSH keys, private notes, access tokens, two-factor backup codes,
                    database credentials, configuration secrets, or any text you need to share
                    securely just once.
                </p>
            </section>
        </div>
    );
}
