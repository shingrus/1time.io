import React, {useEffect} from 'react';
import {Link, useLocation} from "react-router-dom";
import Routes from "./Routes"

const canonicalPaths = new Set([
    '/',
    '/about',
    '/create-password-14-symbols',
    '/passphrase-generator',
    '/password-generator',
    '/random-password-generator',
    '/strong-password-generator',
]);

export default function App() {
    const location = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    useEffect(() => {
        const canonicalPath = location.pathname === '/index.html'
            ? '/'
            : canonicalPaths.has(location.pathname)
                ? location.pathname
                : '/';
        const canonicalUrl = new URL(canonicalPath, window.location.origin).toString();

        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', canonicalUrl);

        let ogUrl = document.querySelector('meta[property="og:url"]');
        if (!ogUrl) {
            ogUrl = document.createElement('meta');
            ogUrl.setAttribute('property', 'og:url');
            document.head.appendChild(ogUrl);
        }
        ogUrl.setAttribute('content', canonicalUrl);

        const shouldNoindex = location.pathname === '/new' || location.pathname.startsWith('/v/');
        let robots = document.querySelector('meta[name="robots"]');

        if (shouldNoindex) {
            if (!robots) {
                robots = document.createElement('meta');
                robots.setAttribute('name', 'robots');
                document.head.appendChild(robots);
            }
            robots.setAttribute('content', 'noindex, nofollow');
            return;
        }

        robots?.remove();
    }, [location.pathname]);

    return (
        <div className="app-layout">
            <header className="app-header">
                <Link to="/" className="app-logo">
                    <svg width="28" height="28" viewBox="0 0 64 64">
                        <rect width="64" height="64" rx="14" fill="#EA580C"/>
                        <rect x="16" y="28" width="32" height="24" rx="4" fill="#fff"/>
                        <path d="M24 28V22a8 8 0 1 1 16 0v6" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
                        <circle cx="32" cy="40" r="4" fill="#EA580C"/>
                    </svg>
                    <span className="app-logo-text">onetime<span>link</span></span>
                </Link>
                <nav className="app-nav">
                    <Link to="/password-generator" className={location.pathname.includes('password') ? 'active' : ''}>Password Generator</Link>
                    <Link to="/about" className={location.pathname === '/about' ? 'active' : ''}>About</Link>
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

            <main className="app-main">
                <Routes />
            </main>

            <footer className="app-footer">
                <p className="app-footer-text">
                    <Link to="/about">About</Link> &middot; End-to-end encrypted &middot; <a href="https://github.com/shingrus/onetimelink" target="_blank" rel="noopener noreferrer">Open source</a>
                </p>
            </footer>
        </div>
    );
}
