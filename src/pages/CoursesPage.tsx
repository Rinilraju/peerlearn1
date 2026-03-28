import { useState, useEffect, useRef } from 'react';
import { CourseCard } from '../components/CourseCard';
import { Search } from 'lucide-react';
import api from '../api';

interface Course {
    id: string;
    title: string;
    description: string;
    thumbnail?: string;
    video_url?: string;
    price?: number;
    rating?: number;
    reviews?: number;
    enrolled?: number;
    instructor?: string;
    top_review_comment?: string;
    top_review_reviewer?: string;
    // Map backend fields to frontend expected fields
    image?: string;
    avg_rating?: number;
    review_count?: number;
    enroll_count?: number;
}

export function CoursesPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'rating' | 'price'>('rating');
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const lastTrackedSearchRef = useRef('');

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const response = await api.get('/courses');
                // Transform data to match UI needs
                const mappedCourses = response.data.map((c: any) => ({
                    ...c,
                    title: (String(c.title || '').trim() || 'Untitled Course'),
                    description: (String(c.description || '').trim() || 'Description will be updated soon.'),
                    image: c.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60',
                    price: parseFloat(c.price) || 0,
                    category: c.category || 'General',
                    rating: Number(c.avg_rating || 0),
                    reviews: Number(c.review_count || 0),
                    enrolled: Number(c.enroll_count || 0),
                    instructor: c.instructor_name || 'PeerLearn Instructor'
                }));
                setCourses(mappedCourses);
            } catch (error) {
                console.error('Error fetching courses:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCourses();
    }, []);

    useEffect(() => {
        const query = searchTerm.trim();
        if (query.length < 2) {
            return;
        }

        const timeoutId = window.setTimeout(async () => {
            const normalized = query.toLowerCase();
            if (lastTrackedSearchRef.current === normalized) {
                return;
            }
            try {
                await api.post('/recommendations/track-search', { queryText: query });
                lastTrackedSearchRef.current = normalized;
            } catch (error) {
                // Keep search UX unaffected when analytics tracking fails.
                console.error('Failed to track search term:', error);
            }
        }, 700);

        return () => window.clearTimeout(timeoutId);
    }, [searchTerm]);

    const filteredCourses = courses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.instructor && course.instructor.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => {
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'price') return (a.price || 0) - (b.price || 0);
        return 0;
    });

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8 space-y-4">
                <h1 className="text-3xl font-bold">Explore Courses</h1>
                <p className="text-muted-foreground">Find the perfect course to upgrade your skills.</p>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search courses, topics, or instructors..."
                            className="w-full h-10 pl-10 pr-4 rounded-md border bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'rating' | 'price')}
                    >
                        <option value="rating">Sort by Rating</option>
                        <option value="price">Sort by Price</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading courses...</div>
            ) : filteredCourses.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCourses.map(course => (
                        <CourseCard key={course.id} course={course as any} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No courses found matching your search.</p>
                </div>
            )}
        </div>
    );
}
