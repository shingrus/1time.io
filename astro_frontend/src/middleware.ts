import {defineMiddleware} from 'astro:middleware';

const PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8080';

export const onRequest = defineMiddleware(async (context, next) => {
    if (!import.meta.env.DEV || !context.url.pathname.startsWith('/api/')) {
        return next();
    }

    const path = context.url.pathname.replace(/\/+$/, '') || '/';
    const target = PROXY_TARGET + path + context.url.search;
    const method = context.request.method;
    const init: RequestInit & {duplex?: 'half'} = {
        method,
        headers: context.request.headers,
    };
    if (method !== 'GET' && method !== 'HEAD') {
        init.body = context.request.body;
        init.duplex = 'half';
    }

    try {
        const upstream = await fetch(target, init);
        return new Response(upstream.body, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: upstream.headers,
        });
    } catch (err) {
        return new Response(`Dev API proxy failed: ${(err as Error).message}`, {status: 502});
    }
});
