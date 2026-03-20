'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {isBlogEnabled} from '../utils/siteConfig';

export default function Header() {
    const pathname = usePathname();
    const showBlog = isBlogEnabled();

    return (
        <header className="app-header">
            <Link href="/" className="app-logo">
                <svg width="28" height="28" viewBox="0 0 64 64" style={{color: 'var(--accent)'}}>
                    <rect width="64" height="64" rx="14" fill="currentColor"/>
                    <rect x="16" y="28" width="32" height="24" rx="4" fill="#fff"/>
                    <path d="M24 28V22a8 8 0 1 1 16 0v6" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
                    <circle cx="32" cy="40" r="4" fill="currentColor"/>
                </svg>
                <span className="app-logo-text">onetime<span>link</span></span>
            </Link>
            <nav className="app-nav">
                <Link
                    href="/password-generator"
                    className={!pathname?.startsWith('/blog') && (pathname?.includes('password') || pathname?.includes('passphrase') || pathname?.includes('api-key')) ? 'active' : ''}
                >
                    Password Generator
                </Link>
                {showBlog && (
                    <Link
                        href="/blog"
                        className={pathname?.startsWith('/blog') ? 'active' : ''}
                    >
                        Blog
                    </Link>
                )}
                <a
                    className="app-nav-icon"
                    href="https://github.com/shingrus/onetimelink"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View on GitHub"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                </a>
            </nav>
        </header>
    );
}
