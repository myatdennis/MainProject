import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle, Linkedin, Twitter, Instagram, Calendar } from 'lucide-react';

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    role: '',
    subject: '',
    message: '',
    interest: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would integrate with your form handling service
    setIsSubmitted(true);
  };

  const contactInfo = [
    {
      icon: <Mail className="h-6 w-6 text-orange-500" />,
      title: "Email",
      details: "hello@thehuddleco.com",
      subtitle: "We respond within 24 hours"
    },
    {
      icon: <Phone className="h-6 w-6 text-blue-500" />,
      title: "Phone",
      details: "(555) 123-4567",
      subtitle: "Monday - Friday, 9am - 5pm EST"
    },
    {
      icon: <MapPin className="h-6 w-6 text-green-500" />,
      title: "Location",
      details: "Nationwide Service",
      subtitle: "Virtual & in-person workshops"
    },
    {
      icon: <Clock className="h-6 w-6 text-purple-500" />,
      title: "Response Time",
      details: "Within 24 hours",
      subtitle: "Discovery calls scheduled within 48 hours"
    }
  ];

  const socialLinks = [
    { icon: <Linkedin className="h-6 w-6" />, label: "LinkedIn", href: "#" },
    { icon: <Twitter className="h-6 w-6" />, label: "Twitter", href: "#" },
    { icon: <Instagram className="h-6 w-6" />, label: "Instagram", href: "#" }
  ];

  const faqItems = [
    {
      question: "What's the best way to get started?",
      answer: "The best first step is booking a free 30-minute discovery call where we'll discuss your challenges, goals, and determine the best approach for your organization."
    },
    {
      question: "How quickly can you respond to urgent needs?",
      answer: "For urgent situations requiring immediate support, we can often arrange a consultation within 24-48 hours. Contact us directly by phone for the fastest response."
    },
    {
      question: "Do you work with organizations of all sizes?",
      answer: "Yes! We work with organizations from 20-person nonprofits to Fortune 500 companies. Our approach scales to meet your specific needs and budget."
    },
    {
      question: "Can you provide references from similar organizations?",
      answer: "Absolutely. We can connect you with leaders from organizations similar to yours who can share their experience working with us."
    }
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
              Thank You for Reaching Out!
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              We've received your message and will respond within 24 hours. 
              Mya Dennis personally reviews every inquiry to ensure you get the most relevant information.
            </p>
            <div className="bg-orange-50 p-6 rounded-lg mb-8">
              <h3 className="font-semibold text-gray-900 mb-2">What happens next?</h3>
              <ul className="text-left space-y-2 text-gray-700">
                <li>• We'll review your message and organizational needs</li>
                <li>• You'll receive a personalized response with next steps</li>
                <li>• If appropriate, we'll schedule a discovery call to discuss your goals</li>
                <li>• We'll provide you with relevant resources and case studies</li>
              </ul>
            </div>
            <button className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200">
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-orange-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Let's Start the Conversation
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Ready to transform your organization's culture? We're here to help you create environments where everyone thrives.
          </p>
          <button className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center mx-auto space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Schedule Free Discovery Call</span>
          </button>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactInfo.map((info, index) => (
              <div key={index} className="bg-white p-6 rounded-2xl shadow-lg text-center">
                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  {info.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{info.title}</h3>
                <p className="text-lg font-semibold text-gray-800 mb-1">{info.details}</p>
                <p className="text-sm text-gray-500">{info.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Get in Touch
              </h2>
              <p className="text-lg text-gray-600">
                Tell us about your organization and how we can help you create positive change.
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Enter your email"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-2">
                    Organization *
                  </label>
                  <input
                    type="text"
                    id="organization"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Your company or organization"
                  />
                </div>
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Role *
                  </label>
                  <input
                    type="text"
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Your job title or role"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="interest" className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Interest *
                </label>
                <select
                  id="interest"
                  name="interest"
                  value={formData.interest}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                >
                  <option value="">Select your primary interest</option>
                  <option value="inclusive-leadership">Inclusive Leadership Workshop</option>
                  <option value="courageous-conversations">Courageous Conversations Training</option>
                  <option value="strategic-dei">Strategic DEI Planning</option>
                  <option value="keynote-speaking">Keynote Speaking</option>
                  <option value="custom-solution">Custom Solution</option>
                  <option value="consultation">General Consultation</option>
                </select>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                  placeholder="Brief subject line"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                  placeholder="Tell us about your organization, challenges, and goals. The more details you share, the better we can help you."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <Send className="h-5 w-5" />
                <span>Send Message</span>
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              We typically respond to all inquiries within 24 hours. For urgent matters, please call us directly.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-8">
            {faqItems.map((item, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.question}</h3>
                <p className="text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Links */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Connect with Us
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Follow our journey and get insights on inclusive leadership, DEI best practices, and organizational transformation.
          </p>
          <div className="flex justify-center space-x-6">
            {socialLinks.map((social, index) => (
              <a
                key={index}
                href={social.href}
                className="bg-white p-4 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-200 text-gray-600 hover:text-orange-500"
                aria-label={social.label}
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;