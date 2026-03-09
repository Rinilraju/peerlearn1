import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Star, Users, CheckCircle, Share2, Heart } from 'lucide-react';
import api from '../api';

type CourseDetail = {
    id: string;
    title: string;
    description: string;
    price: number | string;
    thumbnail?: string;
    instructor_name?: string;
};

export function CourseDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewRating, setReviewRating] = useState('5');
    const [reviewComment, setReviewComment] = useState('');

    useEffect(() => {
        if (!id) {
            return;
        }

        let active = true;
        const loadCourse = async () => {
            try {
                const courseRes = await api.get(`/courses/${id}`);
                if (!active) {
                    return;
                }
                setCourse(courseRes.data);
                const reviewsRes = await api.get(`/reviews/courses/${id}`);
                if (active) {
                    setReviews(reviewsRes.data || []);
                }

                const token = localStorage.getItem('token');
                if (token) {
                    const [enrollmentRes] = await Promise.all([
                        api.get(`/courses/${id}/enrollment`),
                        api.post('/recommendations/track', { courseId: id, interactionType: 'view' }),
                    ]);
                    if (active) {
                        setIsEnrolled(Boolean(enrollmentRes.data?.enrolled));
                    }
                }
            } catch (error) {
                console.error('Failed to fetch course details:', error);
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadCourse();
        return () => {
            active = false;
        };
    }, [id]);

    useEffect(() => {
        const paymentState = searchParams.get('payment');
        const sessionId = searchParams.get('session_id');
        if (paymentState === 'cancelled') {
            setStatusMessage('Payment cancelled. You can try again.');
            return;
        }
        if (paymentState === 'success' && sessionId) {
            api.post('/payments/confirm', { sessionId })
                .then(() => {
                    setIsEnrolled(true);
                    setStatusMessage('Payment successful. You are now enrolled.');
                })
                .catch((error) => {
                    console.error('Failed to confirm payment:', error);
                    setStatusMessage('Payment succeeded but enrollment confirmation failed. Refresh to retry.');
                });
        }
    }, [searchParams]);

    const startCheckout = async () => {
        if (!id) {
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            setStatusMessage('Please login first to enroll in this course.');
            return;
        }

        setIsPaying(true);
        setStatusMessage('');
        try {
            const response = await api.post('/payments/create-checkout-session', { courseId: id });
            if (response.data?.simulated && response.data?.enrolled) {
                setIsEnrolled(true);
                setStatusMessage('Simulated payment successful. You are now enrolled.');
                return;
            }
            const checkoutUrl = response.data?.checkoutUrl;
            if (checkoutUrl) {
                window.location.href = checkoutUrl;
                return;
            }
            setStatusMessage('Failed to create checkout session.');
        } catch (error: any) {
            console.error('Checkout failed:', error);
            const backendMessage = error?.response?.data?.message;
            if (error?.response?.status === 401) {
                setStatusMessage('Session expired or not logged in. Please login and try again.');
            } else {
                setStatusMessage(backendMessage || 'Checkout failed due to server error.');
            }
        } finally {
            setIsPaying(false);
        }
    };

    const submitReview = async () => {
        if (!id) return;
        try {
            await api.post(`/reviews/courses/${id}`, {
                rating: Number(reviewRating),
                comment: reviewComment,
            });
            const res = await api.get(`/reviews/courses/${id}`);
            setReviews(res.data || []);
            setReviewComment('');
            setStatusMessage('Review submitted.');
        } catch (error: any) {
            setStatusMessage(error?.response?.data?.message || 'Failed to submit review.');
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <p>Loading course...</p>
            </div>
        );
    }

    if (!course) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold">Course not found</h1>
            </div>
        );
    }

    const price = parseFloat(String(course.price || 0)) || 0;
    const image = course.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=60';

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-4">{course.title}</h1>
                        <p className="text-lg text-muted-foreground mb-4">{course.description}</p>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="font-medium text-foreground">4.5</span>
                                <span>(new course)</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <Users className="h-4 w-4" />
                                <span>Live enrollment enabled</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <span className="font-medium text-foreground">Created by</span>
                                <span>{course.instructor_name || 'PeerLearn Instructor'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                        <img
                            src={image}
                            alt={course.title}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold">What you'll learn</h2>
                        <div className="grid sm:grid-cols-2 gap-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="flex items-start space-x-2">
                                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                                    <span className="text-sm">Master practical concepts through guided lessons and projects.</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold">Ratings & Reviews</h2>
                        <div className="flex gap-2">
                            <select value={reviewRating} onChange={(e) => setReviewRating(e.target.value)} className="h-10 px-3 rounded-md border bg-background">
                                {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v} Star</option>)}
                            </select>
                            <input value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Write a review..." className="flex-1 h-10 px-3 rounded-md border bg-background" />
                            <button onClick={submitReview} className="h-10 px-4 rounded-md bg-primary text-primary-foreground">Submit</button>
                        </div>
                        <div className="space-y-2">
                            {reviews.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No reviews yet.</p>
                            ) : reviews.map((r) => (
                                <div key={r.id} className="p-3 border rounded-md">
                                    <div className="text-sm font-medium">{r.reviewer_username || r.reviewer_name} - {r.rating}/5</div>
                                    {r.comment && <div className="text-sm text-muted-foreground">{r.comment}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-24 p-6 rounded-lg border bg-card shadow-sm space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-3xl font-bold">${price.toFixed(2)}</span>
                            <div className="flex space-x-2">
                                <button className="p-2 rounded-full hover:bg-muted transition-colors">
                                    <Share2 className="h-5 w-5 text-muted-foreground" />
                                </button>
                                <button className="p-2 rounded-full hover:bg-muted transition-colors">
                                    <Heart className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        {isEnrolled ? (
                            <Link
                                to="/dashboard"
                                className="block w-full text-center py-3 px-4 bg-primary text-primary-foreground rounded-md font-bold hover:bg-primary/90 transition-colors"
                            >
                                Go to Dashboard
                            </Link>
                        ) : (
                            <button
                                onClick={startCheckout}
                                disabled={isPaying}
                                className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
                            >
                                {isPaying ? 'Redirecting to Checkout...' : 'Enroll Now'}
                            </button>
                        )}

                        {statusMessage && (
                            <p className="text-sm text-muted-foreground">{statusMessage}</p>
                        )}

                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Duration</span>
                                <span className="font-medium">12.5 total hours</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Lectures</span>
                                <span className="font-medium">42 lectures</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Level</span>
                                <span className="font-medium">Beginner</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Language</span>
                                <span className="font-medium">English</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
