import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Users, BookOpen, BarChart3, Download, Video, Calendar, MessageSquare, Settings, ArrowRight } from 'lucide-react';

const ClientPortalPage = () => {
  const features = [
    {
      icon: <Video className="h-8 w-8 text-blue-500" />,
      title: "Video Learning Modules",
      description: "Access custom training videos designed specifically for your organization's needs and goals."
    },
    {
      icon: <Download className="h-8 w-8 text-green-500" />,
      title: "Resource Library",
      description: "Download worksheets, templates, assessment tools, and implementation guides."
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-orange-500" />,
      title: "Progress Tracking",
      description: "Monitor your team's learning progress and measure the impact of your DEI initiatives."
    },
    {
      icon: <MessageSquare className="h-8 w-8 text-purple-500" />,
      title: "Discussion Forums",
      description: "Connect with other leaders, share insights, and ask questions in a supportive community."
    },
    {
      icon: <Calendar className="h-8 w-8 text-red-500" />,
      title: "Session Scheduling",
      description: "Book follow-up coaching sessions and access upcoming workshop schedules."
    },
    {
      icon: <Settings className="h-8 w-8 text-gray-500" />,
      title: "Custom Content",
      description: "Access materials tailored to your organization's specific industry and challenges."
    }
  ];

  const upcomingFeatures = [
    {
      title: "Mobile Learning App",
      description: "Learn on-the-go with our mobile-responsive platform",
      eta: "Q2 2025"
    },
    {
      title: "AI-Powered Assessments", 
      description: "Personalized learning paths based on your role and goals",
      eta: "Q3 2025"
    },
    {
      title: "Team Collaboration Tools",
      description: "Work together on DEI initiatives with shared workspaces",
      eta: "Q4 2025"
    },
    {
      title: "Certification Programs",
      description: "Earn credentials in inclusive leadership practices",
      eta: "2026"
    }
  ];

  const benefits = [
    "24/7 access to your personalized learning materials",
    "Secure, private environment for sensitive discussions",
    "Integration with your calendar and workflow tools",
    "Regular content updates based on latest research",
    "Direct connection to your Huddle Co. facilitator",
    "Peer networking with other organizational leaders"
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-purple-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center space-x-2 mb-6">
                <div className="bg-gradient-to-r from-blue-400 to-purple-500 p-3 rounded-lg">
                  <Lock className="h-8 w-8 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">Client Portal</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Your Client Portal is Now Available
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Access your personalized learning dashboard, complete assigned surveys, track course progress,
                and download resources shared specifically for your organization.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link 
                  to="/client/dashboard"
                  className="bg-gradient-to-r from-blue-400 to-purple-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-blue-500 hover:to-purple-600 transition-all duration-200 transform hover:scale-105"
                >
                  Access Portal Dashboard
                </Link>
                <button className="border-2 border-blue-500 text-blue-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-blue-500 hover:text-white transition-all duration-200">
                  Learn More
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Users className="h-6 w-6 text-blue-500" />
                    <span className="font-semibold">Team Dashboard</span>
                  </div>
                  <div className="bg-gray-100 h-4 rounded-full">
                    <div className="bg-gradient-to-r from-blue-400 to-purple-500 h-4 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Training Progress</span>
                    <span>75% Complete</span>
                  </div>
                  <div className="space-y-2 mt-6">
                    <div className="flex items-center space-x-2 p-2 bg-green-50 rounded">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Inclusive Leadership Module</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-yellow-50 rounded">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm">Courageous Conversations</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      <span className="text-sm">Strategic Planning Tools</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-orange-100 p-3 rounded-full">
                <BookOpen className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              What You'll Have Access To
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              A comprehensive learning environment designed to support your organization's ongoing DEI transformation.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Why a Client Portal?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Research shows that sustained learning and ongoing support are critical for lasting organizational change. 
                Our client portal extends your transformation journey beyond our workshops, providing the tools and 
                community you need for long-term success.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <img
                src="https://images.pexels.com/photos/3184317/pexels-photo-3184317.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Team collaboration"
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-lg">
                <div className="text-2xl font-bold text-blue-500">24/7</div>
                <div className="text-gray-600">Access</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Development Roadmap
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We're continuously improving and expanding the client portal experience. Here's what's coming:
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {upcomingFeatures.map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="text-sm text-blue-500 font-medium mb-2">{feature.eta}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Current Client Access */}
      <section className="bg-gradient-to-r from-blue-500 to-purple-500 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Current Clients
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            If you're an existing client looking for your training materials or session recordings, 
            we'll send them to you directly via secure email until the portal launches.
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button className="bg-white text-blue-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors duration-200">
              Request Materials
            </button>
            <button className="border-2 border-white text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-blue-500 transition-colors duration-200">
              Schedule Follow-up
            </button>
          </div>
        </div>
      </section>

      {/* Early Access */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Get Early Access
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Be among the first to experience our client portal when it launches. 
            Early access members get exclusive features and priority support.
          </p>
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-6">
              <div className="text-left">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Join the Waitlist</h3>
                <p className="text-gray-600">Get notified when the client portal launches and receive exclusive early access.</p>
              </div>
              <div className="flex space-x-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button className="bg-gradient-to-r from-blue-400 to-purple-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-500 hover:to-purple-600 transition-all duration-200 flex items-center space-x-2">
                  <span>Join</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ClientPortalPage;