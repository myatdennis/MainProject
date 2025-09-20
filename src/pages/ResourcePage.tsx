import React, { useState } from 'react';
import { Download, CheckCircle, Mail, FileText, Video, Users, Calendar, ArrowRight } from 'lucide-react';

const ResourcePage = () => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [organization, setOrganization] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would integrate with your email service (Mailchimp, ConvertKit, etc.)
    setIsSubmitted(true);
  };

  const additionalResources = [
    {
      icon: <FileText className="h-8 w-8 text-blue-500" />,
      title: "DEI Assessment Checklist",
      description: "Evaluate your organization's current state of diversity, equity, and inclusion with our comprehensive 50-point checklist.",
      type: "PDF Download",
      action: "Download Free"
    },
    {
      icon: <Video className="h-8 w-8 text-green-500" />,
      title: "Courageous Conversations Masterclass",
      description: "45-minute recorded session on navigating difficult discussions with empathy and skill.",
      type: "Video Training",
      action: "Watch Now"
    },
    {
      icon: <Users className="h-8 w-8 text-orange-500" />,
      title: "Monthly DEI Leaders Circle",
      description: "Join our virtual community of practice for DEI leaders. Share challenges, celebrate wins, and learn together.",
      type: "Community",
      action: "Join Circle"
    }
  ];

  const benefits = [
    "Evidence-based practices you can implement immediately",
    "Real-world examples from successful organizations", 
    "Self-assessment tools to identify growth areas",
    "Communication scripts for difficult conversations",
    "Metrics and measurement frameworks",
    "Action planning templates and worksheets"
  ];

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white p-12 rounded-2xl shadow-xl">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Success! Check Your Email
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              We've sent you the "10 Inclusive Leadership Practices" guide along with some bonus resources. 
              Check your inbox (and spam folder) for the email from Mya at The Huddle Co.
            </p>
            <div className="bg-orange-50 p-6 rounded-lg mb-8">
              <h3 className="font-semibold text-gray-900 mb-2">What's Next?</h3>
              <p className="text-gray-700">
                Ready to put these practices into action? Book a free 30-minute consultation to discuss 
                how we can support your organization's inclusive leadership journey.
              </p>
            </div>
            <button className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center mx-auto space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Schedule Free Consultation</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-green-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Free Resource: 10 Inclusive Leadership Practices
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Transform your leadership approach with proven strategies that create psychological safety, 
                build trust, and empower every team member to contribute their best work.
              </p>
              <div className="space-y-3 mb-8">
                {benefits.slice(0, 3).map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-2 text-orange-500">
                <Download className="h-5 w-5" />
                <span className="font-semibold">Instant download • No spam • Unsubscribe anytime</span>
              </div>
            </div>
            <div>
              <img
                src="https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Inclusive leadership guide preview"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Download Form */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl p-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Get Your Free Leadership Guide
              </h2>
              <p className="text-lg text-gray-600">
                Join 2,000+ leaders who have transformed their teams with these inclusive practices.
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Enter your first name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Enter your email"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-2">
                  Organization (Optional)
                </label>
                <input
                  type="text"
                  id="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                  placeholder="Your company or organization"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <Download className="h-5 w-5" />
                <span>Download Free Guide</span>
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              By downloading this guide, you'll also receive our weekly newsletter with leadership tips and DEI insights. 
              You can unsubscribe at any time.
            </p>
          </div>
        </div>
      </section>

      {/* What's Inside */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              What's Inside the Guide
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              This comprehensive 24-page guide gives you everything you need to start leading more inclusively today.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <span className="text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Resources */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              More Free Resources
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Continue your learning journey with these additional tools and resources.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {additionalResources.map((resource, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="mb-4">{resource.icon}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{resource.title}</h3>
                <p className="text-gray-600 mb-6">{resource.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-orange-500 font-medium">{resource.type}</span>
                  <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full font-medium hover:bg-orange-500 hover:text-white transition-colors duration-200 flex items-center space-x-2">
                    <span>{resource.action}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-500 to-green-500 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Go Deeper?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            These resources are just the beginning. Let's discuss how we can create a custom DEI strategy for your organization.
          </p>
          <button className="bg-white text-blue-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors duration-200 flex items-center mx-auto space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Schedule Discovery Call</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default ResourcePage;