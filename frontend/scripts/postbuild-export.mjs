import {existsSync, rmSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const buildDir = path.resolve(process.cwd(), 'build');

// ── 1. Remove blog directory if disabled ────────────────────────────
const blogEnabled = process.env.NEXT_PUBLIC_SHOW_BLOG !== 'false';
const blogDir = path.join(buildDir, 'blog');

if (!blogEnabled && existsSync(blogDir)) {
  rmSync(blogDir, {recursive: true, force: true});
}

// ── 2. Replace async→defer on external scripts for better LCP ──────
//
// Next.js adds <script src="..." async=""> to every page. Async scripts
// execute as soon as they download, which blocks the main thread and
// delays first paint by 1-3s on throttled connections (Lighthouse mobile).
//
// Changing to defer ensures:
//   1. Scripts download in parallel (same as async)
//   2. Scripts execute AFTER HTML parsing and first paint
//   3. Scripts execute in document order (safer for dependencies)
//
// For a static export this is safe — the HTML already contains all
// visible content; the scripts only add React hydration/interactivity.
//
// Also removes duplicate font preload tags that Next.js auto-generates
// alongside our explicit ones from layout.jsx.

function optimizeHtmlFile(filePath) {
  let html = readFileSync(filePath, 'utf8');
  const original = html;

  // async="" → defer on external scripts (not inline, not noModule).
  // Handles any attribute order: src before async, or other attrs in between.
  html = html.replace(/<script ([^>]*?)async=""([^>]*)>/g, (match, before, after) => {
    // Skip noModule polyfill scripts — they only run in legacy browsers
    if (match.includes('noModule')) return match;
    return `<script ${before}defer${after}>`;
  });

  // Deduplicate font preload tags (Next.js + layout.jsx both emit them)
  const seen = new Set();
  html = html.replace(/<link rel="preload" href="([^"]+\.woff2)"[^>]*\/>/g, (match, href) => {
    if (seen.has(href)) return ''; // drop duplicate
    seen.add(href);
    return match;
  });

  if (html !== original) {
    writeFileSync(filePath, html, 'utf8');
  }
}

function walkHtml(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtml(full);
    } else if (entry.name === 'index.html' || entry.name === '404.html') {
      optimizeHtmlFile(full);
    }
  }
}

walkHtml(buildDir);
