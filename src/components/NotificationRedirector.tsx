import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

type NotificationPayload = {
    title?: string;
    body?: string;
    type?: string;
    action?: string;
    redirectToCreateCourse?: boolean;
    relatedRequestId?: number;
};

export function NotificationRedirector() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const locationRef = useRef(location.pathname);
    const socketRef = useRef<Socket | null>(null);
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    useEffect(() => {
        locationRef.current = location.pathname;
    }, [location.pathname]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !user || user.role !== 'tutor') return;

        const socket = io(apiBaseUrl, { auth: { token } });
        socketRef.current = socket;

        socket.on('notification', (n: NotificationPayload) => {
            const wantsRedirect = n?.action === 'redirect_create_course' || n?.redirectToCreateCourse === true;
            if (!wantsRedirect) return;
            if (locationRef.current === '/create-course') return;
            navigate('/create-course');
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [apiBaseUrl, user?.id, user?.role, navigate]);

    return null;
}
