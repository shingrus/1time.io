export const siteHostDefault = '1time.io';
export const siteHost = import.meta.env.PUBLIC_SITE_HOST || siteHostDefault;
export const siteUrl = `https://${siteHost}`;

export const chromeStoreUrl = 'https://chromewebstore.google.com/detail/1time-%E2%80%94-one-time-secret-l/oclenaeccacnolionlpiefekmmbppgkb';

/**
 * Self-hosted edition: `SELF_HOSTED=true npm run build` (the default for every
 * Docker build). It ships only the tool — text and file forms, the password
 * generator, the view pages and My Secrets — with no SEO copy, structured data
 * or marketing pages. astro.config.mjs maps SELF_HOSTED onto this PUBLIC_ name,
 * and scripts/prune-selfhosted.mjs removes every page not on its allowlist.
 */
export function isSelfHosted() {
    return import.meta.env.PUBLIC_SELF_HOSTED === 'true';
}

/** Every self-hosted page shares one title: the instance is a tool, not a landing page. */
export const selfHostedTitle = '1time.io — One-time secret';

export function absoluteUrl(path = '/') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return new URL(normalizedPath, `${siteUrl}/`).toString();
}
