import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

type TutorCourse = {
    id: number;
    title: string;
    description: string;
    category?: string;
    price?: number;
};

type TutorDetail = {
    id: number;
    name: string;
    username?: string;
    profession?: string;
    education_qualification?: string;
    courses_count: number;
    learners_count: number;
    courses: TutorCourse[];
};

export function TutorDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [tutor, setTutor] = useState<TutorDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [topic, setTopic] = useState('');
    const [message, setMessage] = useState('');
    const [preferredTime, setPreferredTime] = useState('');
    const [status, setStatus] = useState('');

    const fetchTutor = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await api.get(`/tutors/${id}`);
            setTutor(res.data);
        } catch (error: any) {
            setStatus(error?.response?.data?.message || 'Failed to load tutor profile.');
            setTutor(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTutor();
    }, [id]);

    const sendClassRequest = async () => {
        if (!id || !topic.trim()) {
            setStatus('Please enter a topic for class request.');
            return;
        }
        try {
            await api.post('/class-requests', {
                tutorId: Number(id),
                topic: topic.trim(),
                message: message.trim(),
                preferredTime: preferredTime || null,
            });
            setStatus('Class request sent.');
            setTopic('');
            setMessage('');
            setPreferredTime('');
        } catch (error: any) {
            setStatus(error?.response?.data?.message || 'Failed to send class request.');
        }
    };

    if (loading) {
        return <div className="container mx-auto px-4 py-8">Loading tutor...</div>;
    }
    if (!tutor) {
        return <div className="container mx-auto px-4 py-8">{status || 'Tutor not found.'}</div>;
    }

    const isSelf = Number(user?.id) === Number(tutor.id);

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <div className="p-5 rounded-lg border bg-card">
                <h1 className="text-2xl font-bold">{tutor.username || tutor.name}</h1>
                <p className="text-sm text-muted-foreground">{tutor.profession || tutor.education_qualification || 'Tutor'}</p>
                <p className="text-xs text-muted-foreground mt-1">Courses: {tutor.courses_count} | Learners: {tutor.learners_count}</p>
            </div>

            {!isSelf && (
                <section className="p-5 rounded-lg border bg-card space-y-3">
                    <h2 className="text-xl font-semibold">Request a Class</h2>
                    <input
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Topic you want help with"
                        className="w-full h-10 px-3 rounded-md border bg-background"
                    />
                    <input
                        type="datetime-local"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border bg-background"
                    />
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Optional message"
                        className="w-full min-h-[90px] px-3 py-2 rounded-md border bg-background"
                    />
                    <button onClick={sendClassRequest} className="px-4 py-2 rounded-md bg-primary text-primary-foreground">
                        Send Request
                    </button>
                    {status && <p className="text-sm">{status}</p>}
                </section>
            )}

            <section className="p-5 rounded-lg border bg-card space-y-3">
                <h2 className="text-xl font-semibold">Courses by Tutor</h2>
                {tutor.courses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No courses yet.</p>
                ) : (
                    <div className="space-y-2">
                        {tutor.courses.map((course) => (
                            <Link key={course.id} to={`/courses/${course.id}`} className="block p-3 rounded-md border hover:bg-muted/30">
                                <div className="font-medium">{course.title}</div>
                                <div className="text-sm text-muted-foreground">{course.description}</div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
