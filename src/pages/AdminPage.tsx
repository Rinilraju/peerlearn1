import { useEffect, useState } from 'react';
import api from '../api';

export function AdminPage() {
    const [stats, setStats] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const [statsRes, logsRes] = await Promise.all([
                    api.get('/admin/stats'),
                    api.get('/admin/audit-logs'),
                ]);
                setStats(statsRes.data);
                setLogs(logsRes.data || []);
            } catch (err: any) {
                setError(err?.response?.data?.message || 'Failed to load admin data.');
            }
        };
        load();
    }, []);

    if (error) {
        return <div className="container mx-auto px-4 py-8">{error}</div>;
    }
    if (!stats) {
        return <div className="container mx-auto px-4 py-8">Loading admin dashboard...</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats).map(([key, value]) => (
                    <div key={key} className="p-4 rounded border bg-card">
                        <div className="text-sm text-muted-foreground">{key}</div>
                        <div className="text-2xl font-bold">{String(value)}</div>
                    </div>
                ))}
            </div>

            <section className="p-4 rounded border bg-card">
                <h2 className="text-xl font-semibold mb-3">Recent Audit Logs</h2>
                <div className="space-y-2">
                    {logs.map((log) => (
                        <div key={log.id} className="text-sm border rounded p-2">
                            {log.created_at} | {log.method} {log.path} | user: {log.user_id ?? 'anon'}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
