import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Users, Heart, MessageSquare, Target, Download, Calendar } from 'lucide-react';

const HomePage = () => {
  const navigate = useNavigate();
  const features = [
    {
      icon: <Users className="h-8 w-8 text-blue-500" />,
      title: "Inclusive Leadership",
      description: "Transform your leadership approach with empathy-driven strategies that create belonging for everyone."
    },
    {
      icon: <MessageSquare className="h-8 w-8 text-green-500" />,
      title: "Courageous Conversations",
      description: "Navigate difficult discussions with confidence and create safe spaces for meaningful dialogue."
    },
    {
      icon: <Target className="h-8 w-8 text-orange-500" />,
      title: "Strategic DEI Planning",
      description: "Develop comprehensive diversity, equity, and inclusion strategies that drive real organizational change."
    }
  ];

  const stats = [
    { number: "500+", label: "Leaders Trained" },
    { number: "150+", label: "Organizations Served" },
    { number: "98%", label: "Client Satisfaction" },
    { number: "3x", label: "Engagement Increase" }
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-orange-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Where Teams Become <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">Trusting</span>, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500">Inclusive</span>, and <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-blue-500">Human</span>.
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                We help organizations lead with empathy, build inclusive cultures, and hold space for courageous conversations.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <button onClick={() => navigate('/contact')} className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Book a Discovery Call</span>
                </button>
                <Link to="/resources" className="bg-white text-gray-900 px-8 py-4 rounded-full font-semibold text-lg border-2 border-gray-200 hover:border-orange-500 hover:text-orange-500 transition-all duration-200 flex items-center justify-center space-x-2">
                  <Download className="h-5 w-5" />
                  <span>Download Free Resource</span>
                </Link>
              </div>
            </div>
            <div className="relative">
              <img
                src="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Diverse team collaboration"
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center space-x-2">
                  <Heart className="h-6 w-6 text-red-500" />
                  <span className="font-semibold text-gray-900">Built on Empathy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">{stat.number}</div>
                <div className="text-gray-300">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How We Transform Organizations
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our proven approach helps leaders create environments where people feel seen, heard, and valued.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200 border border-gray-100">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 mb-6">{feature.description}</p>
                <Link to="/services" className="inline-flex items-center text-orange-500 font-semibold hover:text-orange-600 transition-colors duration-200">
                  Learn more <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-gradient-to-r from-blue-50 to-green-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Trusted by Leading Organizations
            </h2>
            <p className="text-xl text-gray-600">
              Universities, sports organizations, nonprofits, government agencies, and corporations choose us.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-60">
            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
              <div className="font-bold text-gray-700">University Partners</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
              <div className="font-bold text-gray-700">Sports Organizations</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
              <div className="font-bold text-gray-700">Nonprofits</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
              <div className="font-bold text-gray-700">Corporations</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-orange-500 to-red-500 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Organization?
          </h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Join hundreds of leaders who have created more inclusive, empathetic workplaces with our proven methods.
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button onClick={() => navigate('/contact')} className="bg-white text-orange-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors duration-200">
              Schedule Your Discovery Call
            </button>
            <Link to="/resources" className="border-2 border-white text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-orange-500 transition-colors duration-200">
              Get Free Leadership Guide
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;