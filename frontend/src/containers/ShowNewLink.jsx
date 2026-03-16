import React, {useEffect, useRef, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {buildSecretLink, copyTextToClipboard} from '../utils/util';
import '../styles/link.css';

export default function ShowNewLink() {
    const location = useLocation();
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [didAutoCopy, setDidAutoCopy] = useState(false);
    const resetCopiedTimeoutRef = useRef(null);
    const routeState = location.state;
    const newLink = routeState?.randomString
        ? buildSecretLink(routeState.randomString, routeState.newId)
        : "";

    useEffect(() => {
        if (!newLink) {
            return undefined;
        }

        let isActive = true;

        const autoCopyLink = async () => {
            const didCopy = await copyTextToClipboard(newLink);
            if (didCopy && isActive) {
                setDidAutoCopy(true);
            }
        };

        void autoCopyLink();

        return () => {
            isActive = false;
        };
    }, [newLink]);

    useEffect(() => {
        return () => {
            if (resetCopiedTimeoutRef.current) {
                window.clearTimeout(resetCopiedTimeoutRef.current);
            }
        };
    }, []);

    const handleCopy = async () => {
        const didCopy = await copyTextToClipboard(newLink);
        if (didCopy) {
            setDidAutoCopy(true);
            setCopied(true);
            if (resetCopiedTimeoutRef.current) {
                window.clearTimeout(resetCopiedTimeoutRef.current);
            }
            resetCopiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 3000);
        }
    };

    return (
        <div className="link-display">
            <div style={{marginBottom: 24}}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            </div>
            <p className="link-display-label">Your secret link is ready</p>
            <input
                className="link-display-input"
                aria-label="Secret one-time link"
                onClick={handleCopy}
                type="text"
                value={newLink}
                readOnly
            />
            <div className="link-actions">
                <button
                    className="btn btn-success btn-lg"
                    onClick={handleCopy}
                    type="button"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {(copied || didAutoCopy)
                            ? <polyline points="20 6 9 17 4 12"/>
                            : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>
                        }
                    </svg>
                    {copied ? "Copied!" : didAutoCopy ? "Link already copied" : "Copy link"}
                </button>
                <button
                    className="btn btn-secondary btn-lg"
                    type="button"
                    onClick={() => navigate('/')}
                >Create another</button>
            </div>
            <p className="link-notice">
                This link works only once. After the recipient opens it, the message is
                permanently destroyed. Even we cannot read it — encryption happens in your browser.
            </p>
        </div>
    );
}
