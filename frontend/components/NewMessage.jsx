'use client';

import {lazy, Suspense, useState} from "react";
import {Constants, createSecretLink, SHARE_DURATION_OPTIONS} from '../utils/util';

const ShowNewLink = lazy(() => import('./ShowNewLink'));

function LinkReadyFallback() {
    return (
        <p className="link-ready-fallback" style={{color: 'var(--text-secondary)', padding: '20px 0', textAlign: 'center'}}>
            Preparing secure link...
        </p>
    );
}

export default function NewMessage() {
    const [secretMessage, setSecretMessage] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [duration, setDuration] = useState(Constants.defaultDuration);
    const [isLoading, setIsLoading] = useState(false);
    const [newLink, setNewLink] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true);

        try {
            const {link} = await createSecretLink(secretMessage, {
                secretKey,
                durationDays: duration,
            });

            if (link) {
                setSecretMessage("");
                setSecretKey("");
                setDuration(Constants.defaultDuration);
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
                    onChange={(event) => setSecretMessage(event.target.value)}
                />
            </div>

            <div className="form-actions share-primary-actions">
                <button
                    className="btn btn-primary btn-lg"
                    disabled={secretMessage.length === 0 || isLoading}
                    type="submit"
                >
                    {!isLoading ? "Create secret link" : "Encrypting..."}
                </button>
            </div>

            <div className="options-grid">
                <div className="form-field" style={{marginBottom: 0}}>
                    <label className="form-label" htmlFor="secretKey">Additional passphrase</label>
                    <input
                        className="form-input"
                        id="secretKey"
                        placeholder="Optional extra security"
                        value={secretKey}
                        onChange={(event) => setSecretKey(event.target.value)}
                        type="text"
                    />
                    <p className="form-help">Recipient will need this to decrypt</p>
                </div>
                <div className="form-field" style={{marginBottom: 0}}>
                    <label className="form-label" htmlFor="duration">Expire after</label>
                    <select
                        className="form-select"
                        id="duration"
                        value={duration}
                        onChange={(event) => setDuration(Number(event.target.value))}
                    >
                        {SHARE_DURATION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <p className="form-help">Link expires even if unread</p>
                </div>
            </div>
        </form>
    );
}
