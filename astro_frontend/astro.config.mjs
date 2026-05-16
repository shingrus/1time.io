import {defineConfig} from 'astro/config';

export default defineConfig({
    outDir: './dist',
    trailingSlash: 'ignore',
    build: {
        inlineStylesheets: 'always',
        assets: '_astro',
    },
    compressHTML: true,
});
