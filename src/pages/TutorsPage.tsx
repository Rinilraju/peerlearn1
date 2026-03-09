import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

type Tutor = {
    id: number;
    name: string;
    username?: string;
    profession?: string;
    education_qualification?: string;
    courses_count: number;
    learners_count: number;
};

export function TutorsPage() {
    const [query, setQuery] = useState('');
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(true);
    const [tutors, setTutors] = useState<Tutor[]>([]);

    const fetchTutors = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/tutors?q=${encodeURIComponent(query)}&topic=${encodeURIComponent(topic)}`);
            setTutors(res.data || []);
        } catch (error) {
            console.error('Failed to fetch tutors:', error);
            setTutors([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTutors();
    }, []);

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <h1 className="text-3xl font-bold">Find Tutors</h1>

            <div className="grid md:grid-cols-3 gap-3">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search tutor name or username"
                    className="h-10 px-3 rounded-md border bg-background"
                />
                <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Topic (e.g. DBMS, React)"
                    className="h-10 px-3 rounded-md border bg-background"
                />
                <button onClick={fetchTutors} className="h-10 px-4 rounded-md bg-primary text-primary-foreground">
                    Search
                </button>
            </div>

            {loading ? (
                <p>Loading tutors...</p>
            ) : tutors.length === 0 ? (
                <p className="text-muted-foreground">No tutors found.</p>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tutors.map((tutor) => (
                        <Link key={tutor.id} to={`/tutors/${tutor.id}`} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                            <div className="font-semibold">{tutor.username || tutor.name}</div>
                            <div className="text-sm text-muted-foreground">{tutor.profession || tutor.education_qualification || 'Tutor'}</div>
                            <div className="text-xs text-muted-foreground mt-2">
                                Courses: {tutor.courses_count} | Learners: {tutor.learners_count}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
