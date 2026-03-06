import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CourseCard } from '../components/CourseCard';
import { SessionCard } from '../components/SessionCard';
import { SESSIONS } from '../data/mockData';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';

export function DashboardPage() {
    const { user } = useAuth();
    const upcomingSessions = SESSIONS; // Mock upcoming sessions
    const [myCourses, setMyCourses] = useState<any[]>([]);
    const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
    const [recommendedCourses, setRecommendedCourses] = useState<any[]>([]);

    const mapCourse = (course: any) => ({
        ...course,
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

                setMyCourses(mineRes.data.map(mapCourse));
                setEnrolledCourses(enrolledRes.data.map(mapCourse));
                setRecommendedCourses(recRes.data.map(mapCourse));
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchDashboardCourses();
    }, [user]);

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Welcome back, {user?.name}! Here's what's happening today.
                    </p>
                </div>
                <Link
                    to="/create-course"
                    className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Course
                </Link>
            </div>

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
                        <h2 className="text-xl font-bold mb-4">Upcoming Live Sessions</h2>
                        <div className="space-y-4">
                            {upcomingSessions.map(session => (
                                <SessionCard key={session.id} session={session} />
                            ))}
                        </div>
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
