import type {APIRoute} from 'astro';
import {absoluteUrl} from '../lib/siteConfig.js';

const AGENTS = ['*', 'GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];

export const GET: APIRoute = () => {
    const body = [
        ...AGENTS.flatMap((agent) => [`User-Agent: ${agent}`, 'Allow: /', 'Disallow: /my-secrets/', '']),
        `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
        '',
    ].join('\n');

    return new Response(body, {
        headers: {'Content-Type': 'text/plain'},
    });
};
