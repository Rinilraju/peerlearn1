import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, Video, MessageCircleQuestion } from 'lucide-react';
import { useDoubts } from '../context/DoubtContext';
import { useAuth } from '../context/AuthContext';
import { DoubtCard } from '../components/DoubtCard';
import { motion } from 'motion/react';

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 }
};

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export function LandingPage() {
    const { user } = useAuth();
    return (
        <div className="flex flex-col">
            {/* Hero Section */}
            <section className="relative py-20 lg:py-32 overflow-hidden">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"></div>
                <div className="container mx-auto px-4 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                            Connecting Minds <br className="hidden sm:block" />
                            <span className="text-primary">Sharing Knowledge</span>
                        </h1>
                        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                            PeerLearn is the platform where students teach students. Join live sessions,
                            share resources, and master new skills through peer-to-peer learning.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                            {user ? (
                                <>
                                    <Link
                                        to="/courses"
                                        className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-colors flex items-center"
                                    >
                                        Browse Courses
                                    </Link>
                                    <Link
                                        to="/create-course"
                                        className="px-8 py-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-full font-semibold transition-colors"
                                    >
                                        Create Course
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link
                                        to="/signup"
                                        className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-colors flex items-center"
                                    >
                                        Get Started
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Link>
                                    <Link
                                        to="/courses"
                                        className="px-8 py-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-full font-semibold transition-colors"
                                    >
                                        Browse Courses
                                    </Link>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-muted/30">
                <div className="container mx-auto px-4">
                    <motion.div
                        className="text-center mb-16"
                        {...fadeInUp}
                    >
                        <h2 className="text-3xl font-bold mb-4">Why PeerLearn?</h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            We connect students who want to learn with those who want to teach.
                        </p>
                    </motion.div>

                    <motion.div
                        className="grid md:grid-cols-3 gap-8"
                        variants={container}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true }}
                    >
                        <motion.div variants={item}>
                            <FeatureCard
                                icon={<Users className="h-10 w-10 text-primary" />}
                                title="Peer-to-Peer Learning"
                                description="Learn directly from peers who have mastered the subject. No formal barriers, just pure knowledge sharing."
                            />
                        </motion.div>
                        <motion.div variants={item}>
                            <FeatureCard
                                icon={<Video className="h-10 w-10 text-primary" />}
                                title="Live Interactive Sessions"
                                description="Join real-time video sessions with whiteboard, screen sharing, and interactive chat features."
                            />
                        </motion.div>
                        <motion.div variants={item}>
                            <FeatureCard
                                icon={<BookOpen className="h-10 w-10 text-primary" />}
                                title="Share Resources"
                                description="Access a vast library of study materials, notes, and resources shared by the community."
                            />
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20">
                <div className="container mx-auto px-4">
                    <motion.div className="text-center mb-12" {...fadeInUp}>
                        <h2 className="text-3xl font-bold mb-3">How It Works</h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            A simple flow designed for fast learning and smooth live sessions.
                        </p>
                    </motion.div>
                    <motion.div
                        className="grid md:grid-cols-3 gap-6"
                        variants={container}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true }}
                    >
                        {[
                            { step: '01', title: 'Discover', body: 'Browse peer-led courses that match your interests.' },
                            { step: '02', title: 'Enroll & Schedule', body: 'Join the course and book 1:1 sessions with the tutor.' },
                            { step: '03', title: 'Go Live', body: 'Meet your tutor in a live session and track your progress.' },
                        ].map((card) => (
                            <motion.div key={card.step} variants={item} className="p-6 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                                <div className="text-xs uppercase tracking-widest text-primary">{card.step}</div>
                                <div className="text-xl font-semibold mt-2">{card.title}</div>
                                <p className="text-muted-foreground mt-2">{card.body}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Recent Doubts Section */}
            <DoubtPreviewSection />
        </div>
    );
}

function DoubtPreviewSection() {
    const { questions } = useDoubts();
    const recentQuestions = questions.slice(0, 3);

    return (
        <section className="py-20">
            <div className="container mx-auto px-4">
                <motion.div
                    className="flex flex-col md:flex-row justify-between items-center mb-12"
                    {...fadeInUp}
                >
                    <div>
                        <h2 className="text-3xl font-bold mb-2">Recent Doubts</h2>
                        <p className="text-muted-foreground">See what other students are asking.</p>
                    </div>
                    <Link
                        to="/doubts"
                        className="mt-4 md:mt-0 px-6 py-2 border border-primary text-primary rounded-full font-medium hover:bg-primary/5 transition-colors flex items-center"
                    >
                        View All Doubts
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </motion.div>

                <motion.div
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                    variants={container}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true }}
                >
                    {recentQuestions.map(q => (
                        <motion.div key={q.id} variants={item}>
                            <DoubtCard question={q} compact={true} />
                        </motion.div>
                    ))}
                </motion.div>

                <motion.div
                    className="mt-12 text-center"
                    {...fadeInUp}
                >
                    <p className="text-muted-foreground mb-6">Stuck on a problem?</p>
                    <Link
                        to="/doubts"
                        className="inline-flex items-center px-8 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-colors"
                    >
                        <MessageCircleQuestion className="mr-2 h-5 w-5" />
                        Ask the Community
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4">{icon}</div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
        </div>
    );
}
