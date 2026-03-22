'use client';

import { useState, useCallback } from 'react';

export default function CodeBlock({ children }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText((children || '').trim()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [children]);

    return (
        <div className="code-block">
            <button className="code-block-copy" onClick={handleCopy} aria-label="Copy to clipboard">
                {copied ? '✓' : '⎘'}
            </button>
            <pre><code>{children}</code></pre>
        </div>
    );
}
