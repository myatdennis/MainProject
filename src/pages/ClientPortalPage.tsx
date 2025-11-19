import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Users,
  BookOpen,
  BarChart3,
  Download,
  Video,
  Calendar,
  MessageSquare,
  Settings,
  ArrowRight,
  Send,
  CheckCircle,
  Mail,
  Phone,
} from 'lucide-react';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import { LazyImage } from '../components/PerformanceComponents';

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
      <section className="relative overflow-hidden bg-softwhite py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(242,140,26,0.18),transparent_55%),radial-gradient(circle_at_top_right,rgba(43,132,198,0.22),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(59,170,102,0.2),transparent_45%)]" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <Badge tone="info" className="bg-white/80 text-skyblue">
                Client Portal Preview
              </Badge>
              <h1 className="mt-4 font-heading text-4xl font-bold text-charcoal md:text-[3rem]">
                Your secure learning space is almost here.
              </h1>
              <p className="mt-4 max-w-xl text-base text-slate/80">
                We’re building a comprehensive environment where your team can access tailored training, track
                progress, and keep momentum between live workshops.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button size="lg" leadingIcon={<Lock className="h-4 w-4" />} onClick={() => setShowEarlyAccessModal(true)}>
                  Request early access
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  leadingIcon={<Download className="h-4 w-4" />}
                  onClick={() => setShowLearnMoreModal(true)}
                >
                  Learn more
                </Button>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[420px]">
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-skyblue/10 text-skyblue">
                      <Users className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-heading text-sm font-semibold text-charcoal">Team dashboard</p>
                      <p className="text-xs text-slate/70">Spring 2025 cohort</p>
                    </div>
                  </div>
                  <Badge tone="info" className="bg-skyblue/10 text-skyblue">
                    75% complete
                  </Badge>
                </div>
                <ProgressBar value={75} tone="info" srLabel="Training progress" />
                <div className="space-y-2 text-sm text-slate/80">
                  <div className="flex items-center justify-between rounded-xl bg-cloud px-3 py-2">
                    <span>Inclusive Leadership</span>
                    <span>Completed</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-cloud px-3 py-2">
                    <span>Courageous Conversations</span>
                    <span>In progress</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-cloud px-3 py-2">
                    <span>Strategic Planning Tools</span>
                    <span>Upcoming</span>
                  </div>
                </div>
              </Card>
              <div className="pointer-events-none absolute -top-4 -right-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sunrise to-skyblue text-white">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="text-center">
            <Badge tone="info" className="mx-auto bg-sunrise/15 text-sunrise">
              Coming soon
            </Badge>
            <h2 className="mt-4 font-heading text-3xl font-bold text-charcoal">What you’ll unlock</h2>
            <p className="mx-auto mt-3 max-w-3xl text-base text-slate/80">
              A comprehensive environment to sustain your organization’s DEI transformation beyond the live sessions.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="h-full cursor-pointer space-y-3 transition hover:-translate-y-1 hover:shadow-card"
                onClick={() => handleFeatureCardClick(feature.title)}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cloud text-skyblue">
                  {feature.icon}
                </div>
                <h3 className="font-heading text-xl font-semibold text-charcoal">{feature.title}</h3>
                <p className="text-sm text-slate/80">{feature.description}</p>
                <span className="inline-flex items-center text-sm font-semibold text-skyblue">
                  Click to explore <ArrowRight className="ml-1 h-4 w-4" />
                </span>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-softwhite py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <h2 className="font-heading text-3xl font-bold text-charcoal">Why a client portal?</h2>
              <p className="mt-4 text-base text-slate/80">
                Sustained learning requires ongoing practice and support. Our portal extends your team’s transformation
                journey, offering always-on resources, community, and coach access.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate/80">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-skyblue/10 text-skyblue">
                      <CheckCircle className="h-3 w-3" />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative mx-auto w-full max-w-[420px]">
              <LazyImage
                src="https://images.pexels.com/photos/3184317/pexels-photo-3184317.jpeg?auto=compress&cs=tinysrgb&w=800"
                webpSrc="https://images.pexels.com/photos/3184317/pexels-photo-3184317.webp?auto=compress&cs=tinysrgb&w=800"
                avifSrc="https://images.pexels.com/photos/3184317/pexels-photo-3184317.avif?auto=compress&cs=tinysrgb&w=800"
                alt="Team collaboration"
                className="w-full rounded-[28px] border border-white shadow-[0_32px_60px_rgba(16,24,40,0.18)]"
                sizes="(max-width: 600px) 100vw, 420px"
                fallbackSrc="/placeholder-image.png"
                placeholder={<div className="w-full h-[280px] rounded-[28px] bg-mutedgrey animate-pulse" />}
              />
              <Card tone="muted" className="absolute -bottom-5 left-6 flex w-[200px] flex-col items-center gap-1 rounded-2xl border border-white/70 bg-white/90 py-3 text-center shadow-card-sm">
                <p className="font-heading text-xl font-bold text-skyblue">24/7</p>
                <p className="text-xs text-slate/70">Secure access</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="text-center">
            <h2 className="font-heading text-3xl font-bold text-charcoal">Development roadmap</h2>
            <p className="mx-auto mt-3 max-w-3xl text-base text-slate/80">
              We’re continuously enhancing the portal experience. Here’s a snapshot of what’s on the way.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {upcomingFeatures.map((feature) => (
              <Card key={feature.title} tone="muted" className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-skyblue">{feature.eta}</p>
                <p className="font-heading text-base font-semibold text-charcoal">{feature.title}</p>
                <p className="text-sm text-slate/80">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Current Client Access */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-sunrise via-skyblue to-forest" />
        <div className="relative mx-auto max-w-7xl px-6 text-center text-white lg:px-12">
          <h2 className="font-heading text-3xl font-bold">Current clients</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-white/85">
            Until the portal launches, we’ll continue sending materials directly through secure email. Need something now? Let us know.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Button size="lg" variant="outline" className="border-white/60 bg-white text-skyblue hover:bg-white/90" onClick={() => setShowRequestMaterialsModal(true)}>
              Request materials
            </Button>
            <Button size="lg" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setShowScheduleFollowupModal(true)}>
              Schedule a follow-up
            </Button>
          </div>
        </div>
      </section>

      {/* Early Access */}
      <section className="bg-softwhite py-20">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-12">
          <h2 className="font-heading text-3xl font-bold text-charcoal">Get early access</h2>
          <p className="mt-3 text-base text-slate/80">
            Join the waitlist to experience the client portal as soon as it launches. Early access members receive exclusive features and priority support.
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
