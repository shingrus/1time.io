'use client';

import {useState, useEffect} from 'react';
import {useRouter} from "next/navigation";
import {Constants, copyTextToClipboard, decryptSecretMessage, hashSecretKey, postJson} from '../utils/util';

export default function ViewSecretMessage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [secretMessage, setSecretMessage] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [needSecretKey, setNeedSecretKey] = useState("");
    const [isWrongKey, setIsWrongKey] = useState(false);
    const [isNoMessage, setIsNoMessage] = useState(false);
    const [copied, setCopied] = useState(false);
    const [linkKey, setLinkKey] = useState("");

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
        const hashedKey = await hashSecretKey(fullSecretKey);

        try {
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
        } catch (error) {}

        setIsLoading(false);
    };

    const handleCopy = async () => {
        const didCopy = await copyTextToClipboard(secretMessage);
        if (didCopy) {
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    return (
        <div>
            {/* Pre-read state */}
            {secretMessage.length === 0 && !isNoMessage && (
                <div className="view-prompt">
                    <div className="view-prompt-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                    </div>
                    <p>Someone sent you a secret message. Once you read it, it will be permanently destroyed.</p>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Wrong key warning */}
                {isWrongKey && (
                    <div className="alert alert-warning">
                        Wrong passphrase. Please try again.
                    </div>
                )}

                {/* Secret key input */}
                {secretMessage.length === 0 && !isNoMessage && needSecretKey && (
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
                {secretMessage.length > 0 && (
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
                {secretMessage.length === 0 && !isNoMessage && (
                    <div style={{textAlign: 'center'}}>
                        <button
                            className="btn btn-primary btn-lg"
                            type="submit"
                            disabled={isLoading}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            {!isLoading ? "Decrypt & read" : "Decrypting..."}
                        </button>
                    </div>
                )}

                {/* Destroyed state */}
                {(secretMessage.length > 0 || isNoMessage) && (
                    <div className="destroyed-notice">
                        <p>
                            {isNoMessage && secretMessage.length === 0
                                ? "This message has already been read or has expired."
                                : "This message has been destroyed."}
                        </p>
                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => router.push('/')}
                        >
                            Create your own secret
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
