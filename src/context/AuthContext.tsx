import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'student' | 'tutor' | 'admin';
    username?: string;
    profile_picture?: string;
    date_of_birth?: string;
    phone_number?: string;
    education_qualification?: string;
    profession?: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    adminLogin: (email: string, password: string) => Promise<void>;
    signup: (name: string, email: string, password: string) => Promise<void>;
    verify: (email: string, code: string) => Promise<void>;
    logout: () => void;
    updateUser: (userData: User) => void;
    forgotPassword: (email: string) => Promise<void>;
    resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (token && storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (error) {
                console.error('Failed to parse user data from localStorage:', error);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            }
        }
        setLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { token, user } = response.data;
            const userData: User = { ...user, role: user.role || 'student' };

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const adminLogin = async (email: string, password: string) => {
        try {
            const response = await api.post('/auth/admin-login', { email, password });
            const { token, user } = response.data;
            const userData: User = { ...user, role: user.role || 'student' };
            if (userData.role !== 'admin') {
                throw new Error('Admin access denied');
            }
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
        } catch (error) {
            console.error('Admin login error:', error);
            throw error;
        }
    };

    const signup = async (name: string, email: string, password: string) => {
        try {
            await api.post('/auth/signup', { name, email, password });
        } catch (error) {
            console.error('Signup error:', error);
            throw error;
        }
    };

    const verify = async (email: string, code: string) => {
        try {
            await api.post('/auth/verify', { email, code });
        } catch (error) {
            console.error('Verification error:', error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const updateUser = (userData: User) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    const forgotPassword = async (email: string) => {
        try {
            await api.post('/auth/forgot-password', { email });
        } catch (error) {
            console.error('Forgot password error:', error);
            throw error;
        }
    };

    const resetPassword = async (email: string, code: string, newPassword: string) => {
        try {
            await api.post('/auth/reset-password', { email, code, newPassword });
        } catch (error) {
            console.error('Reset password error:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, adminLogin, signup, verify, logout, updateUser, forgotPassword, resetPassword }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
