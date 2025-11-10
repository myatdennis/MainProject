import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/PageWrapper';
import { Download, CheckCircle, FileText, Video, Users, Calendar, ArrowRight } from 'lucide-react';
const ResourcePage = () => {
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [organization, setOrganization] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const handleSubmit = (e) => {
        e.preventDefault();
        // Here you would integrate with your email service (Mailchimp, ConvertKit, etc.)
        setIsSubmitted(true);
    };
    const additionalResources = [
        {
            icon: _jsx(FileText, { className: "h-8 w-8 text-blue-500" }),
            title: "DEI Assessment Checklist",
            description: "Evaluate your organization's current state of diversity, equity, and inclusion with our comprehensive 50-point checklist.",
            type: "PDF Download",
            action: "Download Free"
        },
        {
            icon: _jsx(Video, { className: "h-8 w-8 text-green-500" }),
            title: "Courageous Conversations Masterclass",
            description: "45-minute recorded session on navigating difficult discussions with empathy and skill.",
            type: "Video Training",
            action: "Watch Now"
        },
        {
            icon: _jsx(Users, { className: "h-8 w-8 text-orange-500" }),
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
    const navigate = useNavigate();
    if (isSubmitted) {
        return (_jsx(PageWrapper, { children: _jsx("div", { className: "centered", children: _jsxs("div", { className: "card-md max-w-48rem mx-auto", children: [_jsx("div", { className: "centered mb-4", children: _jsx("div", { className: "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4", style: { background: 'var(--success-bg)' }, children: _jsx(CheckCircle, { className: "h-10 w-10 text-success" }) }) }), _jsx("h1", { className: "text-2xl font-bold text-neutral-text mb-3", children: "Success! Check Your Email" }), _jsx("p", { className: "muted-text mb-4", children: "We've sent you the \"10 Inclusive Leadership Practices\" guide along with some bonus resources. Check your inbox (and spam folder) for the email from Mya at The Huddle Co." }), _jsxs("div", { className: "card-md mb-4", children: [_jsx("h3", { className: "font-semibold text-neutral-text mb-2", children: "What's Next?" }), _jsx("p", { className: "muted-text", children: "Ready to put these practices into action? Book a free 30-minute consultation to discuss how we can support your organization's inclusive leadership journey." })] }), _jsxs("button", { onClick: () => navigate('/contact'), className: "btn-primary primary-gradient inline-flex items-center gap-2", children: [_jsx(Calendar, { className: "w-4 h-4" }), _jsx("span", { children: "Schedule Free Consultation" })] })] }) }) }));
    }
    return (_jsxs(PageWrapper, { children: [_jsx("section", { className: "py-16", children: _jsx("div", { children: _jsxs("div", { className: "grid grid-cols-1 gap-12 items-center", children: [_jsxs("div", { children: [_jsx("h1", { style: { fontSize: '2rem', fontWeight: 700, color: 'var(--neutral-text)', marginBottom: '1rem' }, children: "Free Resource: 10 Inclusive Leadership Practices" }), _jsx("p", { style: { fontSize: '1.125rem', color: 'var(--muted-text)', marginBottom: '1.5rem' }, children: "Transform your leadership approach with proven strategies that create psychological safety, build trust, and empower every team member to contribute their best work." }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }, children: benefits.slice(0, 3).map((benefit, index) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' }, children: [_jsx(CheckCircle, { style: { height: '1.25rem', width: '1.25rem', color: 'var(--success)' } }), _jsx("span", { style: { color: 'var(--neutral-text)' }, children: benefit })] }, index))) }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent)' }, children: [_jsx(Download, { style: { height: '1rem', width: '1rem' } }), _jsx("span", { style: { fontWeight: 600 }, children: "Instant download \u2022 No spam \u2022 Unsubscribe anytime" })] })] }), _jsx("div", { children: _jsx("img", { src: "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800", alt: "Inclusive leadership guide preview", className: "img-rounded" }) })] }) }) }), _jsx("section", { className: "container", children: _jsxs("div", { className: "card-md", children: [_jsxs("div", { className: "centered mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-neutral-text mb-2", children: "Get Your Free Leadership Guide" }), _jsx("p", { className: "muted-text", children: "Join 2,000+ leaders who have transformed their teams with these inclusive practices." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "grid gap-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "firstName", className: "text-sm font-semibold muted-text block mb-2", children: "First Name *" }), _jsx("input", { className: "input", id: "firstName", type: "text", value: firstName, onChange: (e) => setFirstName(e.target.value), required: true, placeholder: "Enter your first name" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "text-sm font-semibold muted-text block mb-2", children: "Email Address *" }), _jsx("input", { className: "input", id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, placeholder: "Enter your email" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "organization", className: "text-sm font-semibold muted-text block mb-2", children: "Organization (Optional)" }), _jsx("input", { className: "input", id: "organization", type: "text", value: organization, onChange: (e) => setOrganization(e.target.value), placeholder: "Your company or organization" })] }), _jsxs("button", { type: "submit", className: "btn-primary primary-gradient w-full inline-flex justify-center items-center gap-2", children: [_jsx(Download, { className: "w-4 h-4" }), _jsx("span", { children: "Download Free Guide" })] })] }), _jsx("p", { className: "centered text-sm muted-text mt-4", children: "By downloading this guide, you'll also receive our weekly newsletter with leadership tips and DEI insights. You can unsubscribe at any time." })] }) }), _jsx("section", { style: { background: 'var(--background-muted)', padding: '4rem 0' }, children: _jsxs("div", { children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: '2rem' }, children: [_jsx("h2", { style: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--neutral-text)', marginBottom: '0.5rem' }, children: "What's Inside the Guide" }), _jsx("p", { style: { fontSize: '1.125rem', color: 'var(--muted-text)', maxWidth: '48rem', margin: '0 auto' }, children: "This comprehensive 24-page guide gives you everything you need to start leading more inclusively today." })] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }, children: benefits.map((benefit, index) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' }, children: [_jsx(CheckCircle, { style: { height: '1.5rem', width: '1.5rem', color: 'var(--success)' } }), _jsx("span", { style: { color: 'var(--neutral-text)' }, children: benefit })] }, index))) })] }) }), _jsx("section", { style: { padding: '4rem 0' }, children: _jsxs("div", { style: { maxWidth: '72rem', margin: '0 auto' }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: '2rem' }, children: [_jsx("h2", { style: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--neutral-text)', marginBottom: '0.5rem' }, children: "More Free Resources" }), _jsx("p", { style: { fontSize: '1.125rem', color: 'var(--muted-text)', maxWidth: '48rem', margin: '0 auto' }, children: "Continue your learning journey with these additional tools and resources." })] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }, children: additionalResources.map((resource, index) => (_jsxs("div", { style: { background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '1rem', boxShadow: 'var(--elevation-2)' }, children: [_jsx("div", { style: { marginBottom: '1rem' }, children: resource.icon }), _jsx("h3", { style: { fontSize: '1.25rem', fontWeight: 700, color: 'var(--neutral-text)', marginBottom: '0.75rem' }, children: resource.title }), _jsx("p", { style: { color: 'var(--muted-text)', marginBottom: '1rem' }, children: resource.description }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("span", { style: { fontSize: '0.875rem', color: 'var(--accent)', fontWeight: 600 }, children: resource.type }), _jsxs("button", { onClick: () => {
                                                    if (resource.type.includes('Download'))
                                                        navigate('/resources');
                                                    else if (resource.type.includes('Video'))
                                                        navigate('/lms/courses');
                                                    else
                                                        navigate('/resources');
                                                }, style: { background: 'var(--muted-button-bg)', color: 'var(--muted-button-text)', padding: '0.5rem 0.75rem', borderRadius: '999px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx("span", { children: resource.action }), _jsx(ArrowRight, { style: { height: '1rem', width: '1rem' } })] })] })] }, index))) })] }) }), _jsx("section", { style: { background: 'var(--primary-gradient)', padding: '4rem 0', borderRadius: '1rem' }, children: _jsxs("div", { style: { maxWidth: '72rem', margin: '0 auto', textAlign: 'center' }, children: [_jsx("h2", { style: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--button-text)', marginBottom: '0.75rem' }, children: "Ready to Go Deeper?" }), _jsx("p", { style: { fontSize: '1.125rem', color: 'var(--button-muted)', marginBottom: '1rem', maxWidth: '40rem', marginLeft: 'auto', marginRight: 'auto' }, children: "These resources are just the beginning. Let's discuss how we can create a custom DEI strategy for your organization." }), _jsxs("button", { onClick: () => navigate('/contact'), style: { background: 'var(--button-bg)', color: 'var(--primary)', padding: '0.75rem 1.25rem', borderRadius: '999px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }, children: [_jsx(Calendar, { style: { height: '1.25rem', width: '1.25rem' } }), _jsx("span", { children: "Schedule Discovery Call" })] })] }) })] }));
};
export default ResourcePage;
