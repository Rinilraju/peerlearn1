import { useEffect, useState } from 'react';
import api from '../api';

type Notification = {
    id: number;
    title: string;
    body: string;
    type: string;
    is_read: boolean;
    created_at: string;
};

export function NotificationsPage() {
    const [items, setItems] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/notifications/mine');
            setItems(res.data || []);
        } catch (error) {
            console.error('Failed to load notifications:', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const markRead = async (id: number) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
        } catch (error) {
            console.error('Failed to mark read:', error);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Notifications</h1>
                <button onClick={load} className="px-3 py-2 border rounded">Refresh</button>
            </div>
            {loading ? <p>Loading notifications...</p> : (
                <div className="space-y-2">
                    {items.map((item) => (
                        <div key={item.id} className={`p-3 border rounded ${item.is_read ? 'opacity-70' : ''}`}>
                            <div className="font-medium">{item.title}</div>
                            <div className="text-sm text-muted-foreground">{item.body}</div>
                            <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
                            {!item.is_read && (
                                <button onClick={() => markRead(item.id)} className="text-xs text-primary hover:underline mt-1">
                                    Mark read
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
