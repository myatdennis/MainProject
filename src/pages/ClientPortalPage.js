import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Users, BookOpen, BarChart3, Download, Video, Calendar, MessageSquare, Settings, ArrowRight, Send, CheckCircle, Mail, Phone, } from 'lucide-react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
const ClientPortalPage = () => {
    const navigate = useNavigate();
    // State for modals and forms
    const [showEarlyAccessModal, setShowEarlyAccessModal] = useState(false);
    const [showLearnMoreModal, setShowLearnMoreModal] = useState(false);
    const [showRequestMaterialsModal, setShowRequestMaterialsModal] = useState(false);
    const [showScheduleFollowupModal, setShowScheduleFollowupModal] = useState(false);
    // Toast notification state
    const [toast, setToast] = useState({ message: '', type: 'success', isVisible: false });
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
    const showToast = (message, type = 'success') => {
        setToast({ message, type, isVisible: true });
    };
    // Handle waitlist submission
    const handleWaitlistSubmit = (e) => {
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
    const handleEarlyAccessSubmit = (e) => {
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
    const handleRequestMaterialsSubmit = (e) => {
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
    const handleScheduleFollowupSubmit = (e) => {
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
    const handleFeatureCardClick = (featureTitle) => {
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
            icon: _jsx(Video, { className: "h-8 w-8 text-blue-500" }),
            title: "Video Learning Modules",
            description: "Access custom training videos designed specifically for your organization's needs and goals."
        },
        {
            icon: _jsx(Download, { className: "h-8 w-8 text-green-500" }),
            title: "Resource Library",
            description: "Download worksheets, templates, assessment tools, and implementation guides."
        },
        {
            icon: _jsx(BarChart3, { className: "h-8 w-8 text-orange-500" }),
            title: "Progress Tracking",
            description: "Monitor your team's learning progress and measure the impact of your DEI initiatives."
        },
        {
            icon: _jsx(MessageSquare, { className: "h-8 w-8 text-purple-500" }),
            title: "Discussion Forums",
            description: "Connect with other leaders, share insights, and ask questions in a supportive community."
        },
        {
            icon: _jsx(Calendar, { className: "h-8 w-8 text-red-500" }),
            title: "Session Scheduling",
            description: "Book follow-up coaching sessions and access upcoming workshop schedules."
        },
        {
            icon: _jsx(Settings, { className: "h-8 w-8 text-gray-500" }),
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
    return (_jsxs("div", { children: [_jsxs("section", { className: "relative overflow-hidden bg-softwhite py-20", children: [_jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(242,140,26,0.18),transparent_55%),radial-gradient(circle_at_top_right,rgba(43,132,198,0.22),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(59,170,102,0.2),transparent_45%)]" }), _jsx("div", { className: "relative mx-auto max-w-7xl px-6 lg:px-12", children: _jsxs("div", { className: "grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px]", children: [_jsxs("div", { children: [_jsx(Badge, { tone: "info", className: "bg-white/80 text-skyblue", children: "Client Portal Preview" }), _jsx("h1", { className: "mt-4 font-heading text-4xl font-bold text-charcoal md:text-[3rem]", children: "Your secure learning space is almost here." }), _jsx("p", { className: "mt-4 max-w-xl text-base text-slate/80", children: "We\u2019re building a comprehensive environment where your team can access tailored training, track progress, and keep momentum between live workshops." }), _jsxs("div", { className: "mt-8 flex flex-wrap gap-4", children: [_jsx(Button, { size: "lg", leadingIcon: _jsx(Lock, { className: "h-4 w-4" }), onClick: () => setShowEarlyAccessModal(true), children: "Request early access" }), _jsx(Button, { size: "lg", variant: "secondary", leadingIcon: _jsx(Download, { className: "h-4 w-4" }), onClick: () => setShowLearnMoreModal(true), children: "Learn more" })] })] }), _jsxs("div", { className: "relative mx-auto w-full max-w-[420px]", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-skyblue/10 text-skyblue", children: _jsx(Users, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-heading text-sm font-semibold text-charcoal", children: "Team dashboard" }), _jsx("p", { className: "text-xs text-slate/70", children: "Spring 2025 cohort" })] })] }), _jsx(Badge, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: "75% complete" })] }), _jsx(ProgressBar, { value: 75, tone: "info", srLabel: "Training progress" }), _jsxs("div", { className: "space-y-2 text-sm text-slate/80", children: [_jsxs("div", { className: "flex items-center justify-between rounded-xl bg-cloud px-3 py-2", children: [_jsx("span", { children: "Inclusive Leadership" }), _jsx("span", { children: "Completed" })] }), _jsxs("div", { className: "flex items-center justify-between rounded-xl bg-cloud px-3 py-2", children: [_jsx("span", { children: "Courageous Conversations" }), _jsx("span", { children: "In progress" })] }), _jsxs("div", { className: "flex items-center justify-between rounded-xl bg-cloud px-3 py-2", children: [_jsx("span", { children: "Strategic Planning Tools" }), _jsx("span", { children: "Upcoming" })] })] })] }), _jsx("div", { className: "pointer-events-none absolute -top-4 -right-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sunrise to-skyblue text-white", children: _jsx(BookOpen, { className: "h-5 w-5" }) })] })] }) })] }), _jsx("section", { className: "bg-white py-20", children: _jsxs("div", { className: "mx-auto max-w-7xl px-6 lg:px-12", children: [_jsxs("div", { className: "text-center", children: [_jsx(Badge, { tone: "info", className: "mx-auto bg-sunrise/15 text-sunrise", children: "Coming soon" }), _jsx("h2", { className: "mt-4 font-heading text-3xl font-bold text-charcoal", children: "What you\u2019ll unlock" }), _jsx("p", { className: "mx-auto mt-3 max-w-3xl text-base text-slate/80", children: "A comprehensive environment to sustain your organization\u2019s DEI transformation beyond the live sessions." })] }), _jsx("div", { className: "mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3", children: features.map((feature) => (_jsxs(Card, { className: "h-full cursor-pointer space-y-3 transition hover:-translate-y-1 hover:shadow-card", onClick: () => handleFeatureCardClick(feature.title), children: [_jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-xl bg-cloud text-skyblue", children: feature.icon }), _jsx("h3", { className: "font-heading text-xl font-semibold text-charcoal", children: feature.title }), _jsx("p", { className: "text-sm text-slate/80", children: feature.description }), _jsxs("span", { className: "inline-flex items-center text-sm font-semibold text-skyblue", children: ["Click to explore ", _jsx(ArrowRight, { className: "ml-1 h-4 w-4" })] })] }, feature.title))) })] }) }), _jsx("section", { className: "bg-softwhite py-20", children: _jsx("div", { className: "mx-auto max-w-7xl px-6 lg:px-12", children: _jsxs("div", { className: "grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px]", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-3xl font-bold text-charcoal", children: "Why a client portal?" }), _jsx("p", { className: "mt-4 text-base text-slate/80", children: "Sustained learning requires ongoing practice and support. Our portal extends your team\u2019s transformation journey, offering always-on resources, community, and coach access." }), _jsx("ul", { className: "mt-6 space-y-3 text-sm text-slate/80", children: benefits.map((benefit) => (_jsxs("li", { className: "flex items-center gap-3", children: [_jsx("span", { className: "flex h-6 w-6 items-center justify-center rounded-full bg-skyblue/10 text-skyblue", children: _jsx(CheckCircle, { className: "h-3 w-3" }) }), benefit] }, benefit))) })] }), _jsxs("div", { className: "relative mx-auto w-full max-w-[420px]", children: [_jsx("img", { src: "https://images.pexels.com/photos/3184317/pexels-photo-3184317.jpeg?auto=compress&cs=tinysrgb&w=800", alt: "Team collaboration", className: "w-full rounded-[28px] border border-white shadow-[0_32px_60px_rgba(16,24,40,0.18)]" }), _jsxs(Card, { tone: "muted", className: "absolute -bottom-5 left-6 flex w-[200px] flex-col items-center gap-1 rounded-2xl border border-white/70 bg-white/90 py-3 text-center shadow-card-sm", children: [_jsx("p", { className: "font-heading text-xl font-bold text-skyblue", children: "24/7" }), _jsx("p", { className: "text-xs text-slate/70", children: "Secure access" })] })] })] }) }) }), _jsx("section", { className: "bg-white py-20", children: _jsxs("div", { className: "mx-auto max-w-7xl px-6 lg:px-12", children: [_jsxs("div", { className: "text-center", children: [_jsx("h2", { className: "font-heading text-3xl font-bold text-charcoal", children: "Development roadmap" }), _jsx("p", { className: "mx-auto mt-3 max-w-3xl text-base text-slate/80", children: "We\u2019re continuously enhancing the portal experience. Here\u2019s a snapshot of what\u2019s on the way." })] }), _jsx("div", { className: "mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4", children: upcomingFeatures.map((feature) => (_jsxs(Card, { tone: "muted", className: "space-y-3", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-skyblue", children: feature.eta }), _jsx("p", { className: "font-heading text-base font-semibold text-charcoal", children: feature.title }), _jsx("p", { className: "text-sm text-slate/80", children: feature.description })] }, feature.title))) })] }) }), _jsxs("section", { className: "relative overflow-hidden py-20", children: [_jsx("div", { className: "absolute inset-0 bg-gradient-to-r from-sunrise via-skyblue to-forest" }), _jsxs("div", { className: "relative mx-auto max-w-7xl px-6 text-center text-white lg:px-12", children: [_jsx("h2", { className: "font-heading text-3xl font-bold", children: "Current clients" }), _jsx("p", { className: "mx-auto mt-3 max-w-2xl text-base text-white/85", children: "Until the portal launches, we\u2019ll continue sending materials directly through secure email. Need something now? Let us know." }), _jsxs("div", { className: "mt-6 flex flex-wrap justify-center gap-4", children: [_jsx(Button, { size: "lg", variant: "outline", className: "border-white/60 bg-white text-skyblue hover:bg-white/90", onClick: () => setShowRequestMaterialsModal(true), children: "Request materials" }), _jsx(Button, { size: "lg", variant: "ghost", className: "text-white hover:bg-white/10", onClick: () => setShowScheduleFollowupModal(true), children: "Schedule a follow-up" })] })] })] }), _jsx("section", { className: "bg-softwhite py-20", children: _jsxs("div", { className: "mx-auto max-w-4xl px-6 text-center lg:px-12", children: [_jsx("h2", { className: "font-heading text-3xl font-bold text-charcoal", children: "Get early access" }), _jsx("p", { className: "mt-3 text-base text-slate/80", children: "Join the waitlist to experience the client portal as soon as it launches. Early access members receive exclusive features and priority support." }), _jsx("div", { className: "bg-white rounded-2xl shadow-xl p-8", children: _jsxs("div", { className: "flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-6", children: [_jsxs("div", { className: "text-left", children: [_jsx("h3", { className: "text-2xl font-bold text-gray-900 mb-2", children: "Join the Waitlist" }), _jsx("p", { className: "text-gray-600", children: "Get notified when the client portal launches and receive exclusive early access." })] }), _jsx("div", { className: "flex space-x-4", children: _jsxs("form", { onSubmit: handleWaitlistSubmit, className: "flex space-x-4 w-full", children: [_jsx("input", { type: "email", placeholder: "Enter your email", value: waitlistEmail, onChange: (e) => setWaitlistEmail(e.target.value), className: "px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1", required: true }), _jsxs("button", { type: "submit", className: "bg-gradient-to-r from-blue-400 to-purple-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-500 hover:to-purple-600 transition-all duration-200 flex items-center space-x-2", children: [_jsx("span", { children: "Join" }), _jsx(ArrowRight, { className: "h-4 w-4" })] })] }) })] }) })] }) }), _jsx(Modal, { isOpen: showEarlyAccessModal, onClose: () => setShowEarlyAccessModal(false), title: "Get Early Access", maxWidth: "lg", children: _jsxs("form", { onSubmit: handleEarlyAccessSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Full Name *" }), _jsx("input", { type: "text", value: earlyAccessForm.name, onChange: (e) => setEarlyAccessForm(prev => ({ ...prev, name: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Email Address *" }), _jsx("input", { type: "email", value: earlyAccessForm.email, onChange: (e) => setEarlyAccessForm(prev => ({ ...prev, email: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Organization" }), _jsx("input", { type: "text", value: earlyAccessForm.organization, onChange: (e) => setEarlyAccessForm(prev => ({ ...prev, organization: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Role" }), _jsx("input", { type: "text", value: earlyAccessForm.role, onChange: (e) => setEarlyAccessForm(prev => ({ ...prev, role: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { className: "flex justify-end space-x-3 pt-4", children: [_jsx("button", { type: "button", onClick: () => setShowEarlyAccessModal(false), className: "px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50", children: "Cancel" }), _jsxs("button", { type: "submit", className: "px-6 py-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white rounded-lg hover:from-blue-500 hover:to-purple-600 flex items-center space-x-2", children: [_jsx(Send, { className: "h-4 w-4" }), _jsx("span", { children: "Submit Request" })] })] })] }) }), _jsx(Modal, { isOpen: showLearnMoreModal, onClose: () => setShowLearnMoreModal(false), title: "About the Client Portal", maxWidth: "2xl", children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-lg font-semibold text-gray-900 mb-3", children: "What is the Client Portal?" }), _jsx("p", { className: "text-gray-600", children: "Our Client Portal is a comprehensive learning management system designed specifically for organizations committed to advancing their DEI initiatives. It provides a secure, private space where your team can continue their learning journey beyond our workshops." })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-lg font-semibold text-gray-900 mb-3", children: "Key Features" }), _jsxs("ul", { className: "space-y-2 text-gray-600", children: [_jsxs("li", { className: "flex items-center", children: [_jsx(CheckCircle, { className: "h-5 w-5 text-green-500 mr-2" }), "Custom training materials tailored to your organization"] }), _jsxs("li", { className: "flex items-center", children: [_jsx(CheckCircle, { className: "h-5 w-5 text-green-500 mr-2" }), "Progress tracking and analytics for your team"] }), _jsxs("li", { className: "flex items-center", children: [_jsx(CheckCircle, { className: "h-5 w-5 text-green-500 mr-2" }), "Secure document sharing and resource library"] }), _jsxs("li", { className: "flex items-center", children: [_jsx(CheckCircle, { className: "h-5 w-5 text-green-500 mr-2" }), "Discussion forums for peer learning"] }), _jsxs("li", { className: "flex items-center", children: [_jsx(CheckCircle, { className: "h-5 w-5 text-green-500 mr-2" }), "Direct access to your Huddle Co. facilitator"] })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-lg font-semibold text-gray-900 mb-3", children: "Launch Timeline" }), _jsx("p", { className: "text-gray-600", children: "We're targeting a Q2 2025 launch for the full client portal. Early access members will get exclusive preview access and the opportunity to help shape the platform with their feedback." })] }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: () => {
                                    setShowLearnMoreModal(false);
                                    setShowEarlyAccessModal(true);
                                }, className: "px-6 py-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white rounded-lg hover:from-blue-500 hover:to-purple-600", children: "Get Early Access" }) })] }) }), _jsx(Modal, { isOpen: showRequestMaterialsModal, onClose: () => setShowRequestMaterialsModal(false), title: "Request Training Materials", maxWidth: "lg", children: _jsxs("form", { onSubmit: handleRequestMaterialsSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Full Name *" }), _jsx("input", { type: "text", value: requestMaterialsForm.name, onChange: (e) => setRequestMaterialsForm(prev => ({ ...prev, name: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Email Address *" }), _jsx("input", { type: "email", value: requestMaterialsForm.email, onChange: (e) => setRequestMaterialsForm(prev => ({ ...prev, email: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Organization" }), _jsx("input", { type: "text", value: requestMaterialsForm.organization, onChange: (e) => setRequestMaterialsForm(prev => ({ ...prev, organization: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Type of Materials Needed" }), _jsxs("select", { value: requestMaterialsForm.materialType, onChange: (e) => setRequestMaterialsForm(prev => ({ ...prev, materialType: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", children: [_jsx("option", { value: "", children: "Select material type" }), _jsx("option", { value: "session-recordings", children: "Session Recordings" }), _jsx("option", { value: "worksheets", children: "Worksheets & Templates" }), _jsx("option", { value: "assessments", children: "Assessment Tools" }), _jsx("option", { value: "implementation-guides", children: "Implementation Guides" }), _jsx("option", { value: "all", children: "All Available Materials" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Additional Details" }), _jsx("textarea", { rows: 3, value: requestMaterialsForm.message, onChange: (e) => setRequestMaterialsForm(prev => ({ ...prev, message: e.target.value })), placeholder: "Any specific materials or sessions you're looking for?", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { className: "flex justify-end space-x-3 pt-4", children: [_jsx("button", { type: "button", onClick: () => setShowRequestMaterialsModal(false), className: "px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50", children: "Cancel" }), _jsxs("button", { type: "submit", className: "px-6 py-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white rounded-lg hover:from-blue-500 hover:to-purple-600 flex items-center space-x-2", children: [_jsx(Mail, { className: "h-4 w-4" }), _jsx("span", { children: "Send Request" })] })] })] }) }), _jsx(Modal, { isOpen: showScheduleFollowupModal, onClose: () => setShowScheduleFollowupModal(false), title: "Schedule Follow-up Session", maxWidth: "lg", children: _jsxs("form", { onSubmit: handleScheduleFollowupSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Full Name *" }), _jsx("input", { type: "text", value: scheduleFollowupForm.name, onChange: (e) => setScheduleFollowupForm(prev => ({ ...prev, name: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Email Address *" }), _jsx("input", { type: "email", value: scheduleFollowupForm.email, onChange: (e) => setScheduleFollowupForm(prev => ({ ...prev, email: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Organization" }), _jsx("input", { type: "text", value: scheduleFollowupForm.organization, onChange: (e) => setScheduleFollowupForm(prev => ({ ...prev, organization: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Preferred Time" }), _jsxs("select", { value: scheduleFollowupForm.preferredTime, onChange: (e) => setScheduleFollowupForm(prev => ({ ...prev, preferredTime: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", children: [_jsx("option", { value: "", children: "Select preferred time" }), _jsx("option", { value: "morning", children: "Morning (9 AM - 12 PM EST)" }), _jsx("option", { value: "afternoon", children: "Afternoon (12 PM - 5 PM EST)" }), _jsx("option", { value: "evening", children: "Evening (5 PM - 8 PM EST)" }), _jsx("option", { value: "flexible", children: "Flexible - Any time" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Message" }), _jsx("textarea", { rows: 3, value: scheduleFollowupForm.message, onChange: (e) => setScheduleFollowupForm(prev => ({ ...prev, message: e.target.value })), placeholder: "What would you like to discuss in the follow-up session?", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { className: "flex justify-end space-x-3 pt-4", children: [_jsx("button", { type: "button", onClick: () => setShowScheduleFollowupModal(false), className: "px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50", children: "Cancel" }), _jsxs("button", { type: "submit", className: "px-6 py-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white rounded-lg hover:from-blue-500 hover:to-purple-600 flex items-center space-x-2", children: [_jsx(Phone, { className: "h-4 w-4" }), _jsx("span", { children: "Schedule Session" })] })] })] }) }), _jsx(Toast, { message: toast.message, type: toast.type, isVisible: toast.isVisible, onClose: () => setToast(prev => ({ ...prev, isVisible: false })) })] }));
};
export default ClientPortalPage;
