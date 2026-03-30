import { Star, Users, CheckCircle } from 'lucide-react';
import { Course } from '../data/mockData';
import { Link } from 'react-router-dom';

interface CourseCardProps {
    course: Course;
}

export function CourseCard({ course }: CourseCardProps) {
    const priceInr = Math.round(Number(course.price || 0) || 0);
    return (
        <Link to={`/courses/${course.id}`} className="block group">
            <div className="border rounded-lg overflow-hidden bg-card hover:shadow-lg transition-shadow">
                <div className="aspect-video relative overflow-hidden">
                    <img
                        src={course.image}
                        alt={course.title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                </div>
                <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                        <h3 className="font-semibold truncate pr-2 group-hover:text-primary transition-colors">
                            {course.title}
                        </h3>
                        <span className="font-bold text-primary">₹{priceInr}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="h-3 w-3" />
                            Verified Tutor
                        </span>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {course.description}
                    </p>

                    {(course as any).top_review_comment && (
                        <div className="text-xs text-muted-foreground line-clamp-2 border-l-2 border-primary/40 pl-2">
                            “{(course as any).top_review_comment}”
                            {(course as any).top_review_reviewer ? ` — ${(course as any).top_review_reviewer}` : ''}
                        </div>
                    )}

                    {(course as any).recommendation_reason && (
                        <div className="text-[11px] rounded-md border bg-primary/5 text-primary px-2 py-1">
                            {(course as any).recommendation_reason}
                            {(course as any).recommendation_confidence ? ` (${(course as any).recommendation_confidence}% match)` : ''}
                        </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                        <div className="flex items-center space-x-1">
                            <Users className="h-3 w-3" />
                            <span>{course.enrolled} students</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span>{course.rating} ({course.reviews})</span>
                        </div>
                    </div>

                    <div className="flex items-center text-xs text-muted-foreground pt-2 border-t mt-2">
                        <span>By {course.instructor}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
