import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { NotificationRedirector } from './NotificationRedirector';

export function Layout() {
    return (
        <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
            <NotificationRedirector />
            <Navbar />
            <main className="flex-1">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
