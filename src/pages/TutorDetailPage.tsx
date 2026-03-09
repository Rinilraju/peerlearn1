import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

type TutorData = {
    id: number;
    name: string;
    username?: string;
    profession?: string;
    education_qualification?: string;
    avg_rating: number;
    review_count: number;
    courses: Array<{ id: number; title: string; description: string; category?: string }>;
    reviews: Array<{ id: number; rating: number; comment?: string; reviewer_name?: string; reviewer_username?: string }>;
};

export function TutorDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<TutorData | null>(null);
    const [rating, setRating] = useState('5');
    const [comment, setComment] = useState('');
    const [status, setStatus] = useState('');

    const load = async () => {
        if (!id) return;
        try {
            const res = await api.get(`/tutors/${id}`);
            setData(res.data);
        } catch (error) {
            setStatus('Failed to load tutor.');
        }
    };

    useEffect(() => {
        load();
    }, [id]);

    const submitReview = async () => {
        if (!id) return;
        try {
            await api.post(`/reviews/tutors/${id}`, { rating: Number(rating), comment });
            setComment('');
            setStatus('Review submitted.');
            await load();
        } catch (error: any) {
            setStatus(error?.response?.data?.message || 'Failed to submit review.');
        }
    };

    if (!data) {
        return <div className="container mx-auto px-4 py-8">Loading tutor...</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <div className="p-4 rounded border bg-card">
                <h1 className="text-2xl font-bold">{data.username || data.name}</h1>
                <p className="text-sm text-muted-foreground">{data.profession || 'Tutor'}</p>
                <p className="text-sm text-muted-foreground">Rating: {Number(data.avg_rating || 0).toFixed(1)} ({data.review_count})</p>
            </div>

            <section className="p-4 border rounded bg-card space-y-3">
                <h2 className="text-xl font-semibold">Rate this Tutor</h2>
                <div className="flex gap-2">
                    <select value={rating} onChange={(e) => setRating(e.target.value)} className="h-10 px-3 rounded border bg-background">
                        {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v} Star</option>)}
                    </select>
                    <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment" className="flex-1 h-10 px-3 rounded border bg-background" />
                    <button onClick={submitReview} className="h-10 px-4 rounded bg-primary text-primary-foreground">Submit</button>
                </div>
                {status && <p className="text-sm">{status}</p>}
            </section>

            <section className="p-4 border rounded bg-card">
                <h2 className="text-xl font-semibold mb-3">Courses</h2>
                <div className="space-y-2">
                    {data.courses.map((course) => (
                        <div key={course.id} className="p-3 border rounded">
                            <div className="font-medium">{course.title}</div>
                            <div className="text-sm text-muted-foreground">{course.description}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="p-4 border rounded bg-card">
                <h2 className="text-xl font-semibold mb-3">Recent Reviews</h2>
                <div className="space-y-2">
                    {data.reviews.map((review) => (
                        <div key={review.id} className="p-3 border rounded">
                            <div className="text-sm font-medium">{review.reviewer_username || review.reviewer_name} - {review.rating}/5</div>
                            {review.comment && <div className="text-sm text-muted-foreground">{review.comment}</div>}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
