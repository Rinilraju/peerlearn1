import { Users, IndianRupee, Target, Calendar } from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Peer-to-Peer Learning',
    description: 'Learn directly from experienced peers who understand your journey and challenges.',
  },
  {
    icon: IndianRupee,
    title: 'Affordable Education',
    description: 'Access quality education at a fraction of traditional tutoring costs.',
  },
  {
    icon: Target,
    title: 'Skill-Based Sessions',
    description: 'Focus on specific skills and topics that matter most to your goals.',
  },
  {
    icon: Calendar,
    title: 'Flexible Scheduling',
    description: 'Find classes that fit your schedule with sessions available 24/7.',
  },
];

export function WhyPeerLearn() {
  return (
    <section className="w-full bg-gradient-to-b from-gray-50 to-white py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold text-gray-900 mb-3">
            Why PeerLearn?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Discover a new way to learn and grow with our community-driven platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group text-center p-6 rounded-xl bg-white border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
