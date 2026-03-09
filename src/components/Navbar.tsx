import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProfileDropdown } from './ProfileDropdown';
import { GraduationCap, LogOut, User, Menu, X } from 'lucide-react';

export function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link to="/" className="flex items-center space-x-2">
                    <GraduationCap className="h-8 w-8 text-primary" />
                    <span className="font-bold text-xl hidden sm:inline-block">PeerLearn</span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center space-x-6">
                    <Link to="/courses" className="text-sm font-medium hover:text-primary transition-colors">
                        Browse Courses
                    </Link>
                    {user ? (
                        <>
                            <Link to="/create-course" className="text-sm font-medium hover:text-primary transition-colors">
                                Create Course
                            </Link>
                            <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                                Dashboard
                            </Link>
                            <div className="ml-4">
                                <ProfileDropdown />
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center space-x-4 ml-4">
                            <Link to="/login" className="text-sm font-medium hover:text-primary transition-colors">
                                Log in
                            </Link>
                            <Link
                                to="/signup"
                                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                            >
                                Sign up
                            </Link>
                        </div>
                    )}
                </div>

                {/* Mobile Menu Toggle */}
                <div className="flex items-center space-x-4 md:hidden">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 -mr-2"
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Nav */}
            {
                isMenuOpen && (
                    <div className="md:hidden border-t p-4 space-y-4 bg-background">
                        <Link
                            to="/courses"
                            className="block text-sm font-medium hover:text-primary transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            Browse Courses
                        </Link>
                        {user ? (
                            <>
                                <Link
                                    to="/create-course"
                                    className="block text-sm font-medium hover:text-primary transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Create Course
                                </Link>
                                <Link
                                    to="/dashboard"
                                    className="block text-sm font-medium hover:text-primary transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Dashboard
                                </Link>
                                <div className="pt-4 border-t space-y-4">
                                    <div className="flex items-center space-x-2">
                                        <User className="h-5 w-5" />
                                        <span className="text-sm font-medium">{user.name}</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setIsMenuOpen(false);
                                        }}
                                        className="flex items-center space-x-1 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors w-full"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="pt-4 border-t space-y-4">
                                <Link
                                    to="/login"
                                    className="block text-sm font-medium hover:text-primary transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Log in
                                </Link>
                                <Link
                                    to="/signup"
                                    className="block w-full text-center bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Sign up
                                </Link>
                            </div>
                        )}
                    </div>
                )
            }
        </nav >
    );
}
