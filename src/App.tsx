import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Public Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';

// Private Pages
import { DashboardPage } from './pages/DashboardPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { CreateCoursePage } from './pages/CreateCoursePage';
import { VideoCallPage } from './pages/VideoCallPage';
import { DoubtClearingPage } from './pages/DoubtClearingPage';
import { ProfileSetupPage } from './pages/ProfileSetupPage';
import { SettingsPage } from './pages/SettingsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { SessionsPage } from './pages/SessionsPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { TutorsPage } from './pages/TutorsPage';
import { TutorDetailPage } from './pages/TutorDetailPage';
import { DoubtProvider } from './context/DoubtContext';

import { useAuth } from './context/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';

const ProfileCheck = () => {
    const { user } = useAuth();
    if (user && !user.username) {
        return <Navigate to="/profile-setup" replace />;
    }
    return <Outlet />;
};

function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="peerlearn-theme">
            <AuthProvider>
                <DoubtProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route element={<Layout />}>
                                <Route path="/" element={<LandingPage />} />
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/signup" element={<SignupPage />} />
                                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                                <Route path="/courses" element={<CoursesPage />} />
                                <Route path="/courses/:id" element={<CourseDetailPage />} />
                                <Route path="/doubts" element={<DoubtClearingPage />} />
                                <Route path="/tutors" element={<TutorsPage />} />
                                <Route path="/tutors/:id" element={<TutorDetailPage />} />

                                {/* Protected Routes */}
                                <Route element={<ProtectedRoute />}>
                                    <Route element={<ProfileCheck />}>
                                        <Route path="/dashboard" element={<DashboardPage />} />
                                        <Route path="/create-course" element={<CreateCoursePage />} />
                                        <Route path="/sessions" element={<SessionsPage />} />
                                        <Route path="/session/:id" element={<VideoCallPage />} />
                                        <Route path="/settings" element={<SettingsPage />} />
                                        <Route path="/users/:id" element={<UserProfilePage />} />
                                    </Route>
                                    <Route path="/profile-setup" element={<ProfileSetupPage />} />
                                </Route>
                            </Route>
                        </Routes>
                    </BrowserRouter>
                </DoubtProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
