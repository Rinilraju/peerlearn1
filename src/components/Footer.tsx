import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Github, Twitter, Linkedin } from 'lucide-react';

export function Footer() {
    return (
        <footer className="border-t bg-muted/50 py-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <GraduationCap className="h-6 w-6 text-primary" />
                            <span className="font-bold text-lg">PeerLearn</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Empowering students to connect, share knowledge, and learn together.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-4">Platform</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><a href="#" className="hover:text-primary">Browse Courses</a></li>
                            <li><a href="#" className="hover:text-primary">Find Tutors</a></li>
                            <li><a href="#" className="hover:text-primary">Become a Tutor</a></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-4">Resources</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link to="/help" className="hover:text-primary">Help Center</Link></li>
                            <li><a href="#" className="hover:text-primary">Community Guidelines</a></li>
                            <li><a href="#" className="hover:text-primary">Terms of Service</a></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-4">Connect</h3>
                        <div className="flex space-x-4 text-muted-foreground">
                            <a href="#" className="hover:text-primary"><Github className="h-5 w-5" /></a>
                            <a href="#" className="hover:text-primary"><Twitter className="h-5 w-5" /></a>
                            <a href="#" className="hover:text-primary"><Linkedin className="h-5 w-5" /></a>
                        </div>
                    </div>
                </div>
                <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
                    © {new Date().getFullYear()} PeerLearn. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
