
import {Constants} from './util';

export const siteHostDefault = '1time.io';
export const siteTitleDefault = "1time<span>io</span>";
import siteDefaultLogo from './siteLogo.svg?raw';
export const siteHost = import.meta.env.PUBLIC_SITE_HOST || siteHostDefault;
export const siteTitle = import.meta.env.PUBLIC_SITE_TITLE || siteTitleDefault;
export const siteLogo = import.meta.env.PUBLIC_SITE_LOGO || siteDefaultLogo;

export const siteUrl = `https://${siteHost}`;

export const chromeStoreUrl = 'https://chromewebstore.google.com/detail/1time-%E2%80%94-one-time-secret-l/oclenaeccacnolionlpiefekmmbppgkb';

export function isBlogEnabled() {
    return import.meta.env.PUBLIC_SHOW_BLOG !== 'false';
}

export function isContentEnabled() {
    return import.meta.env.PUBLIC_SHOW_CONTENT !== 'false';
}

export async function getMaxFileSizeBytes() {
    try {
        const url = `${Constants.apiBaseUrl}status`;
        const response = await fetch(url);
        const data = await response.json();
        return data.maxFileSizeBytes || 256 * 1024 * 1024;
    } catch (error) {
        return 256 * 1024 * 1024;
    }
}

export function absoluteUrl(path = '/') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return new URL(normalizedPath, `${siteUrl}/`).toString();
}
