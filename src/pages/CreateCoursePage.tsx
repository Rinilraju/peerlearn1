import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export function CreateCoursePage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        price: '',
        category: 'Development',
        video_url: '',
        thumbnail: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await api.post('/courses', {
                ...formData,
                price: parseFloat(formData.price) || 0
            });
            navigate('/courses');
        } catch (error: any) {
            console.error('Error creating course:', error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                alert('Your login session expired or is invalid. Please login again, then retry creating the course.');
                navigate('/login');
                return;
            }
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to create course. Please try again.';
            alert(`Failed to create course: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Create New Course</h1>
                <p className="text-muted-foreground">Share your knowledge with the world.</p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Course Title</label>
                    <input
                        type="text"
                        name="title"
                        required
                        value={formData.title}
                        onChange={handleChange}
                        className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="e.g. Advanced React Patterns"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                        name="description"
                        required
                        value={formData.description}
                        onChange={handleChange}
                        className="w-full min-h-[120px] px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="What will students learn in this course?"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Price ($)</label>
                        <input
                            type="number"
                            name="price"
                            min="0"
                            step="0.01"
                            value={formData.price}
                            onChange={handleChange}
                            className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="0.00"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <select
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="Development">Development</option>
                            <option value="Design">Design</option>
                            <option value="Business">Business</option>
                            <option value="Marketing">Marketing</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Video URL (Optional)</label>
                    <input
                        type="url"
                        name="video_url"
                        value={formData.video_url}
                        onChange={handleChange}
                        className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="https://youtube.com/..."
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Course Thumbnail URL (Optional)</label>
                    <input
                        type="url"
                        name="thumbnail"
                        value={formData.thumbnail}
                        onChange={handleChange}
                        className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="https://example.com/image.jpg"
                    />
                    {/* <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Drag and drop or click to upload</p>
                    </div> */}
                </div>

                <div className="pt-4 flex justify-end space-x-4">
                    <button
                        type="button"
                        onClick={() => navigate('/courses')}
                        className="px-4 py-2 rounded-md hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Publishing...' : 'Publish Course'}
                    </button>
                </div>
            </form>
        </div>
    );
}
