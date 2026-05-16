import {copyTextToClipboard, createSecretLink} from '../lib/util.js';
import {CHARSETS, type CharsetKey, type CharsetOptions} from '../lib/generator-presets';
import {showLinkReady} from './show-link-ready.js';

interface InitialState {
    path: string;
    mode: 'password' | 'passphrase';
    length: number;
    options: CharsetOptions;
    wordCount: number;
}

let wordlistCache: string[] | null = null;
let wordlistPromise: Promise<string[]> | null = null;
function loadWordlist(): Promise<string[]> {
    if (wordlistCache) return Promise.resolve(wordlistCache);
    if (!wordlistPromise) {
        wordlistPromise = import('../lib/wordlist.js').then((m) => {
            wordlistCache = m.default as string[];
            return wordlistCache;
        });
    }
    return wordlistPromise;
}

function secureRandom(max: number): number {
    if (!Number.isInteger(max) || max <= 0) {
        throw new Error('Random upper bound must be a positive integer');
    }
    const arr = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do {
        crypto.getRandomValues(arr);
    } while (arr[0]! >= limit);
    return arr[0]! % max;
}

function shuffleChars(chars: string[]): string {
    for (let i = chars.length - 1; i > 0; i--) {
        const j = secureRandom(i + 1);
        [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }
    return chars.join('');
}

function generatePassword(length: number, options: CharsetOptions): string {
    const selected = Object.entries(CHARSETS)
        .filter(([key]) => options[key as CharsetKey])
        .map(([, chars]) => chars);
    if (selected.length === 0) selected.push(CHARSETS.lowercase);

    const pool = selected.join('');
    const picked: string[] = selected.map((chars) => chars[secureRandom(chars.length)]!);
    while (picked.length < length) {
        picked.push(pool[secureRandom(pool.length)]!);
    }

    return shuffleChars(picked.slice(0, length));
}

function generatePassphrase(words: string[], count: number, sep: string, capitalize: boolean, includeNumber: boolean): string {
    const picked: string[] = [];
    for (let i = 0; i < count; i++) {
        let w = words[secureRandom(words.length)]!;
        if (capitalize) w = w.charAt(0).toUpperCase() + w.slice(1);
        picked.push(w);
    }
    let result = picked.join(sep);
    if (includeNumber) result += sep + secureRandom(1000);
    return result;
}

function estimatePasswordEntropy(length: number, options: CharsetOptions): number {
    let pool = 0;
    if (options.uppercase) pool += CHARSETS.uppercase.length;
    if (options.lowercase) pool += CHARSETS.lowercase.length;
    if (options.numbers) pool += CHARSETS.numbers.length;
    if (options.symbols) pool += CHARSETS.symbols.length;
    if (pool === 0) pool = CHARSETS.lowercase.length;
    return Math.floor(length * Math.log2(pool));
}

function estimatePassphraseEntropy(wordlistSize: number, count: number, hasNumber: boolean): number {
    if (wordlistSize <= 1 || count <= 0) return 0;
    const numberBits = hasNumber ? Math.log2(1000) : 0;
    return Math.floor(count * Math.log2(wordlistSize) + numberBits);
}

interface Strength {
    label: string;
    color: string;
    percent: number;
}

function getStrength(entropy: number): Strength {
    if (entropy < 40) return {label: 'Weak', color: 'var(--danger)', percent: 20};
    if (entropy < 60) return {label: 'Fair', color: 'var(--warning)', percent: 40};
    if (entropy < 80) return {label: 'Good', color: 'var(--success)', percent: 60};
    if (entropy < 120) return {label: 'Strong', color: '#047857', percent: 80};
    return {label: 'Very strong', color: '#065F46', percent: 100};
}

const root = document.getElementById('password-generator');
if (root) {
    const initial: InitialState = JSON.parse(root.dataset.initialState ?? '{}');

    let mode: 'password' | 'passphrase' = initial.mode;
    let length = initial.length;
    const options: CharsetOptions = {...initial.options};
    let wordCount = initial.wordCount;
    let separator = '-';
    let capitalize = true;
    let includeNumber = true;
    let generated = '';
    let isSharing = false;
    let passphraseWordlistSize = 0;

    const outputEl = root.querySelector<HTMLElement>('[data-output]')!;
    const outputText = root.querySelector<HTMLElement>('[data-output-text]')!;
    const meter = root.querySelector<HTMLElement>('[data-meter]')!;
    const meterFill = root.querySelector<HTMLElement>('[data-meter-fill]')!;
    const meterLabel = root.querySelector<HTMLElement>('[data-meter-label]')!;
    const meterBits = root.querySelector<HTMLElement>('[data-meter-bits]')!;

    const regenerateBtn = root.querySelector<HTMLButtonElement>('[data-regenerate]')!;
    const copyBtn = root.querySelector<HTMLButtonElement>('[data-copy]')!;
    const copyLabel = root.querySelector<HTMLElement>('[data-copy-label]')!;
    const copyIconDefault = root.querySelector<SVGElement>('[data-copy-icon-default]')!;
    const copyIconDone = root.querySelector<SVGElement>('[data-copy-icon-done]')!;
    const shareBtn = root.querySelector<HTMLButtonElement>('[data-share]')!;
    const shareLabel = root.querySelector<HTMLElement>('[data-share-label]')!;

    const passwordOptions = root.querySelector<HTMLElement>('[data-password-options]')!;
    const passphraseOptions = root.querySelector<HTMLElement>('[data-passphrase-options]')!;
    const lengthInput = root.querySelector<HTMLInputElement>('[data-length]')!;
    const lengthDisplay = root.querySelector<HTMLElement>('[data-length-display]')!;
    const wordsSelect = root.querySelector<HTMLSelectElement>('[data-words]')!;
    const separatorSelect = root.querySelector<HTMLSelectElement>('[data-separator]')!;
    const capitalizeInput = root.querySelector<HTMLInputElement>('[data-capitalize]')!;
    const includeNumberInput = root.querySelector<HTMLInputElement>('[data-include-number]')!;
    const charsetInputs = Array.from(root.querySelectorAll<HTMLInputElement>('[data-charset]'));
    const modeTabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mode-tab]'));

    const setMeter = (password: string) => {
        if (!password) {
            meter.toggleAttribute('hidden', true);
            return;
        }
        meter.toggleAttribute('hidden', false);
        const entropy = mode === 'password'
            ? estimatePasswordEntropy(length, options)
            : estimatePassphraseEntropy(passphraseWordlistSize, wordCount, includeNumber);
        const strength = getStrength(entropy);
        meterFill.style.width = `${strength.percent}%`;
        meterFill.style.background = strength.color;
        meterLabel.style.color = strength.color;
        meterLabel.textContent = strength.label;
        meterBits.textContent = `${entropy} bits of entropy`;
    };

    const renderGenerated = () => {
        outputText.textContent = generated;
        shareBtn.disabled = !generated || isSharing;
        setMeter(generated);
    };

    const generate = async () => {
        resetCopiedUi();
        if (mode === 'password') {
            generated = generatePassword(length, options);
        } else {
            const words = await loadWordlist();
            passphraseWordlistSize = words.length;
            generated = generatePassphrase(words, wordCount, separator, capitalize, includeNumber);
        }
        renderGenerated();
    };

    let copyTimer: number | undefined;
    const resetCopiedUi = () => {
        copyLabel.textContent = 'Copy';
        copyIconDefault.style.display = '';
        copyIconDone.style.display = 'none';
        if (copyTimer) {
            clearTimeout(copyTimer);
            copyTimer = undefined;
        }
    };

    const handleCopy = async () => {
        if (!generated) return;
        const ok = await copyTextToClipboard(generated);
        if (!ok) return;
        copyLabel.textContent = 'Copied!';
        copyIconDefault.style.display = 'none';
        copyIconDone.style.display = '';
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = window.setTimeout(resetCopiedUi, 3000);
    };

    const setMode = (next: 'password' | 'passphrase') => {
        if (mode === next) return;
        mode = next;
        for (const tab of modeTabs) {
            tab.classList.toggle('gen-tab-active', tab.dataset.modeTab === mode);
        }
        passwordOptions.toggleAttribute('hidden', mode !== 'password');
        passphraseOptions.toggleAttribute('hidden', mode !== 'passphrase');
        void generate();
    };

    for (const tab of modeTabs) {
        tab.addEventListener('click', () => setMode(tab.dataset.modeTab as 'password' | 'passphrase'));
    }

    lengthInput.addEventListener('input', () => {
        length = Number(lengthInput.value);
        lengthDisplay.textContent = String(length);
        void generate();
    });

    for (const input of charsetInputs) {
        input.addEventListener('change', () => {
            const key = input.dataset.charset as CharsetKey;
            const next = {...options, [key]: input.checked};
            const anyOn = Object.values(next).some(Boolean);
            if (!anyOn) {
                input.checked = true;
                return;
            }
            options[key] = input.checked;
            void generate();
        });
    }

    wordsSelect.addEventListener('change', () => {
        wordCount = Number(wordsSelect.value);
        void generate();
    });
    separatorSelect.addEventListener('change', () => {
        separator = separatorSelect.value;
        void generate();
    });
    capitalizeInput.addEventListener('change', () => {
        capitalize = capitalizeInput.checked;
        void generate();
    });
    includeNumberInput.addEventListener('change', () => {
        includeNumber = includeNumberInput.checked;
        void generate();
    });

    regenerateBtn.addEventListener('click', () => void generate());
    outputEl.addEventListener('click', () => void handleCopy());
    copyBtn.addEventListener('click', () => void handleCopy());

    shareBtn.addEventListener('click', async () => {
        if (!generated || isSharing) return;
        isSharing = true;
        shareLabel.textContent = 'Creating...';
        shareBtn.disabled = true;
        try {
            const {link} = await createSecretLink(generated);
            if (link) {
                showLinkReady(root, link, () => {
                    isSharing = false;
                    shareLabel.textContent = 'Share as link';
                    shareBtn.disabled = !generated;
                    void generate();
                });
                return;
            }
        } catch {}
        isSharing = false;
        shareLabel.textContent = 'Share as link';
        shareBtn.disabled = !generated;
    });

    void generate();
}
