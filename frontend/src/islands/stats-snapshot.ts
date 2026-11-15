import {postJson} from '../lib/util.js';

interface SnapshotResponse {
    overallStoredSecrets?: number;
    overallStoredFiles?: number;
    flushIntervalSeconds?: number;
    apiVersion?: number;
    version?: string;
    startedAt?: string;
    // Scheme 0 is the original scheme, presented as "v2" for humans — the
    // wire value stayed 0 so existing records need no migration.
    saveSchemes?: number[];
}

const root = document.querySelector<HTMLElement>('#stats-page');
if (root) {
    const secretsEl = root.querySelector<HTMLElement>('[data-stat-secrets]')!;
    const filesEl = root.querySelector<HTMLElement>('[data-stat-files]')!;
    const statusEl = root.querySelector<HTMLElement>('[data-stat-status]')!;
    const apiVersionEl = root.querySelector<HTMLElement>('[data-stat-apiversion]')!;
    const schemesEl = root.querySelector<HTMLElement>('[data-stat-schemes]')!;
    const versionEl = root.querySelector<HTMLElement>('[data-stat-version]')!;
    const startedEl = root.querySelector<HTMLElement>('[data-stat-started]')!;

    const fmt = (n: number) => n.toLocaleString();

    const fmtUtc = (iso?: string) => {
        const d = new Date(iso ?? '');
        return Number.isNaN(d.getTime()) ? '—' : `${d.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
    };

    const setStatus = (state: 'loading' | 'ready' | 'error') => {
        statusEl.textContent = state;
        statusEl.className = `stats-status stats-status-${state}`;
    };

    void (async () => {
        try {
            const data: SnapshotResponse = await postJson('ss', {});
            secretsEl.textContent = fmt(data.overallStoredSecrets ?? 0);
            filesEl.textContent = fmt(data.overallStoredFiles ?? 0);
            apiVersionEl.textContent = data.apiVersion == null ? '—' : `v${data.apiVersion}`;
            // Which save schemes this build accepts. Shown because an operator
            // deciding whether a rollback is safe needs to know whether the
            // deployed binary understands v3 records.
            schemesEl.textContent = data.saveSchemes?.length
                ? data.saveSchemes.map((s) => `v${s === 0 ? 2 : s}`).join(', ')
                : '—';
            versionEl.textContent = data.version?.replace(/[0-9a-f]{40}/g, (sha) => sha.slice(0, 12)) || '—';
            if (data.version) versionEl.title = data.version;
            startedEl.textContent = fmtUtc(data.startedAt);

            setStatus('ready');
        } catch {
            setStatus('error');
        }
    })();
}
