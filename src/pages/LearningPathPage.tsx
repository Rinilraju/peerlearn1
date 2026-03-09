import { useEffect, useState } from 'react';
import api from '../api';

type Path = {
    category: string;
    recommended_next: string;
    steps: Array<{ title: string; status: 'completed' | 'current' | 'upcoming' }>;
};

export function LearningPathPage() {
    const [paths, setPaths] = useState<Path[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/learning-path/my')
            .then((res) => setPaths(res.data || []))
            .catch((error) => {
                console.error('Failed to load learning path:', error);
                setPaths([]);
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <h1 className="text-3xl font-bold">Learning Path</h1>
            {loading ? <p>Loading...</p> : paths.length === 0 ? (
                <p className="text-muted-foreground">Enroll in courses to generate your personalized path.</p>
            ) : (
                <div className="space-y-4">
                    {paths.map((path) => (
                        <div key={path.category} className="p-4 rounded border bg-card">
                            <h2 className="font-semibold capitalize">{path.category}</h2>
                            <p className="text-sm text-muted-foreground mb-2">Recommended next: {path.recommended_next}</p>
                            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {path.steps.map((step) => (
                                    <div key={step.title} className="p-2 rounded border text-sm">
                                        <span className="font-medium">{step.title}</span>
                                        <span className="ml-2 text-xs text-muted-foreground capitalize">({step.status})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
