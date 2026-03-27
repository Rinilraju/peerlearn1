import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export function AdminLoginPage() {
    const { adminLogin } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await adminLogin(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Admin login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-64px-300px)] py-12">
            <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border shadow-sm">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold">Admin Login</h1>
                    <p className="text-muted-foreground">Only accounts with admin role can login here.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="admin-email" className="text-sm font-medium">Email</label>
                        <input
                            id="admin-email"
                            type="email"
                            required
                            className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="admin@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="admin-password" className="text-sm font-medium">Password</label>
                        <input
                            id="admin-password"
                            type="password"
                            required
                            className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium disabled:opacity-60"
                    >
                        {loading ? 'Signing in...' : 'Sign In as Admin'}
                    </button>
                </form>

                <div className="text-center text-sm">
                    Normal user?{' '}
                    <Link to="/login" className="text-primary hover:underline font-medium">
                        Go to user login
                    </Link>
                </div>
            </div>
        </div>
    );
}
