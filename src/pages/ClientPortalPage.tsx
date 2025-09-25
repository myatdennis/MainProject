import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Users, BookOpen, BarChart3, Download, Video, Calendar, MessageSquare, Settings, ArrowRight, Send, CheckCircle, Mail, Phone } from 'lucide-react';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';

const ClientPortalPage = () => {
  const navigate = useNavigate();
  
  // State for modals and forms
  const [showEarlyAccessModal, setShowEarlyAccessModal] = useState(false);
  const [showLearnMoreModal, setShowLearnMoreModal] = useState(false);
  const [showRequestMaterialsModal, setShowRequestMaterialsModal] = useState(false);
  const [showScheduleFollowupModal, setShowScheduleFollowupModal] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    isVisible: boolean;
  }>({ message: '', type: 'success', isVisible: false });
  
  // Form states
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [earlyAccessForm, setEarlyAccessForm] = useState({
    name: '',
    email: '',
    organization: '',
    role: ''
  });
  const [requestMaterialsForm, setRequestMaterialsForm] = useState({
    name: '',
    email: '',
    organization: '',
    materialType: '',
    message: ''
  });
  const [scheduleFollowupForm, setScheduleFollowupForm] = useState({
    name: '',
    email: '',
    organization: '',
    preferredTime: '',
    message: ''
  });
  
  // Helper function to show toast notifications
  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type, isVisible: true });
  };
  
  // Handle waitlist submission
  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) {
      showToast('Please enter your email address', 'error');
      return;
    }
    // Simulate API call
    setTimeout(() => {
      showToast('Successfully joined the waitlist! We\'ll notify you when the portal launches.');
      setWaitlistEmail('');
    }, 500);
  };
  
  // Handle early access form submission
  const handleEarlyAccessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!earlyAccessForm.name || !earlyAccessForm.email) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    // Simulate API call
    setTimeout(() => {
      showToast('Early access request submitted! We\'ll contact you within 24 hours.');
      setEarlyAccessForm({ name: '', email: '', organization: '', role: '' });
      setShowEarlyAccessModal(false);
    }, 500);
  };
  
  // Handle request materials form submission
  const handleRequestMaterialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestMaterialsForm.name || !requestMaterialsForm.email) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    // Simulate API call
    setTimeout(() => {
      showToast('Materials request submitted! We\'ll send them to your secure email within 24 hours.');
      setRequestMaterialsForm({ name: '', email: '', organization: '', materialType: '', message: '' });
      setShowRequestMaterialsModal(false);
    }, 500);
  };
  
  // Handle schedule followup form submission
  const handleScheduleFollowupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleFollowupForm.name || !scheduleFollowupForm.email) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    // Simulate API call
    setTimeout(() => {
      showToast('Follow-up request submitted! We\'ll contact you to schedule within 24 hours.');
      setScheduleFollowupForm({ name: '', email: '', organization: '', preferredTime: '', message: '' });
      setShowScheduleFollowupModal(false);
    }, 500);
  };
  
  // Handle feature card clicks
  const handleFeatureCardClick = (featureTitle: string) => {
    switch (featureTitle) {
      case 'Resource Library':
        navigate('/client/documents');
        break;
      case 'Progress Tracking':
        navigate('/lms/dashboard');
        break;
      case 'Video Learning Modules':
        navigate('/lms/courses');
        break;
      case 'Discussion Forums':
        navigate('/lms/feedback');
        break;
      case 'Session Scheduling':
        navigate('/contact');
        break;
      case 'Custom Content':
        showToast('Custom content will be available in your personalized portal!', 'info');
        break;
      default:
        showToast('This feature will be available in the full portal!', 'info');
    }
  };
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
                Your Secure Learning Space is Coming Soon
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                We're building a comprehensive learning management system where your team can access 
                custom training materials, track progress, and continue your DEI journey beyond our workshops.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <button 
                  onClick={() => setShowEarlyAccessModal(true)}
                  className="bg-gradient-to-r from-blue-400 to-purple-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-blue-500 hover:to-purple-600 transition-all duration-200 transform hover:scale-105"
                >
                  Get Early Access
                </button>
                <button 
                  onClick={() => setShowLearnMoreModal(true)}
                  className="border-2 border-blue-500 text-blue-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-blue-500 hover:text-white transition-all duration-200"
                >
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
              <div 
                key={index} 
                onClick={() => handleFeatureCardClick(feature.title)}
                className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer transform hover:scale-105"
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <div className="text-blue-500 font-medium flex items-center">
                  <span className="text-sm">Click to explore</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </div>
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
            <button 
              onClick={() => setShowRequestMaterialsModal(true)}
              className="bg-white text-blue-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Request Materials
            </button>
            <button 
              onClick={() => setShowScheduleFollowupModal(true)}
              className="border-2 border-white text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-blue-500 transition-colors duration-200"
            >
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
                <form onSubmit={handleWaitlistSubmit} className="flex space-x-4 w-full">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
                    required
                  />
                  <button 
                    type="submit"
                    className="bg-gradient-to-r from-blue-400 to-purple-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-500 hover:to-purple-600 transition-all duration-200 flex items-center space-x-2"
                  >
                    <span>Join</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modals */}
      {/* Early Access Modal */}
      <Modal
        isOpen={showEarlyAccessModal}
        onClose={() => setShowEarlyAccessModal(false)}
        title="Get Early Access"
        maxWidth="lg"
      >
        <form onSubmit={handleEarlyAccessSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={earlyAccessForm.name}
              onChange={(e) => setEarlyAccessForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={earlyAccessForm.email}
              onChange={(e) => setEarlyAccessForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization
            </label>
            <input
              type="text"
              value={earlyAccessForm.organization}
              onChange={(e) => setEarlyAccessForm(prev => ({ ...prev, organization: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <input
              type="text"
              value={earlyAccessForm.role}
              onChange={(e) => setEarlyAccessForm(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowEarlyAccessModal(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white rounded-lg hover:from-blue-500 hover:to-purple-600 flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>Submit Request</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Learn More Modal */}
      <Modal
        isOpen={showLearnMoreModal}
        onClose={() => setShowLearnMoreModal(false)}
        title="About the Client Portal"
        maxWidth="2xl"
      >
        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">What is the Client Portal?</h4>
            <p className="text-gray-600">
              Our Client Portal is a comprehensive learning management system designed specifically for organizations 
              committed to advancing their DEI initiatives. It provides a secure, private space where your team can 
              continue their learning journey beyond our workshops.
            </p>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Key Features</h4>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Custom training materials tailored to your organization
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Progress tracking and analytics for your team
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Secure document sharing and resource library
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Discussion forums for peer learning
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Direct access to your Huddle Co. facilitator
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Launch Timeline</h4>
            <p className="text-gray-600">
              We're targeting a Q2 2025 launch for the full client portal. Early access members will get exclusive 
              preview access and the opportunity to help shape the platform with their feedback.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setShowLearnMoreModal(false);
                setShowEarlyAccessModal(true);
              }}
              className="px-6 py-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white rounded-lg hover:from-blue-500 hover:to-purple-600"
            >
              Get Early Access
            </button>
          </div>
        </div>
      </Modal>

      {/* Request Materials Modal */}
      <Modal
        isOpen={showRequestMaterialsModal}
        onClose={() => setShowRequestMaterialsModal(false)}
        title="Request Training Materials"
        maxWidth="lg"
      >
        <form onSubmit={handleRequestMaterialsSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={requestMaterialsForm.name}
              onChange={(e) => setRequestMaterialsForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={requestMaterialsForm.email}
              onChange={(e) => setRequestMaterialsForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization
            </label>
            <input
              type="text"
              value={requestMaterialsForm.organization}
              onChange={(e) => setRequestMaterialsForm(prev => ({ ...prev, organization: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type of Materials Needed
            </label>
            <select
              value={requestMaterialsForm.materialType}
              onChange={(e) => setRequestMaterialsForm(prev => ({ ...prev, materialType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select material type</option>
              <option value="session-recordings">Session Recordings</option>
              <option value="worksheets">Worksheets & Templates</option>
              <option value="assessments">Assessment Tools</option>
              <option value="implementation-guides">Implementation Guides</option>
              <option value="all">All Available Materials</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Details
            </label>
            <textarea
              rows={3}
              value={requestMaterialsForm.message}
              onChange={(e) => setRequestMaterialsForm(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Any specific materials or sessions you're looking for?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowRequestMaterialsModal(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white rounded-lg hover:from-blue-500 hover:to-purple-600 flex items-center space-x-2"
            >
              <Mail className="h-4 w-4" />
              <span>Send Request</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Schedule Follow-up Modal */}
      <Modal
        isOpen={showScheduleFollowupModal}
        onClose={() => setShowScheduleFollowupModal(false)}
        title="Schedule Follow-up Session"
        maxWidth="lg"
      >
        <form onSubmit={handleScheduleFollowupSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={scheduleFollowupForm.name}
              onChange={(e) => setScheduleFollowupForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={scheduleFollowupForm.email}
              onChange={(e) => setScheduleFollowupForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization
            </label>
            <input
              type="text"
              value={scheduleFollowupForm.organization}
              onChange={(e) => setScheduleFollowupForm(prev => ({ ...prev, organization: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Time
            </label>
            <select
              value={scheduleFollowupForm.preferredTime}
              onChange={(e) => setScheduleFollowupForm(prev => ({ ...prev, preferredTime: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select preferred time</option>
              <option value="morning">Morning (9 AM - 12 PM EST)</option>
              <option value="afternoon">Afternoon (12 PM - 5 PM EST)</option>
              <option value="evening">Evening (5 PM - 8 PM EST)</option>
              <option value="flexible">Flexible - Any time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              rows={3}
              value={scheduleFollowupForm.message}
              onChange={(e) => setScheduleFollowupForm(prev => ({ ...prev, message: e.target.value }))}
              placeholder="What would you like to discuss in the follow-up session?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowScheduleFollowupModal(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white rounded-lg hover:from-blue-500 hover:to-purple-600 flex items-center space-x-2"
            >
              <Phone className="h-4 w-4" />
              <span>Schedule Session</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
};

export default ClientPortalPage;