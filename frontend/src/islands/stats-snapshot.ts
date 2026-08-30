import {postJson} from '../lib/util.js';

interface SnapshotResponse {
    overallStoredSecrets?: number;
    overallStoredFiles?: number;
    pendingPageHits?: Record<string, number>;
    pendingPageHitsTotal?: number;
    flushIntervalSeconds?: number;
    apiVersion?: number;
    // Scheme 0 is the original scheme, presented as "v2" for humans — the
    // wire value stayed 0 so existing records need no migration.
    saveSchemes?: number[];
}

const root = document.querySelector<HTMLElement>('#stats-page');
if (root) {
    const secretsEl = root.querySelector<HTMLElement>('[data-stat-secrets]')!;
    const filesEl = root.querySelector<HTMLElement>('[data-stat-files]')!;
    const pendingEl = root.querySelector<HTMLElement>('[data-stat-pending]')!;
    const statusEl = root.querySelector<HTMLElement>('[data-stat-status]')!;
    const tableEl = root.querySelector<HTMLElement>('[data-stat-table]')!;
    const emptyEl = root.querySelector<HTMLElement>('[data-stat-empty]')!;
    const apiVersionEl = root.querySelector<HTMLElement>('[data-stat-apiversion]')!;
    const schemesEl = root.querySelector<HTMLElement>('[data-stat-schemes]')!;

    const fmt = (n: number) => n.toLocaleString();

    const setStatus = (state: 'loading' | 'ready' | 'error') => {
        statusEl.textContent = state;
        statusEl.className = `stats-status stats-status-${state}`;
    };

    void (async () => {
        try {
            const data: SnapshotResponse = await postJson('ss', {});
            secretsEl.textContent = fmt(data.overallStoredSecrets ?? 0);
            filesEl.textContent = fmt(data.overallStoredFiles ?? 0);
            pendingEl.textContent = fmt(data.pendingPageHitsTotal ?? 0);
            apiVersionEl.textContent = data.apiVersion == null ? '—' : `v${data.apiVersion}`;
            // Which save schemes this build accepts. Shown because an operator
            // deciding whether a rollback is safe needs to know whether the
            // deployed binary understands v3 records.
            schemesEl.textContent = data.saveSchemes?.length
                ? data.saveSchemes.map((s) => `v${s === 0 ? 2 : s}`).join(', ')
                : '—';

            const entries = Object.entries(data.pendingPageHits ?? {});
            tableEl.replaceChildren();
            if (entries.length === 0) {
                emptyEl.toggleAttribute('hidden', false);
                tableEl.toggleAttribute('hidden', true);
            } else {
                emptyEl.toggleAttribute('hidden', true);
                tableEl.toggleAttribute('hidden', false);
                for (const [page, count] of entries) {
                    const row = document.createElement('div');
                    row.className = 'stats-row';
                    const key = document.createElement('span');
                    key.className = 'stats-row-key';
                    key.textContent = page;
                    const value = document.createElement('strong');
                    value.className = 'stats-row-value';
                    value.textContent = fmt(count);
                    row.append(key, value);
                    tableEl.append(row);
                }
            }

            setStatus('ready');
        } catch {
            setStatus('error');
        }
    })();
}
