import {defineConfig} from 'astro/config';

const PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8080';

// Headers managed by the runtime — must NOT be forwarded as-is, or the upstream
// gets a wrong Content-Length / Host / mismatched Connection state.
const STRIPPED_REQUEST_HEADERS = new Set([
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'accept-encoding',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
    'connection',
    'content-length',
    'transfer-encoding',
    'content-encoding',
]);

/**
 * Dev-only Vite plugin: forward /api/* to the Go backend.
 *
 * Registered via `configureServer`, which runs ahead of Astro's route matcher
 * in the Connect middleware chain. This avoids the body-consumption race that
 * Astro middleware hit when /api/* fell through to the prerendered 404.
 *
 * In production this plugin doesn't run — nginx handles /api/* directly.
 */
function devApiProxy() {
    return {
        name: 'dev-api-proxy',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (!req.url || !req.url.startsWith('/api/')) {
                    return next();
                }

                // Normalize trailing slash to match what the Go handler expects (/api/foo, not /api/foo/).
                const cleanUrl = req.url.replace(/\/+(\?|$)/, '$1');
                const target = PROXY_TARGET + cleanUrl;

                const forwardHeaders = new Headers();
                for (const [name, value] of Object.entries(req.headers)) {
                    if (value === undefined) continue;
                    if (STRIPPED_REQUEST_HEADERS.has(name.toLowerCase())) continue;
                    forwardHeaders.set(name, Array.isArray(value) ? value.join(',') : value);
                }

                let body;
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    const chunks = [];
                    for await (const chunk of req) {
                        chunks.push(chunk);
                    }
                    body = Buffer.concat(chunks);
                }

                try {
                    const upstream = await fetch(target, {
                        method: req.method,
                        headers: forwardHeaders,
                        body,
                    });
                    res.statusCode = upstream.status;
                    for (const [name, value] of upstream.headers) {
                        if (STRIPPED_RESPONSE_HEADERS.has(name.toLowerCase())) continue;
                        res.setHeader(name, value);
                    }
                    if (upstream.status === 204 || upstream.status === 304) {
                        res.end();
                        return;
                    }
                    const data = Buffer.from(await upstream.arrayBuffer());
                    res.end(data);
                } catch (err) {
                    res.statusCode = 502;
                    res.end(`Dev API proxy failed: ${(err instanceof Error ? err.message : String(err))}`);
                }
            });
        },
    };
}

export default defineConfig({
    outDir: './dist',
    trailingSlash: 'ignore',
    build: {
        inlineStylesheets: 'always',
        assets: '_astro',
    },
    compressHTML: true,
    vite: {
        plugins: [devApiProxy()],
    },
});
