import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

type QuizQuestion = {
    id: number;
    question: string;
    options: string[];
};

export function CreateCoursePage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [quizLoading, setQuizLoading] = useState(false);
    const [quizActive, setQuizActive] = useState(false);
    const [attemptId, setAttemptId] = useState('');
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [answers, setAnswers] = useState<number[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [quizStatus, setQuizStatus] = useState('');
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [copyCount, setCopyCount] = useState(0);
    const [thumbnailUploading, setThumbnailUploading] = useState(false);
    const [thumbnailError, setThumbnailError] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        price: '',
        category: 'Development',
        video_url: '',
        thumbnail: '',
        total_sessions: '1'
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleThumbnailUpload = async (file: File | null) => {
        if (!file) return;
        setThumbnailUploading(true);
        setThumbnailError('');
        try {
            const form = new FormData();
            form.append('thumbnail', file);
            const res = await api.post('/courses/upload-thumbnail', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const uploadedUrl = res.data?.url;
            if (uploadedUrl) {
                setFormData((prev) => ({ ...prev, thumbnail: uploadedUrl }));
            } else {
                setThumbnailError('Upload failed. No URL returned.');
            }
        } catch (error: any) {
            setThumbnailError(error.response?.data?.message || 'Failed to upload thumbnail.');
        } finally {
            setThumbnailUploading(false);
        }
    };

    React.useEffect(() => {
        if (!quizActive || timeLeft <= 0) {
            return;
        }
        const timer = window.setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);
        return () => window.clearInterval(timer);
    }, [quizActive, timeLeft]);

    React.useEffect(() => {
        if (!quizActive) {
            return;
        }
        if (timeLeft <= 0) {
            submitQuiz(true);
        }
    }, [timeLeft, quizActive]);

    React.useEffect(() => {
        if (!quizActive) {
            return;
        }

        const onVisibilityChange = () => {
            if (document.hidden) {
                setTabSwitchCount((prev) => prev + 1);
                setQuizStatus('Tab switch detected. Submitting attempt...');
                submitQuiz(true, true);
            }
        };
        const onCopyCutPaste = (event: ClipboardEvent) => {
            event.preventDefault();
            setCopyCount((prev) => prev + 1);
            setQuizStatus('Copy/paste is blocked during verification quiz.');
        };
        const onContextMenu = (event: MouseEvent) => {
            event.preventDefault();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'v', 'a'].includes(key)) {
                event.preventDefault();
                setCopyCount((prev) => prev + 1);
                setQuizStatus('Copy/paste/select-all shortcuts are blocked during quiz.');
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        document.addEventListener('copy', onCopyCutPaste);
        document.addEventListener('cut', onCopyCutPaste);
        document.addEventListener('paste', onCopyCutPaste);
        document.addEventListener('contextmenu', onContextMenu);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            document.removeEventListener('copy', onCopyCutPaste);
            document.removeEventListener('cut', onCopyCutPaste);
            document.removeEventListener('paste', onCopyCutPaste);
            document.removeEventListener('contextmenu', onContextMenu);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [quizActive, attemptId, answers, tabSwitchCount, copyCount]);

    const startQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        setQuizLoading(true);
        setQuizStatus('');
        try {
            const res = await api.post('/courses/verification-quiz/generate', {
                title: formData.title,
                description: formData.description,
                category: formData.category,
            });
            const generatedQuestions: QuizQuestion[] = res.data.questions || [];
            setAttemptId(res.data.attemptId);
            setQuestions(generatedQuestions);
            setAnswers(new Array(generatedQuestions.length).fill(-1));
            setCurrentQuestion(0);
            setTimeLeft(Number(res.data.durationSeconds || 600));
            setTabSwitchCount(0);
            setCopyCount(0);
            setQuizActive(true);
        } catch (error: any) {
            console.error('Error starting quiz:', error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                alert('Your login session expired or is invalid. Please login again, then retry.');
                navigate('/login');
                return;
            }
            const errorMessage = error.response?.data?.message || error.message || 'Failed to start verification quiz.';
            alert(errorMessage);
        } finally {
            setQuizLoading(false);
        }
    };

    const submitQuiz = async (silent = false, ruleViolation = false) => {
        if (!attemptId) {
            return;
        }
        setLoading(true);
        try {
            const finalTabSwitchCount = tabSwitchCount + (ruleViolation ? 1 : 0);
            const res = await api.post('/courses/verification-quiz/submit', {
                attemptId,
                answers,
                violations: {
                    tabSwitchCount: finalTabSwitchCount,
                    copyCount,
                },
            });

            if (!res.data?.passed) {
                setQuizStatus(res.data?.message || 'Quiz not passed. Please retry.');
                setQuizActive(false);
                return;
            }

            await api.post('/courses', {
                ...formData,
                price: parseFloat(formData.price) || 0,
                total_sessions: Number(formData.total_sessions || 1),
            }, {
                headers: {
                    'X-Course-Verification-Token': res.data.verificationToken,
                },
            });
            navigate('/courses');
        } catch (error: any) {
            if (!silent) {
                const errorMessage = error.response?.data?.message || 'Failed to submit verification quiz.';
                setQuizStatus(errorMessage);
            }
            setQuizActive(false);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = Math.max(seconds % 60, 0).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    if (quizActive) {
        const current = questions[currentQuestion];
        return (
            <div className="container mx-auto px-4 py-8 max-w-3xl">
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Tutor Verification Quiz</h1>
                    <div className="text-lg font-semibold text-red-500">Time Left: {formatTime(timeLeft)}</div>
                </div>
                <div className="mb-4 rounded-md border p-3 text-sm bg-yellow-50 text-yellow-800">
                    Rules: 10 MCQs, no tab switching, no copy/paste. Passing score: 7/10.
                </div>
                {quizStatus && <div className="mb-4 rounded-md border p-3 text-sm">{quizStatus}</div>}

                {current && (
                    <div className="rounded-lg border p-5 space-y-4">
                        <div className="text-sm text-muted-foreground">
                            Question {currentQuestion + 1} of {questions.length}
                        </div>
                        <h2 className="text-lg font-semibold">{current.question}</h2>
                        <div className="space-y-2">
                            {current.options.map((option, index) => (
                                <label key={index} className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/30">
                                    <input
                                        type="radio"
                                        checked={answers[currentQuestion] === index}
                                        onChange={() => {
                                            const nextAnswers = [...answers];
                                            nextAnswers[currentQuestion] = index;
                                            setAnswers(nextAnswers);
                                        }}
                                    />
                                    <span>{option}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-between pt-2">
                            <button
                                type="button"
                                disabled={currentQuestion === 0}
                                onClick={() => setCurrentQuestion((prev) => prev - 1)}
                                className="px-4 py-2 rounded-md border disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <div className="flex gap-2">
                                {currentQuestion < questions.length - 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => setCurrentQuestion((prev) => prev + 1)}
                                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
                                    >
                                        Next
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => submitQuiz(false)}
                                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                                    >
                                        {loading ? 'Submitting...' : 'Submit Quiz'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Create New Course</h1>
                <p className="text-muted-foreground">Share your knowledge with the world. Verification quiz is required before publishing.</p>
            </div>

            <form className="space-y-6" onSubmit={startQuiz}>
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
                    <label className="text-sm font-medium">Total Sessions Included</label>
                    <input
                        type="number"
                        name="total_sessions"
                        min="1"
                        max="200"
                        step="1"
                        required
                        value={formData.total_sessions}
                        onChange={handleChange}
                        className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="e.g. 8"
                    />
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
                    <div className="text-xs text-muted-foreground">Or upload an image file:</div>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleThumbnailUpload(e.target.files?.[0] || null)}
                        className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {thumbnailUploading && <div className="text-xs text-muted-foreground">Uploading thumbnail...</div>}
                    {thumbnailError && <div className="text-xs text-red-500">{thumbnailError}</div>}
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
                        disabled={quizLoading}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {quizLoading ? 'Starting Quiz...' : 'Create Course (Start Verification Quiz)'}
                    </button>
                </div>
            </form>
        </div>
    );
}
