'use client';

import '../styles/link.css';
import '../styles/qr-panel.css';
import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {copyTextToClipboard} from '../utils/util';
import {createQrSvg} from '../utils/qr';

export default function ShowNewLink({newLink = "", onReset}) {
    const router = useRouter();
    const [copied, setCopied] = useState(false);
    const [didAutoCopy, setDidAutoCopy] = useState(false);
    const [isQrLoading, setIsQrLoading] = useState(false);
    const [qrSvg, setQrSvg] = useState("");
    const resetCopiedTimeoutRef = useRef(null);

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

    const handleReset = () => {
        if (onReset) {
            onReset();
            return;
        }

        router.push('/');
    };

    const handleToggleQr = async () => {
        if (qrSvg) {
            setQrSvg("");
            return;
        }

        setIsQrLoading(true);

        try {
            setQrSvg(await createQrSvg(newLink));
        } finally {
            setIsQrLoading(false);
        }
    };

    return (
        <div className="link-display">
            {!newLink && (
                <>
                    <p className="link-display-label">This link is no longer available.</p>
                    <div className="link-actions">
                        <button
                            className="btn btn-secondary btn-lg"
                            type="button"
                            onClick={handleReset}
                        >Create another</button>
                    </div>
                </>
            )}
            {newLink && (
                <>
            <div className="link-display-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            </div>
            <p className="link-display-label">Your one-time secret link is ready</p>
            <input
                className="link-display-input"
                aria-label="Secret one-time link"
                onClick={handleCopy}
                type="text"
                value={newLink}
                readOnly
            />
            {qrSvg && (
                <section className="qr-panel" aria-live="polite">
                    <p className="qr-panel-title">Scan from another device</p>
                    <p className="qr-panel-note">
                        This QR encodes the same one-time link shown above.
                    </p>
                    <div className="qr-panel-code">
                        <div
                            aria-label="Secret link QR code"
                            dangerouslySetInnerHTML={{__html: qrSvg}}
                        />
                    </div>
                </section>
            )}
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
            <div className="link-actions">
                <button
                    className="btn btn-primary btn-lg"
                    type="button"
                    onClick={handleReset}
                >Create another</button>
            </div>
            <p className="link-notice">
                This link works only once. After it is opened, the secret is permanently destroyed.
                Even we cannot read it because encryption happens in your browser.
            </p>
                </>
            )}
        </div>
    );
}
