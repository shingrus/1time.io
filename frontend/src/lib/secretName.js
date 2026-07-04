/**
 * Deterministic two-word name for a secret ("flying penguin").
 *
 * Like the emoji fingerprint, the name is a pure function of the secret `id`,
 * so sender and receiver can independently derive the same label with nothing
 * stored server-side. It's a friendly ~12-bit checksum of the id (adjective +
 * animal), NOT authentication — the id is public to anyone holding the link.
 */
const ADJECTIVES = [
    'swift', 'brave', 'quiet', 'clever', 'gentle', 'mighty', 'cosmic', 'lucky',
    'sunny', 'misty', 'golden', 'silver', 'crimson', 'azure', 'jolly', 'nimble',
    'bold', 'calm', 'eager', 'fuzzy', 'witty', 'zesty', 'breezy', 'dizzy',
    'giddy', 'merry', 'plucky', 'snug', 'spry', 'chirpy', 'dapper', 'feisty',
    'frosty', 'glossy', 'hazy', 'jazzy', 'lively', 'peppy', 'quirky', 'rusty',
    'shiny', 'spicy', 'stormy', 'tidy', 'vivid', 'wavy', 'zippy', 'amber',
    'coral', 'emerald', 'ivory', 'jade', 'ruby', 'teal', 'velvet', 'wild',
    'noble', 'royal', 'humble', 'cheerful', 'dreamy', 'electric', 'lunar', 'blue',
    'secure', 'prime', 'global', 'rapid', 'cloud', 'quantum', 'vector', 'atlas',
    'apex', 'nova', 'cyber', 'hyper', 'agile', 'turbo', 'digital', 'sterling',
];

const ANIMALS = [
    'otter', 'whale', 'penguin', 'falcon', 'lynx', 'panda', 'fox', 'koala',
    'tiger', 'dolphin', 'badger', 'heron', 'ibis', 'jaguar', 'kestrel', 'lemur',
    'marten', 'narwhal', 'ocelot', 'puffin', 'quail', 'raven', 'seal', 'toucan',
    'urchin', 'viper', 'walrus', 'yak', 'zebra', 'beetle', 'cobra', 'crane',
    'dingo', 'egret', 'ferret', 'gecko', 'hare', 'iguana', 'jackal', 'kiwi',
    'llama', 'moose', 'newt', 'osprey', 'pelican', 'quokka', 'robin', 'salmon',
    'turtle', 'urial', 'vole', 'weasel', 'wombat', 'bison', 'camel', 'cheetah',
    'gopher', 'hedgehog', 'mongoose', 'octopus', 'sparrow', 'stoat', 'swan', 'wolf',
    'phoenix', 'griffin', 'drake', 'raptor', 'condor', 'marlin', 'orca', 'panther',
    'cougar', 'bobcat', 'stag', 'mustang', 'bull', 'ram', 'hawk', 'elk',
];

/**
 * FNV-1a 32-bit hash of a string, returned as an unsigned integer.
 */
function fnv1a(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/**
 * Returns a stable "adjective animal" name derived from `id`, or an empty
 * string for an empty/invalid id so callers can skip rendering.
 */
export function nameForId(id) {
    if (!id) {
        return '';
    }

    const adjective = ADJECTIVES[fnv1a(`${id}:0`) % ADJECTIVES.length];
    const animal = ANIMALS[fnv1a(`${id}:1`) % ANIMALS.length];
    return `${adjective}-${animal}`;
}
