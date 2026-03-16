import React from 'react';
import {Link, useLocation} from "react-router-dom";
import Routes from "./Routes"

export default function App() {
    const location = useLocation();

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
