'use client';

import '../styles/stats.css';
import {useEffect, useState} from 'react';
import {postJson} from '../utils/util';

const EMPTY_STATS = {
    overallStoredSecrets: 0,
    overallStoredFiles: 0,
    pendingPageHits: {},
    pendingPageHitsTotal: 0,
    flushIntervalSeconds: 10,
};

export default function StatsSnapshot() {
    const [stats, setStats] = useState(EMPTY_STATS);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        let mounted = true;

        const loadStats = async () => {
            try {
                const data = await postJson('ss', {});
                if (!mounted) {
                    return;
                }

                setStats({
                    overallStoredSecrets: data.overallStoredSecrets ?? 0,
                    overallStoredFiles: data.overallStoredFiles ?? 0,
                    pendingPageHits: data.pendingPageHits ?? {},
                    pendingPageHitsTotal: data.pendingPageHitsTotal ?? 0,
                    flushIntervalSeconds: data.flushIntervalSeconds ?? 10,
                });
                setStatus('ready');
            } catch (error) {
                if (mounted) {
                    setStatus('error');
                }
            }
        };

        loadStats();

        return () => {
            mounted = false;
        };
    }, []);

    const pageHitEntries = Object.entries(stats.pendingPageHits);

    return (
        <div className="stats-page">
            <div className="stats-header">
                <h1>In-Memory Stats</h1>
            </div>

            <div className="stats-grid">
                <section className="stats-card">
                    <span className="stats-label">Stored secrets</span>
                    <strong className="stats-value">{stats.overallStoredSecrets.toLocaleString()}</strong>
                </section>
                <section className="stats-card">
                    <span className="stats-label">Stored files</span>
                    <strong className="stats-value">{stats.overallStoredFiles.toLocaleString()}</strong>
                </section>
                <section className="stats-card">
                    <span className="stats-label">Buffered page hits</span>
                    <strong className="stats-value">{stats.pendingPageHitsTotal.toLocaleString()}</strong>
                </section>
            </div>

            <section className="stats-table-card">
                <div className="stats-table-header">
                    <h2>Pending page-hit buckets</h2>
                    <span className={`stats-status stats-status-${status}`}>
                        {status}
                    </span>
                </div>

                {pageHitEntries.length === 0 ? (
                    <p className="stats-empty">No buffered page hits at the moment.</p>
                ) : (
                    <div className="stats-table">
                        {pageHitEntries.map(([page, count]) => (
                            <div className="stats-row" key={page}>
                                <span className="stats-row-key">{page}</span>
                                <strong className="stats-row-value">{count.toLocaleString()}</strong>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
