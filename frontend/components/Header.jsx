'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

export default function Header() {
    const pathname = usePathname();

    return (
        <header className="app-header">
            <Link href="/" className="app-logo">
                <svg width="28" height="28" viewBox="0 0 64 64">
                    <rect width="64" height="64" rx="14" fill="#EA580C"/>
                    <rect x="16" y="28" width="32" height="24" rx="4" fill="#fff"/>
                    <path d="M24 28V22a8 8 0 1 1 16 0v6" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
                    <circle cx="32" cy="40" r="4" fill="#EA580C"/>
                </svg>
                <span className="app-logo-text">onetime<span>link</span></span>
            </Link>
            <nav className="app-nav">
                <Link
                    href="/password-generator"
                    className={pathname?.includes('password') || pathname?.includes('passphrase') || pathname?.includes('create-password') ? 'active' : ''}
                >
                    Password Generator
                </Link>
                <Link
                    href="/about"
                    className={pathname === '/about' || pathname === '/about/' ? 'active' : ''}
                >
                    About
                </Link>
                <a
                    className="app-nav-github"
                    href="https://github.com/shingrus/onetimelink"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View on GitHub"
                >
                    GitHub
                </a>
            </nav>
        </header>
    );
}
