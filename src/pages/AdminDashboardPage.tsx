import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

type AdminUser = {
    id: number;
    name: string;
    email: string;
    role: string;
    username?: string;
    is_suspended: boolean;
    created_at: string;
};

type AdminCourse = {
    id: number;
    title: string;
    description: string;
    price: number | string;
    category?: string;
    total_sessions?: number;
    instructor_id?: number;
    instructor_name?: string;
    created_at: string;
};

type AdminReport = {
    id: number;
    category: string;
    details: string;
    status: string;
    priority: string;
    created_at: string;
    reporter_name?: string;
    reported_user_name?: string;
    course_title?: string;
};

type AdminAudit = {
    id: number;
    action_type: string;
    reason?: string;
    created_at: string;
    target_user_id?: number;
    target_course_id?: number;
    admin_name?: string;
};

export function AdminDashboardPage() {
    const { user } = useAuth();
    const [tab, setTab] = useState<'users' | 'courses' | 'reports' | 'audit'>('users');
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [courses, setCourses] = useState<AdminCourse[]>([]);
    const [reports, setReports] = useState<AdminReport[]>([]);
    const [audit, setAudit] = useState<AdminAudit[]>([]);
    const [statusMessage, setStatusMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setStatusMessage('');
    }, [tab]);

    useEffect(() => {
        if (tab === 'users') {
            loadUsers();
        }
        if (tab === 'courses') {
            loadCourses();
        }
        if (tab === 'reports') {
            loadReports();
        }
        if (tab === 'audit') {
            loadAudit();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/users?q=${encodeURIComponent(query.trim())}`);
            setUsers(res.data || []);
        } catch (error: any) {
            setStatusMessage(error?.response?.data?.message || 'Failed to load users.');
        } finally {
            setLoading(false);
        }
    };

    const loadCourses = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/courses?q=${encodeURIComponent(query.trim())}`);
            setCourses(res.data || []);
        } catch (error: any) {
            setStatusMessage(error?.response?.data?.message || 'Failed to load courses.');
        } finally {
            setLoading(false);
        }
    };

    const loadReports = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/reports?status=open');
            setReports(res.data || []);
        } catch (error: any) {
            setStatusMessage(error?.response?.data?.message || 'Failed to load reports.');
        } finally {
            setLoading(false);
        }
    };

    const loadAudit = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/audit');
            setAudit(res.data || []);
        } catch (error: any) {
            setStatusMessage(error?.response?.data?.message || 'Failed to load audit log.');
        } finally {
            setLoading(false);
        }
    };

    const deleteUser = async (id: number) => {
        const confirmed = window.confirm('Delete this user? This will remove their courses and data.');
        if (!confirmed) return;
        try {
            const res = await api.delete(`/admin/users/${id}`, { data: { reason: 'Admin removal' } });
            setStatusMessage(`User deleted. Courses removed: ${res.data?.coursesDeleted || 0}. Refunds: ${res.data?.refundInitiated || 0}.`);
            loadUsers();
        } catch (error: any) {
            setStatusMessage(error?.response?.data?.message || 'Failed to delete user.');
        }
    };

    const deleteCourse = async (id: number) => {
        const confirmed = window.confirm('Delete this course? Enrolled students will be unenrolled and refunds initiated for incomplete sessions.');
        if (!confirmed) return;
        try {
            const res = await api.delete(`/admin/courses/${id}`, { data: { reason: 'Admin removal' } });
            setStatusMessage(`Course deleted. Unenrolled: ${res.data?.unenrolledCount || 0}. Refunds: ${res.data?.refundInitiated || 0}.`);
            loadCourses();
        } catch (error: any) {
            setStatusMessage(error?.response?.data?.message || 'Failed to delete course.');
        }
    };

    const resolveReport = async (id: number, status: 'resolved' | 'dismissed' | 'in_review') => {
        try {
            await api.patch(`/admin/reports/${id}/resolve`, { status });
            setStatusMessage(`Report ${status}.`);
            loadReports();
        } catch (error: any) {
            setStatusMessage(error?.response?.data?.message || 'Failed to update report.');
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold">Admin access only</h1>
                <p className="text-sm text-muted-foreground">Please login with an admin account.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Admin Control Center</h1>
                    <p className="text-sm text-muted-foreground">Manage users, courses, reports, and audit activity.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {['users', 'courses', 'reports', 'audit'].map((item) => (
                        <button
                            key={item}
                            onClick={() => setTab(item as any)}
                            className={`px-4 py-2 rounded-md text-sm border ${tab === item ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
                        >
                            {item.charAt(0).toUpperCase() + item.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {(tab === 'users' || tab === 'courses') && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name, email, title, category..."
                        className="flex-1 h-10 px-3 rounded-md border bg-background"
                    />
                    <button
                        onClick={tab === 'users' ? loadUsers : loadCourses}
                        className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm"
                    >
                        Search
                    </button>
                </div>
            )}

            {statusMessage && (
                <div className="text-sm border rounded-md p-3 bg-secondary/10">{statusMessage}</div>
            )}

            {loading && <div className="text-sm text-muted-foreground">Loading...</div>}

            {tab === 'users' && (
                <div className="grid md:grid-cols-2 gap-4">
                    {users.map((person) => (
                        <div key={person.id} className="p-4 border rounded-md bg-card space-y-2">
                            <div className="font-semibold">{person.username || person.name}</div>
                            <div className="text-xs text-muted-foreground">{person.email}</div>
                            <div className="text-xs capitalize">Role: {person.role}</div>
                            {person.is_suspended && <div className="text-xs text-red-500">Suspended</div>}
                            <button
                                onClick={() => deleteUser(person.id)}
                                className="text-xs px-3 py-1 rounded-md border border-red-500 text-red-600"
                            >
                                Delete User
                            </button>
                        </div>
                    ))}
                    {!loading && users.length === 0 && (
                        <div className="text-sm text-muted-foreground">No users found.</div>
                    )}
                </div>
            )}

            {tab === 'courses' && (
                <div className="grid md:grid-cols-2 gap-4">
                    {courses.map((course) => (
                        <div key={course.id} className="p-4 border rounded-md bg-card space-y-2">
                            <div className="font-semibold">{course.title}</div>
                            <div className="text-xs text-muted-foreground">{course.category || 'General'}</div>
                            <div className="text-xs">Tutor: {course.instructor_name || course.instructor_id}</div>
                            <div className="text-xs">Sessions: {course.total_sessions || 1}</div>
                            <button
                                onClick={() => deleteCourse(course.id)}
                                className="text-xs px-3 py-1 rounded-md border border-red-500 text-red-600"
                            >
                                Delete Course
                            </button>
                        </div>
                    ))}
                    {!loading && courses.length === 0 && (
                        <div className="text-sm text-muted-foreground">No courses found.</div>
                    )}
                </div>
            )}

            {tab === 'reports' && (
                <div className="space-y-3">
                    {reports.map((report) => (
                        <div key={report.id} className="p-4 border rounded-md bg-card space-y-2">
                            <div className="text-sm font-semibold">{report.category} • {report.priority}</div>
                            <div className="text-xs text-muted-foreground">Reporter: {report.reporter_name || 'Unknown'}</div>
                            <div className="text-xs">Reported: {report.reported_user_name || report.course_title || 'N/A'}</div>
                            <div className="text-sm">{report.details}</div>
                            <div className="flex gap-2 text-xs">
                                <button onClick={() => resolveReport(report.id, 'resolved')} className="px-2 py-1 rounded border">Resolve</button>
                                <button onClick={() => resolveReport(report.id, 'dismissed')} className="px-2 py-1 rounded border">Dismiss</button>
                                <button onClick={() => resolveReport(report.id, 'in_review')} className="px-2 py-1 rounded border">In Review</button>
                            </div>
                        </div>
                    ))}
                    {!loading && reports.length === 0 && (
                        <div className="text-sm text-muted-foreground">No open reports.</div>
                    )}
                </div>
            )}

            {tab === 'audit' && (
                <div className="space-y-3">
                    {audit.map((entry) => (
                        <div key={entry.id} className="p-3 border rounded-md bg-card text-sm">
                            <div className="font-semibold">{entry.action_type}</div>
                            <div className="text-xs text-muted-foreground">{entry.admin_name} • {new Date(entry.created_at).toLocaleString()}</div>
                            {entry.reason && <div className="text-xs">{entry.reason}</div>}
                        </div>
                    ))}
                    {!loading && audit.length === 0 && (
                        <div className="text-sm text-muted-foreground">No audit entries yet.</div>
                    )}
                </div>
            )}
        </div>
    );
}
