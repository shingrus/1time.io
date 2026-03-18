'use client';

import {useState, useCallback, useEffect} from "react";
import Link from "next/link";
import ShowNewLink from './ShowNewLink';
import {copyTextToClipboard, createSecretLink} from '../utils/util';
import wordlist from '../utils/wordlist';

const CHARSETS = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?',
};

// SEO preset configurations keyed by route path
const PRESETS = {
    '/password-generator': {
        title: 'Password Generator',
        subtitle: 'Generate strong passwords and passphrases in your browser. Nothing leaves your device.',
        length: 20,
        mode: 'password',
        options: { uppercase: true, lowercase: true, numbers: true, symbols: true },
        seoHeading: 'Free Online Password Generator',
        seoText: 'Create secure, random passwords instantly with our free password generator. Every password is generated entirely in your browser using cryptographic randomness — nothing is ever sent to a server. Choose your preferred length, character types, or switch to memorable passphrases. Strong passwords are your first line of defense against unauthorized access to your accounts.',
    },
    '/strong-password-generator': {
        title: 'Strong Password Generator',
        subtitle: 'Create a strong, uncrackable password with maximum entropy.',
        length: 24,
        mode: 'password',
        options: { uppercase: true, lowercase: true, numbers: true, symbols: true },
        seoHeading: 'Generate a Strong Password',
        seoText: 'A strong password uses at least 16 characters with a mix of uppercase letters, lowercase letters, numbers, and special symbols. Our strong password generator creates cryptographically random passwords directly in your browser — no data is transmitted or stored. Security experts recommend using a unique strong password for every account. Pair this generator with a password manager to keep all your credentials safe and accessible.',
    },
    '/create-password-14-symbols': {
        title: 'Create 14-Character Password',
        subtitle: 'Quick 14-character password with letters, numbers, and symbols.',
        length: 14,
        mode: 'password',
        options: { uppercase: true, lowercase: true, numbers: true, symbols: true },
        seoHeading: 'Create a 14-Character Password with Symbols',
        seoText: 'A 14-character password with mixed character types provides solid security for most online accounts. Many services require at least 8 characters, but 14 is the minimum recommended by cybersecurity professionals. This generator creates passwords with uppercase and lowercase letters, digits, and symbols — all generated locally in your browser for maximum privacy.',
    },
    '/random-password-generator': {
        title: 'Random Password Generator',
        subtitle: 'Truly random passwords using browser cryptographic APIs.',
        length: 16,
        mode: 'password',
        options: { uppercase: true, lowercase: true, numbers: true, symbols: false },
        seoHeading: 'Truly Random Password Generator',
        seoText: 'Our random password generator uses the Web Crypto API built into your browser to produce genuinely unpredictable passwords. Unlike pseudo-random generators, cryptographic randomness ensures each character is independently and uniformly selected. The result: passwords that resist brute-force attacks, dictionary attacks, and pattern-based cracking. All generation happens client-side — your passwords never touch a server.',
    },
    '/passphrase-generator': {
        title: 'Passphrase Generator',
        subtitle: 'Generate memorable multi-word passphrases that are easy to type.',
        length: 16,
        mode: 'passphrase',
        options: { uppercase: true, lowercase: true, numbers: true, symbols: true },
        wordCount: 5,
        seoHeading: 'Memorable Passphrase Generator',
        seoText: 'Passphrases combine multiple random words into a single password that is both highly secure and easy to remember. A 4-5 word passphrase can provide over 50 bits of entropy while remaining human-friendly. Our passphrase generator picks words from a curated list using cryptographic randomness, so every combination is unique. Passphrases are ideal for master passwords, device logins, and any situation where you need to type your password by hand.',
    },
};

// All SEO pages to link to (excluding the current page)
const SEO_LINKS = [
    { path: '/password-generator', label: 'Password Generator', desc: 'All-purpose password & passphrase tool' },
    { path: '/strong-password-generator', label: 'Strong Password Generator', desc: '24+ character maximum-strength passwords' },
    { path: '/create-password-14-symbols', label: '14-Character Password', desc: 'Quick passwords with symbols for most sites' },
    { path: '/random-password-generator', label: 'Random Password Generator', desc: 'Cryptographically random character passwords' },
    { path: '/passphrase-generator', label: 'Passphrase Generator', desc: 'Memorable multi-word passphrases' },
];

function secureRandom(max) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
}

function generatePassword(length, options) {
    let chars = '';
    if (options.uppercase) chars += CHARSETS.uppercase;
    if (options.lowercase) chars += CHARSETS.lowercase;
    if (options.numbers) chars += CHARSETS.numbers;
    if (options.symbols) chars += CHARSETS.symbols;
    if (!chars) chars = CHARSETS.lowercase;

    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[secureRandom(chars.length)];
    }
    return result;
}

function generatePassphrase(wordCount, separator, capitalize, includeNumber) {
    const words = [];
    for (let i = 0; i < wordCount; i++) {
        let word = wordlist[secureRandom(wordlist.length)];
        if (capitalize) {
            word = word.charAt(0).toUpperCase() + word.slice(1);
        }
        words.push(word);
    }
    let result = words.join(separator);
    if (includeNumber) {
        result += separator + secureRandom(1000);
    }
    return result;
}

function estimateEntropy(password) {
    let poolSize = 0;
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;
    if (poolSize === 0) return 0;
    return Math.floor(password.length * Math.log2(poolSize));
}

function getStrength(entropy) {
    if (entropy < 40) return { label: 'Weak', color: 'var(--danger)', percent: 20 };
    if (entropy < 60) return { label: 'Fair', color: 'var(--warning)', percent: 40 };
    if (entropy < 80) return { label: 'Good', color: 'var(--success)', percent: 60 };
    if (entropy < 120) return { label: 'Strong', color: '#047857', percent: 80 };
    return { label: 'Very strong', color: '#065F46', percent: 100 };
}

export default function PasswordGenerator({ presetPath }) {
    const preset = PRESETS[presetPath] || PRESETS['/password-generator'];

    const [mode, setMode] = useState(preset.mode);
    const [copied, setCopied] = useState(false);
    const [generated, setGenerated] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [sharedLink, setSharedLink] = useState('');

    // Password options
    const [length, setLength] = useState(preset.length);
    const [options, setOptions] = useState(preset.options);

    // Passphrase options
    const [wordCount, setWordCount] = useState(preset.wordCount || 4);
    const [separator, setSeparator] = useState('-');
    const [capitalize, setCapitalize] = useState(true);
    const [includeNumber, setIncludeNumber] = useState(true);

    const generate = useCallback(() => {
        setCopied(false);
        if (mode === 'password') {
            setGenerated(generatePassword(length, options));
        } else {
            setGenerated(generatePassphrase(wordCount, separator, capitalize, includeNumber));
        }
    }, [mode, length, options, wordCount, separator, capitalize, includeNumber]);

    useEffect(() => {
        generate();
    }, [generate]);

    const handleCopy = async () => {
        const didCopy = await copyTextToClipboard(generated);
        if (didCopy) {
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    const handleShare = async () => {
        if (!generated || isSharing) {
            return;
        }

        setIsSharing(true);

        try {
            const {link} = await createSecretLink(generated);
            setIsSharing(false);
            setSharedLink(link);
            return;
        } catch (error) {}

        setIsSharing(false);
    };

    const toggleOption = (key) => {
        const next = {...options, [key]: !options[key]};
        const anyOn = Object.values(next).some(Boolean);
        if (anyOn) setOptions(next);
    };

    const otherPages = SEO_LINKS.filter(l => l.path !== presetPath);

    if (sharedLink) {
        return (
            <ShowNewLink
                newLink={sharedLink}
                onReset={() => setSharedLink('')}
            />
        );
    }

    return (
        <div>
            <div className="gen-header">
                <h1 className="gen-title">{preset.title}</h1>
                <p className="gen-subtitle">{preset.subtitle}</p>
            </div>

            <div className="gen-tabs">
                <button
                    className={`gen-tab ${mode === 'password' ? 'gen-tab-active' : ''}`}
                    onClick={() => setMode('password')}
                    type="button"
                >Random Password</button>
                <button
                    className={`gen-tab ${mode === 'passphrase' ? 'gen-tab-active' : ''}`}
                    onClick={() => setMode('passphrase')}
                    type="button"
                >Passphrase</button>
            </div>

            <div className="gen-output" onClick={handleCopy} title="Click to copy">
                <code className="gen-output-text">{generated}</code>
            </div>

            {generated && (() => {
                const entropy = estimateEntropy(generated);
                const strength = getStrength(entropy);
                return (
                    <div className="gen-meter">
                        <div className="gen-meter-bar">
                            <div
                                className="gen-meter-fill"
                                style={{ width: strength.percent + '%', background: strength.color }}
                            />
                        </div>
                        <div className="gen-meter-info">
                            <span className="gen-meter-label" style={{ color: strength.color }}>{strength.label}</span>
                            <span className="gen-meter-bits">{entropy} bits of entropy</span>
                        </div>
                    </div>
                );
            })()}

            <div className="gen-actions">
                <button className="btn btn-secondary" onClick={generate} type="button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    Regenerate
                </button>
                <button className="btn btn-success" onClick={handleCopy} type="button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {copied
                            ? <polyline points="20 6 9 17 4 12"/>
                            : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>
                        }
                    </svg>
                    {copied ? "Copied!" : "Copy"}
                </button>
                <button className="btn btn-primary" onClick={handleShare} type="button" disabled={!generated || isSharing}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    {isSharing ? 'Creating...' : 'Share as link'}
                </button>
            </div>

            <div className="gen-options">
                {mode === 'password' ? (
                    <>
                        <div className="gen-option-row">
                            <label className="form-label" htmlFor="gen-length">
                                Length: <strong>{length}</strong>
                            </label>
                            <input
                                className="gen-slider"
                                id="gen-length"
                                type="range"
                                min="8"
                                max="128"
                                value={length}
                                onChange={(e) => setLength(Number(e.target.value))}
                            />
                        </div>
                        <div className="gen-checkboxes">
                            {Object.keys(CHARSETS).map((key) => (
                                <label key={key} className="gen-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={options[key]}
                                        onChange={() => toggleOption(key)}
                                    />
                                    <span className="gen-checkbox-label">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                                </label>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="gen-option-row">
                            <label className="form-label" htmlFor="gen-words">Words</label>
                            <select
                                className="form-select"
                                id="gen-words"
                                value={wordCount}
                                onChange={(e) => setWordCount(Number(e.target.value))}
                            >
                                {[3,4,5,6,7,8].map(n => (
                                    <option key={n} value={n}>{n} words</option>
                                ))}
                            </select>
                        </div>
                        <div className="gen-option-row">
                            <label className="form-label" htmlFor="gen-sep">Separator</label>
                            <select
                                className="form-select"
                                id="gen-sep"
                                value={separator}
                                onChange={(e) => setSeparator(e.target.value)}
                            >
                                <option value="-">Hyphen (-)</option>
                                <option value=" ">Space</option>
                                <option value=".">Dot (.)</option>
                                <option value="_">Underscore (_)</option>
                            </select>
                        </div>
                        <div className="gen-checkboxes">
                            <label className="gen-checkbox">
                                <input
                                    type="checkbox"
                                    checked={capitalize}
                                    onChange={() => setCapitalize(!capitalize)}
                                />
                                <span className="gen-checkbox-label">Capitalize words</span>
                            </label>
                            <label className="gen-checkbox">
                                <input
                                    type="checkbox"
                                    checked={includeNumber}
                                    onChange={() => setIncludeNumber(!includeNumber)}
                                />
                                <span className="gen-checkbox-label">Include number</span>
                            </label>
                        </div>
                    </>
                )}
            </div>

            {/* SEO content section */}
            <section className="gen-seo">
                <h2 className="gen-seo-heading">{preset.seoHeading}</h2>
                <p className="gen-seo-text">{preset.seoText}</p>
            </section>

            {/* Internal links to other generator pages */}
            <nav className="gen-related" aria-label="Related password tools">
                <h3 className="gen-related-heading">More password tools</h3>
                <div className="gen-related-grid">
                    {otherPages.map(page => (
                        <Link key={page.path} href={page.path} className="gen-related-card">
                            <span className="gen-related-title">{page.label}</span>
                            <span className="gen-related-desc">{page.desc}</span>
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}
