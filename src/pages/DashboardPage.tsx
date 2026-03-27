import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CourseCard } from '../components/CourseCard';
import { Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';

type FoundUser = {
    id: number;
    name: string;
    username?: string;
    role: string;
};

type ClassRequest = {
    id: number;
    requester_id: number;
    tutor_id: number;
    topic: string;
    message?: string;
    preferred_time?: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
    requester_name?: string;
    requester_username?: string;
    tutor_name?: string;
    tutor_username?: string;
};

export function DashboardPage() {
    const { user } = useAuth();
    const [myCourses, setMyCourses] = useState<any[]>([]);
    const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
    const [recommendedCourses, setRecommendedCourses] = useState<any[]>([]);
    const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [foundUsers, setFoundUsers] = useState<FoundUser[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<ClassRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<ClassRequest[]>([]);
    const [requestStatus, setRequestStatus] = useState('');

    const mapCourse = (course: any) => ({
        ...course,
        title: (String(course.title || '').trim() || 'Untitled Course'),
        description: (String(course.description || '').trim() || 'Description will be updated soon.'),
        image: course.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60',
        price: parseFloat(course.price) || 0,
        rating: 4.5,
        reviews: 0,
        enrolled: 0,
        instructor: course.instructor_name || user?.name || 'PeerLearn Instructor',
    });

    useEffect(() => {
        const fetchDashboardCourses = async () => {
            try {
                const [mineRes, enrolledRes, recRes] = await Promise.all([
                    api.get('/courses/my-courses'),
                    api.get('/courses/enrolled'),
                    api.get('/recommendations/courses?limit=4'),
                ]);
                const sessionsRes = await api.get('/sessions/mine');
                const now = Date.now();
                const upcoming = sessionsRes.data
                    .filter((s: any) => new Date(s.scheduled_at).getTime() >= now && s.status !== 'completed')
                    .slice(0, 5);

                setMyCourses(mineRes.data.map(mapCourse));
                setEnrolledCourses(enrolledRes.data.map(mapCourse));
                setRecommendedCourses(recRes.data.map(mapCourse));
                setUpcomingSessions(upcoming);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchDashboardCourses();
    }, [user]);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const [incomingRes, outgoingRes] = await Promise.all([
                    api.get('/class-requests/incoming'),
                    api.get('/class-requests/outgoing'),
                ]);
                setIncomingRequests(incomingRes.data || []);
                setOutgoingRequests(outgoingRes.data || []);
            } catch (error) {
                console.error('Failed to fetch class requests:', error);
            }
        };
        fetchRequests();
    }, []);

    useEffect(() => {
        const query = userSearch.trim();
        if (query.length < 2) {
            setFoundUsers([]);
            return;
        }
        const timeoutId = window.setTimeout(async () => {
            try {
                const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
                setFoundUsers(res.data || []);
            } catch (error) {
                console.error('Failed to search users:', error);
                setFoundUsers([]);
            }
        }, 250);
        return () => window.clearTimeout(timeoutId);
    }, [userSearch]);

    const updateRequestStatus = async (id: number, status: 'accepted' | 'rejected') => {
        try {
            await api.patch(`/class-requests/${id}/status`, { status });
            setIncomingRequests((prev) => prev.map((item) => (
                item.id === id ? { ...item, status } : item
            )));
            setRequestStatus(`Request ${status}.`);
        } catch (error: any) {
            setRequestStatus(error?.response?.data?.message || 'Failed to update request.');
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Welcome back, {user?.name}! Here's what's happening today.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link
                        to="/sessions"
                        className="inline-flex items-center px-4 py-2 border rounded-md hover:bg-muted transition-colors"
                    >
                        Sessions & Chat
                    </Link>
                    {(user?.role === 'tutor' || user?.role === 'admin' || user?.role === 'student') && (
                        <Link
                            to="/create-course"
                            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Course
                        </Link>
                    )}
                </div>
            </div>

            <section className="p-4 border rounded-lg space-y-3">
                <h2 className="text-xl font-semibold">Search Users</h2>
                <div className="relative max-w-xl">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search by username or name..."
                        className="w-full h-10 pl-10 pr-3 rounded-md border bg-background"
                    />
                </div>
                {foundUsers.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-2">
                        {foundUsers.map((person) => (
                            <Link key={person.id} to={`/users/${person.id}`} className="p-3 rounded border hover:bg-muted/40">
                                <div className="font-medium">{person.username || person.name}</div>
                                <div className="text-xs text-muted-foreground capitalize">{person.role}</div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">

                    {/* My Created Courses Section */}
                    {myCourses.length > 0 && (
                        <section>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold">My Created Courses</h2>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {myCourses.map(course => (
                                    <CourseCard key={course.id} course={course} />
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold">Your Enrolled Courses</h2>
                            <Link to="/courses" className="text-primary hover:underline text-sm">View All</Link>
                        </div>
                        {enrolledCourses.length > 0 ? (
                            <div className="grid sm:grid-cols-2 gap-4">
                                {enrolledCourses.map(course => (
                                    <CourseCard key={course.id} course={course} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No enrollments yet. Enroll in a course to see it here.</p>
                        )}
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4">Recommended For You</h2>
                        {recommendedCourses.length > 0 ? (
                            <div className="grid sm:grid-cols-2 gap-4">
                                {recommendedCourses.map(course => (
                                    <CourseCard key={course.id} course={course} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No recommendations yet. Browse courses to get personalized suggestions.</p>
                        )}
                    </section>
                </div>

                <div className="space-y-6">
                    <section>
                        <h2 className="text-xl font-bold mb-4">Class Requests</h2>
                        {requestStatus && <div className="text-xs border rounded p-2 mb-2">{requestStatus}</div>}
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-sm mb-2">Incoming</h3>
                                {incomingRequests.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No incoming requests.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {incomingRequests.slice(0, 5).map((request) => (
                                            <div key={request.id} className="p-3 border rounded bg-card space-y-1">
                                                <div className="text-sm font-medium">{request.requester_username || request.requester_name}</div>
                                                <div className="text-xs text-muted-foreground">{request.topic}</div>
                                                {request.message && <div className="text-xs">{request.message}</div>}
                                                <div className="text-xs capitalize">Status: {request.status}</div>
                                                {request.status === 'pending' && (
                                                    <div className="flex gap-2 pt-1">
                                                        <button onClick={() => updateRequestStatus(request.id, 'accepted')} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">Accept</button>
                                                        <button onClick={() => updateRequestStatus(request.id, 'rejected')} className="text-xs px-2 py-1 rounded border">Reject</button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm mb-2">Outgoing</h3>
                                {outgoingRequests.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No outgoing requests.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {outgoingRequests.slice(0, 5).map((request) => (
                                            <div key={request.id} className="p-3 border rounded bg-card">
                                                <div className="text-sm font-medium">{request.tutor_username || request.tutor_name}</div>
                                                <div className="text-xs text-muted-foreground">{request.topic}</div>
                                                <div className="text-xs capitalize">Status: {request.status}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">Upcoming Live Sessions</h2>
                        {upcomingSessions.length > 0 ? (
                            <div className="space-y-3">
                                {upcomingSessions.map((session) => (
                                    <div key={session.id} className="p-3 border rounded-md bg-card">
                                        <div className="font-medium">{session.course_title}</div>
                                        <div className="text-sm text-muted-foreground">{new Date(session.scheduled_at).toLocaleString()}</div>
                                        <div className="text-xs text-muted-foreground">Status: {session.status}</div>
                                        {(session.can_join || session.can_start) && (
                                            <Link to="/sessions" className="inline-block mt-2 text-primary text-sm hover:underline">Open Session Controls</Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No upcoming sessions.</p>
                        )}
                    </section>

                    <div className="p-4 rounded-lg bg-secondary/20 border border-secondary">
                        <h3 className="font-semibold mb-2">Quick Stats</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Courses Completed</span>
                                <span className="font-mono font-bold">12</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Hours Learned</span>
                                <span className="font-mono font-bold">48</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Sessions Attended</span>
                                <span className="font-mono font-bold">5</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Courses Created</span>
                                <span className="font-mono font-bold">{myCourses.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
