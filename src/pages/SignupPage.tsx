import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export function SignupPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            await signup(name, email, password);
            setMessage('Account created successfully. Redirecting to login...');
            setTimeout(() => navigate('/login'), 800);
        } catch (err: any) {
            // Check if it's an axios error with response data
            const errorMessage = err.response?.data?.message || 'Signup failed. Please try again.';
            setError(errorMessage);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-64px-300px)] py-12">
            <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border shadow-sm">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold">Create an account</h1>
                    <p className="text-muted-foreground">Join PeerLearn to start teaching and learning</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded text-sm text-center">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-2 rounded text-sm text-center">
                        {message}
                    </div>
                )}

                <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium">Full Name</label>
                        <input
                            id="name"
                            type="text"
                            required
                            className="w-full h-10 px-3 rounded-md border bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">Email</label>
                        <input
                            id="email"
                            type="email"
                            required
                            className="w-full h-10 px-3 rounded-md border bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium">Password</label>
                        <input
                            id="password"
                            type="password"
                            required
                            className="w-full h-10 px-3 rounded-md border bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        Sign Up
                    </button>
                </form>

                <div className="text-center text-sm">
                    Already have an account?{' '}
                    <Link to="/login" className="text-primary hover:underline font-medium">
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
