/**
 * Tiny offline password-strength estimator.
 *
 * Deliberately not zxcvbn: with its English dictionaries that is ~140 KB gzipped,
 * which we are not going to push at a phone just to draw a hint bar. This module is
 * ~2 KB and trades dictionary coverage for size. It scores length and character
 * variety, then discounts the patterns that actually dominate breach dumps:
 * repeats, ascending runs, keyboard rows, leetspeak-decorated common words and dates.
 *
 * Everything runs locally. Nothing here touches the network — same promise as the
 * rest of the product.
 */

/** Character-class sizes, used to size the search space an attacker has to cover. */
const CLASS_SIZES: Array<[RegExp, number]> = [
    [/[a-z]/, 26],
    [/[A-Z]/, 26],
    [/[0-9]/, 10],
    [/[ !-/:-@[-`{-~]/, 33],
    [/[^\x20-\x7e]/, 100],
];

/**
 * Top breach-list passwords plus the words most often used as a base ("qwerty2024!").
 * A short list on purpose: the long tail costs bytes and adds little — anything not
 * caught here still has to pass the length and variety checks.
 */
const COMMON = new Set(
    ('password passwort contrasena motdepasse 123456 12345678 123456789 1234567890 qwerty qwertz azerty asdfgh zxcvbn ' +
        'letmein welcome monkey dragon master sunshine princess football baseball basketball soccer superman batman ' +
        'iloveyou trustno1 whatever starwars pokemon computer internet samsung google facebook apple microsoft amazon ' +
        'admin administrator root user guest test demo default changeme secret login pass passw0rd abc123 access ' +
        'shadow ashley michael jennifer jordan hunter thomas charlie daniel jessica hannah maggie summer winter ' +
        'freedom flower cookie chocolate liverpool arsenal chelsea barcelona madrid ferrari porsche harley ' +
        'money love hello please matrix nothing forever together purple orange yellow silver golden rainbow ' +
        'january february cheese banana pepper ginger dolphin tigger buster hockey killer mustang ranger ' +
        'onetime 1time secret123 temporary').split(' '),
);

/** Keyboard rows, both directions, so "qwerty" and "ytrewq" both read as a run. */
const ROWS = ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./'];

const LEET: Record<string, string> = {
    '@': 'a', '4': 'a', '8': 'b', '(': 'c', '3': 'e', '6': 'g', '9': 'g',
    '1': 'i', '!': 'i', '|': 'l', '0': 'o', '5': 's', $: 's', '7': 't', '+': 't', '2': 'z',
};

export type Score = 0 | 1 | 2 | 3 | 4;

export interface Estimate {
    /** False when the input is not credential-shaped (a note, a key blob, prose). */
    rated: boolean;
    score: Score;
    /** Effective entropy in bits, after pattern discounts. */
    bits: number;
    label: string;
    /** Offline crack time at 10^10 guesses/s, humanised. */
    crackTime: string;
    /** One actionable sentence, empty once the secret is strong. */
    hint: string;
}

const NOT_RATED: Estimate = {rated: false, score: 0, bits: 0, label: '', crackTime: '', hint: ''};

/**
 * Cheap pre-check, duplicated inline at the call site so the caller can skip
 * downloading this module for multi-line notes and long key blobs.
 */
export function looksLikeCredential(value: string): boolean {
    return value.length >= 4 && value.length <= 100 && !/[\n\r]/.test(value) && value.trim().split(/\s+/).length <= 8;
}

function poolSize(value: string): number {
    let pool = 0;
    for (const [re, size] of CLASS_SIZES) if (re.test(value)) pool += size;
    return pool || 26;
}

/** Length of the pattern run starting at i: same char, ±1 code point, or one keyboard row. */
function runLength(value: string, i: number): number {
    const a = value.charCodeAt(i);
    const b = value.charCodeAt(i + 1);
    if (Number.isNaN(b)) return 1;

    const step = b - a;
    if (step === 0 || step === 1 || step === -1) {
        let n = 2;
        while (value.charCodeAt(i + n) - value.charCodeAt(i + n - 1) === step) n++;
        if (n >= 3) return n;
    }

    const lower = value.toLowerCase();
    for (const row of ROWS) {
        const start = row.indexOf(lower[i]!);
        if (start < 0 || row[start + 1] !== lower[i + 1] && row[start - 1] !== lower[i + 1]) continue;
        const dir = row[start + 1] === lower[i + 1] ? 1 : -1;
        let n = 2;
        while (row[start + dir * n] && row[start + dir * n] === lower[i + n]) n++;
        if (n >= 3) return n;
    }
    return 1;
}

function deLeet(value: string): string {
    return value.toLowerCase().replace(/[@48(369 1!|05$7+2]/g, (c) => LEET[c] ?? c);
}

/**
 * Bits for a dictionary hit: the word index, plus a couple of bits per decoration.
 * Both the plain and the de-leeted core are tried — "Password1" must not survive by
 * having its 1 rewritten into an i.
 */
function dictionaryBits(value: string): number | null {
    const strip = (s: string) => s.replace(/^[^a-z]+/, '').replace(/[^a-z]+$/, '');
    const plain = strip(value.toLowerCase());
    const leet = strip(deLeet(value));
    const core = COMMON.has(plain) ? plain : COMMON.has(leet) ? leet : null;
    if (core === null) return null;
    return Math.log2(COMMON.size) + (value.length - core.length) * 2.5;
}

/**
 * Word-shaped input is picked from a vocabulary, not from a character set, so charge
 * per word (~11 bits, the usual figure for a human-chosen word) instead of per
 * character. This is what stops "company-name-2024" and "correcthorsebatterystaple"
 * from scoring like the 17 and 25 random characters they are not.
 *
 * Random passwords are left alone: their letter runs are short and mixed-case, so
 * they never pass the all-lowercase-or-Capitalised test below.
 */
function wordBits(value: string): number | null {
    // Split camelCase too: "CompanyName2024" is two dictionary words, not 15 random
    // characters, and without this boundary it slips through as one unrecognisable token.
    const tokens = value.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^A-Za-z]+/).filter((t) => t.length >= 3);
    if (tokens.length === 0) return null;

    const letters = tokens.join('').length;
    if (letters < value.length * 0.5) return null;
    if (!tokens.every((t) => /^[a-z]+$/.test(t) || /^[A-Z][a-z]+$/.test(t))) return null;

    // A long unbroken token is almost always several words run together; ~8 letters each.
    const words = tokens.reduce((sum, t) => sum + Math.ceil(t.length / 8), 0);
    // Digits and punctuation glued around words are near-free; whitespace is free.
    const extras = value.replace(/[A-Za-z\s]/g, '').length;
    return words * 11 + extras * 2;
}

function humaniseTime(seconds: number): string {
    if (seconds < 1) return 'instantly';
    // Each entry names the unit you land in *after* dividing, not the one you left.
    const units: Array<[number, string]> = [
        [60, 'minute'], [60, 'hour'], [24, 'day'], [30, 'month'], [12, 'year'],
    ];
    let value = seconds;
    let name = 'second';
    for (const [factor, next] of units) {
        if (value < factor) break;
        value /= factor;
        name = next;
    }
    if (name === 'year' && value >= 100) return 'centuries';
    const rounded = Math.round(value);
    return `${rounded} ${name}${rounded === 1 ? '' : 's'}`;
}

const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'];

export function estimate(value: string): Estimate {
    if (!looksLikeCredential(value)) return NOT_RATED;

    const pool = poolSize(value);
    const perChar = Math.log2(pool);

    // Walk the string, charging full entropy for unpredictable characters and only
    // "where does it start + how long is it" for runs like aaaa / 1234 / qwerty.
    let bits = 0;
    let patterned = false;
    for (let i = 0; i < value.length;) {
        const run = runLength(value, i);
        if (run >= 3) {
            bits += perChar + Math.log2(run) + 1;
            patterned = true;
            i += run;
        } else {
            bits += perChar;
            i++;
        }
    }

    const words = wordBits(value);
    if (words !== null) bits = Math.min(bits, words);

    const dictionary = dictionaryBits(value);
    if (dictionary !== null) bits = Math.min(bits, dictionary);

    // Dates are a tiny slice of the digit space people actually pick from.
    const dated = /(19|20)\d{2}/.test(value);
    if (dated) bits -= 5;
    if (/^\d+$/.test(value) && value.length <= 8) bits = Math.min(bits, 16);

    bits = Math.max(0, Math.round(bits));

    const score: Score = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
    // Offline attack against a fast hash; halved because the average hit is mid-space.
    const crackTime = humaniseTime(Math.pow(2, Math.min(bits, 200)) / 2 / 1e10);

    let hint;
    if (dictionary !== null) hint = 'This is on every breach list — attackers try it first.';
    else if (score === 4) hint = '';
    else if (patterned) hint = 'Runs like 1234 or qwerty barely count. Break the pattern.';
    else if (dated) hint = 'A year gives away most of the guesses. Drop it.';
    else if (words !== null) hint = 'Words are guessed as words, not as letters. Add more of them.';
    else if (value.length < 12) hint = 'Length wins: 16+ characters beats any clever substitution.';
    else if (pool <= 26) hint = 'Mix in capitals, digits or symbols.';
    else hint = 'Add a few more characters.';

    return {rated: true, score, bits, label: LABELS[score]!, crackTime, hint};
}
