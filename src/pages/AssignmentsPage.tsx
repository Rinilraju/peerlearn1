import { useEffect, useMemo, useState } from 'react';
import api from '../api';

type Course = { id: number; title: string };

export function AssignmentsPage() {
    const [myCourses, setMyCourses] = useState<Course[]>([]);
    const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [status, setStatus] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [submissionText, setSubmissionText] = useState<Record<number, string>>({});

    const isTutor = myCourses.length > 0;
    const availableCourses = useMemo(() => (isTutor ? myCourses : enrolledCourses), [isTutor, myCourses, enrolledCourses]);

    useEffect(() => {
        const loadCourses = async () => {
            try {
                const [mine, enrolled] = await Promise.all([
                    api.get('/courses/my-courses'),
                    api.get('/courses/enrolled'),
                ]);
                setMyCourses((mine.data || []).map((c: any) => ({ id: Number(c.id), title: c.title })));
                setEnrolledCourses((enrolled.data || []).map((c: any) => ({ id: Number(c.id), title: c.title })));
            } catch (error) {
                setStatus('Failed to load courses.');
            }
        };
        loadCourses();
    }, []);

    useEffect(() => {
        if (!selectedCourseId) {
            setAssignments([]);
            return;
        }
        api.get(`/assignments/course/${selectedCourseId}`)
            .then((res) => setAssignments(res.data || []))
            .catch((error: any) => setStatus(error?.response?.data?.message || 'Failed to load assignments.'));
    }, [selectedCourseId]);

    const createAssignment = async () => {
        if (!selectedCourseId || !newTitle.trim()) return;
        try {
            await api.post(`/assignments/course/${selectedCourseId}`, { title: newTitle, description: newDesc, assignmentType: 'homework' });
            setNewTitle('');
            setNewDesc('');
            setStatus('Assignment created.');
            const res = await api.get(`/assignments/course/${selectedCourseId}`);
            setAssignments(res.data || []);
        } catch (error: any) {
            setStatus(error?.response?.data?.message || 'Failed to create assignment.');
        }
    };

    const submitAssignment = async (assignmentId: number) => {
        try {
            await api.post(`/assignments/${assignmentId}/submit`, { content: submissionText[assignmentId] || '' });
            setStatus('Assignment submitted.');
            const res = await api.get(`/assignments/course/${selectedCourseId}`);
            setAssignments(res.data || []);
        } catch (error: any) {
            setStatus(error?.response?.data?.message || 'Failed to submit assignment.');
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <h1 className="text-3xl font-bold">Assignments</h1>
            {status && <div className="text-sm border rounded p-3">{status}</div>}

            <div className="max-w-md">
                <select className="h-10 px-3 rounded border bg-background w-full" value={selectedCourseId ?? ''} onChange={(e) => setSelectedCourseId(Number(e.target.value) || null)}>
                    <option value="">Select course</option>
                    {availableCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
            </div>

            {isTutor && selectedCourseId && (
                <section className="p-4 border rounded bg-card space-y-2">
                    <h2 className="font-semibold">Create Assignment</h2>
                    <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" className="h-10 px-3 rounded border bg-background w-full" />
                    <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description" className="min-h-[90px] px-3 py-2 rounded border bg-background w-full" />
                    <button onClick={createAssignment} className="px-4 py-2 rounded bg-primary text-primary-foreground">Create</button>
                </section>
            )}

            <section className="space-y-3">
                {assignments.map((a) => (
                    <div key={a.id} className="p-4 border rounded bg-card space-y-2">
                        <div className="font-medium">{a.title}</div>
                        <div className="text-sm text-muted-foreground">{a.description}</div>
                        {!isTutor && (
                            <div className="space-y-2">
                                <textarea
                                    value={submissionText[a.id] || ''}
                                    onChange={(e) => setSubmissionText((prev) => ({ ...prev, [a.id]: e.target.value }))}
                                    placeholder="Your submission"
                                    className="min-h-[80px] px-3 py-2 rounded border bg-background w-full"
                                />
                                <button onClick={() => submitAssignment(a.id)} className="px-4 py-2 rounded bg-primary text-primary-foreground">
                                    Submit
                                </button>
                            </div>
                        )}
                        {a.submission_status && <div className="text-xs text-muted-foreground">Submission: {a.submission_status}</div>}
                    </div>
                ))}
            </section>
        </div>
    );
}
