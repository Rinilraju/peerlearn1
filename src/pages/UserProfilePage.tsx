import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

type UserProfile = {
    id: number;
    name: string;
    email: string;
    username?: string;
    role: string;
    profile_picture?: string;
    profession?: string;
    education_qualification?: string;
};

export function UserProfilePage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [topic, setTopic] = useState('');
    const [message, setMessage] = useState('');
    const [preferredTime, setPreferredTime] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        api.get(`/users/${id}`)
            .then((res) => setProfile(res.data))
            .catch((error) => {
                setStatus(error?.response?.data?.message || 'Failed to load profile.');
            })
            .finally(() => setLoading(false));
    }, [id]);

    const sendClassRequest = async () => {
        if (!profile) return;
        if (!topic.trim()) {
            setStatus('Please enter a topic for the class request.');
            return;
        }
        try {
            await api.post('/class-requests', {
                tutorId: profile.id,
                topic: topic.trim(),
                message: message.trim(),
                preferredTime: preferredTime || null,
            });
            setStatus('Class request sent successfully.');
            setTopic('');
            setMessage('');
            setPreferredTime('');
        } catch (error: any) {
            setStatus(error?.response?.data?.message || 'Failed to send class request.');
        }
    };

    if (loading) {
        return <div className="container mx-auto px-4 py-8">Loading profile...</div>;
    }

    if (!profile) {
        return <div className="container mx-auto px-4 py-8">Profile not found.</div>;
    }

    const isSelf = Number(profile.id) === Number(user?.id);
    const canRequest = !isSelf;

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
            <div className="rounded-lg border p-6 bg-card">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                        {profile.profile_picture ? (
                            <img src={profile.profile_picture} alt={profile.username || profile.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xl font-bold">{(profile.username || profile.name || 'U').charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{profile.username || profile.name}</h1>
                        <p className="text-sm text-muted-foreground">{profile.email}</p>
                        <p className="text-sm text-muted-foreground capitalize">Role: {profile.role}</p>
                    </div>
                </div>
                {(profile.profession || profile.education_qualification) && (
                    <div className="mt-4 text-sm text-muted-foreground">
                        {profile.profession && <p>Profession: {profile.profession}</p>}
                        {profile.education_qualification && <p>Education: {profile.education_qualification}</p>}
                    </div>
                )}
            </div>

            {canRequest && (
                <div className="rounded-lg border p-6 bg-card space-y-3">
                    <h2 className="text-xl font-semibold">Request a Class</h2>
                    <input
                        type="text"
                        placeholder="Topic (e.g. DBMS Transactions)"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border bg-background"
                    />
                    <input
                        type="datetime-local"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border bg-background"
                    />
                    <textarea
                        placeholder="Message (optional)"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full min-h-[100px] px-3 py-2 rounded-md border bg-background"
                    />
                    <button
                        onClick={sendClassRequest}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                        Send Class Request
                    </button>
                </div>
            )}

            {status && <div className="text-sm rounded-md border p-3">{status}</div>}
        </div>
    );
}
