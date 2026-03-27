import React from 'react';

export function HelpSupportPage() {
    return (
        <div className="bg-background text-foreground">
            <div className="container mx-auto px-4 py-12 md:py-16">
                <div className="max-w-4xl">
                    <p className="text-sm uppercase tracking-widest text-primary/80 font-semibold mb-3">
                        Help & Support Center
                    </p>
                    <h1 className="text-3xl md:text-4xl font-bold mb-4">Help & Support Center</h1>
                    <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                        Welcome to the PeerLearn Help Center. Our goal is to ensure your peer-to-peer learning
                        experience is seamless. If you can’t find what you’re looking for below, please contact our
                        support team.
                    </p>
                    <a
                        href="#contact-support"
                        className="inline-flex mt-6 items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        Contact Support
                    </a>
                </div>

                <div className="mt-10 space-y-10">
                    <section className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
                        <h2 className="text-2xl font-semibold mb-6">1. Frequently Asked Questions (FAQs)</h2>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-2">General</h3>
                                <div className="space-y-4">
                                    <div className="rounded-xl border bg-background p-4">
                                        <p className="font-semibold">What is PeerLearn?</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            PeerLearn is a student-to-student platform for sharing knowledge through
                                            Live Interactive Sessions and shared resources.
                                        </p>
                                    </div>
                                    <div className="rounded-xl border bg-background p-4">
                                        <p className="font-semibold">Is it free?</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            PeerLearn offers both free community-led sessions and premium one-on-one
                                            tutoring.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-2">For Students</h3>
                                <div className="space-y-4">
                                    <div className="rounded-xl border bg-background p-4">
                                        <p className="font-semibold">How do I join a session?</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Navigate to Browse Courses, select a topic, and click "Join Session" at the
                                            scheduled time.
                                        </p>
                                    </div>
                                    <div className="rounded-xl border bg-background p-4">
                                        <p className="font-semibold">What if a tutor doesn't show up?</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            You can report a "No-Show" via your Dashboard within 24 hours to receive a
                                            credit or refund.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-2">For Tutors</h3>
                                <div className="space-y-4">
                                    <div className="rounded-xl border bg-background p-4">
                                        <p className="font-semibold">How do I start teaching?</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Click on Create Course to set up your first session.
                                        </p>
                                    </div>
                                    <div className="rounded-xl border bg-background p-4">
                                        <p className="font-semibold">How do I get paid?</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Earnings are processed weekly and can be tracked in your tutor Dashboard.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
                        <h2 className="text-2xl font-semibold mb-4">2. Technical Troubleshooting</h2>
                        <div className="space-y-4">
                            <div className="rounded-xl border bg-background p-4">
                                <p className="font-semibold">Audio/Video Issues</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Ensure you have granted microphone and camera permissions to your browser. We
                                    recommend using the latest version of Chrome or Firefox.
                                </p>
                            </div>
                            <div className="rounded-xl border bg-background p-4">
                                <p className="font-semibold">Whiteboard Lag</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Check your internet connection speed. A minimum of 5 Mbps is recommended for Live
                                    Sessions.
                                </p>
                            </div>
                            <div className="rounded-xl border bg-background p-4">
                                <p className="font-semibold">Account Access</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    If you’ve forgotten your password, use the "Forgot Password" link on the Sign-in
                                    page.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
                        <h2 className="text-2xl font-semibold mb-4">3. Safety & Reporting</h2>
                        <p className="text-muted-foreground mb-4">
                            Your safety is our priority. Please use our reporting tools if you encounter:
                        </p>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-xl border bg-background p-4">
                                <p className="font-semibold">Harassment</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Any behavior violating our Community Guidelines.
                                </p>
                            </div>
                            <div className="rounded-xl border bg-background p-4">
                                <p className="font-semibold">Academic Dishonesty</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Requests to complete graded exams or plagiarism.
                                </p>
                            </div>
                            <div className="rounded-xl border bg-background p-4">
                                <p className="font-semibold">Spam</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Unsolicited commercial links or bot activity.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section id="contact-support" className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
                        <h2 className="text-2xl font-semibold mb-4">Contact Support</h2>
                        <p className="text-muted-foreground mb-6">
                            Reach out to any of the developers below on Instagram.
                        </p>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-xl border bg-background p-4">
                                <p className="font-semibold">Nikunj Renjith Rajan</p>
                                <p className="text-sm text-muted-foreground mt-1">@_nknj._</p>
                            </div>
                            <div className="rounded-xl border bg-background p-4">
                                <p className="font-semibold">Reev John Roy</p>
                                <p className="text-sm text-muted-foreground mt-1">@reev_john_roy</p>
                            </div>
                            <div className="rounded-xl border bg-background p-4">
                                <p className="font-semibold">Rinil Raju</p>
                                <p className="text-sm text-muted-foreground mt-1">@ri_nil_</p>
                            </div>
                            <div className="rounded-xl border bg-background p-4">
                                <p className="font-semibold">Rohan Rony</p>
                                <p className="text-sm text-muted-foreground mt-1">@rohan_.rony</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
