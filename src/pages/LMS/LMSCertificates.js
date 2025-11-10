import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Download, Share2, Calendar, User, Trophy, Search, Eye, ExternalLink } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import { useToast } from '../../context/ToastContext';
import { getCertificatesByUser } from '../../dal/certificates';
import EmptyState from '../../components/ui/EmptyState';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useUserProfile } from '../../hooks/useUserProfile';
const LMSCertificates = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState('date');
    const { user } = useUserProfile();
    const learnerId = useMemo(() => {
        if (user)
            return (user.email || user.id || 'local-user').toLowerCase();
        try {
            const raw = localStorage.getItem('huddle_user');
            if (raw) {
                const parsed = JSON.parse(raw);
                return (parsed.email || parsed.id || 'local-user').toLowerCase();
            }
        }
        catch (error) {
            console.warn('Failed to parse learner identity for certificates (legacy fallback):', error);
        }
        return 'local-user';
    }, [user]);
    useEffect(() => {
        loadCertificates();
    }, [learnerId]);
    const loadCertificates = async () => {
        setLoading(true);
        try {
            const generatedCertificates = await getCertificatesByUser(learnerId);
            const normalized = generatedCertificates.map((cert) => {
                const completionTimeToken = cert.metadata?.completionTime ?? '';
                const completionMinutes = parseInt(String(completionTimeToken).replace(/[^0-9]/g, ''), 10);
                const effectiveMinutes = Number.isFinite(completionMinutes) ? completionMinutes : 60;
                const inferredHours = Math.max(1, Math.round(effectiveMinutes / 60));
                const requirements = cert.metadata.requirements || [];
                return {
                    id: cert.id,
                    courseTitle: cert.courseName,
                    courseName: cert.courseName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    completionDate: cert.completionDate,
                    issueDate: cert.generatedAt,
                    certificateUrl: cert.certificateUrl,
                    instructor: cert.metadata.instructorName,
                    credentialId: cert.verificationCode,
                    skills: requirements.length > 0 ? requirements : ['Certificate earned'],
                    category: cert.metadata.organizationName || 'Learning',
                    hours: inferredHours,
                    grade: cert.metadata.finalScore !== undefined ? `${cert.metadata.finalScore}%` : undefined,
                    status: cert.status === 'expired' ? 'expired' : 'active',
                    validUntil: cert.validUntil,
                    shareableUrl: `${window.location.origin}/verify/${cert.verificationCode}`
                };
            });
            setCertificates(normalized);
        }
        catch (error) {
            showToast('Failed to load certificates', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const filteredCertificates = certificates
        .filter(cert => {
        const matchesSearch = cert.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cert.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = filterCategory === 'all' || cert.category.toLowerCase() === filterCategory;
        const matchesStatus = filterStatus === 'all' || cert.status === filterStatus;
        return matchesSearch && matchesCategory && matchesStatus;
    })
        .sort((a, b) => {
        switch (sortBy) {
            case 'date':
                return new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime();
            case 'course':
                return a.courseTitle.localeCompare(b.courseTitle);
            case 'grade':
                return (b.grade || 'Z').localeCompare(a.grade || 'Z');
            default:
                return 0;
        }
    });
    const categories = ['all', ...new Set(certificates.map(cert => cert.category.toLowerCase()))];
    const downloadCertificate = async (certificate) => {
        try {
            if (!certificate.certificateUrl) {
                showToast('Certificate link unavailable', 'error');
                return;
            }
            const anchor = document.createElement('a');
            anchor.href = certificate.certificateUrl;
            anchor.download = `${certificate.courseTitle.replace(/\s+/g, '-')}-certificate.pdf`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            showToast('Certificate download started', 'success');
        }
        catch (error) {
            showToast('Failed to download certificate', 'error');
        }
    };
    const shareCertificate = async (certificate) => {
        try {
            await navigator.clipboard.writeText(certificate.shareableUrl);
            showToast('Certificate link copied to clipboard!', 'success');
        }
        catch (error) {
            showToast('Failed to copy link', 'error');
        }
    };
    const viewCertificate = (certificate) => {
        // Open certificate in new tab for viewing
        window.open(certificate.certificateUrl, '_blank');
    };
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    const getGradeColor = (grade) => {
        if (!grade)
            return 'text-gray-500';
        const letter = grade.charAt(0);
        switch (letter) {
            case 'A': return 'text-green-600';
            case 'B': return 'text-blue-600';
            case 'C': return 'text-yellow-600';
            default: return 'text-gray-500';
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'expired': return 'text-yellow-600 bg-yellow-100';
            case 'revoked': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx(SEO, { title: "My Certificates - Learning Platform", description: "View and manage your earned certificates and achievements", keywords: ['certificates', 'achievements', 'credentials', 'learning', 'completion'] }), _jsx("div", { className: "min-h-screen bg-softwhite", children: _jsxs("div", { className: "container-page section", children: [_jsx(Breadcrumbs, { items: [{ label: 'Certificates', to: '/lms/certificates' }] }), _jsxs("div", { className: "mb-8 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Award, { className: "h-7 w-7 text-orange-500" }), _jsx("h1", { className: "h1", children: "My Certificates" })] }), _jsx("button", { onClick: () => navigate('/lms/dashboard'), className: "nav-link", children: "Back to Dashboard" })] }), _jsxs("div", { className: "", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6 mb-8", children: [_jsx("div", { className: "card-lg card-hover", children: _jsxs("div", { className: "flex items-center", children: [_jsx(Award, { className: "h-8 w-8 text-orange-500" }), _jsxs("div", { className: "ml-4", children: [_jsx("p", { className: "text-sm font-medium text-slate/80", children: "Total Certificates" }), _jsx("p", { className: "text-2xl font-bold text-charcoal", children: certificates.length })] })] }) }), _jsx("div", { className: "card-lg card-hover", children: _jsxs("div", { className: "flex items-center", children: [_jsx(Trophy, { className: "h-8 w-8 text-green-500" }), _jsxs("div", { className: "ml-4", children: [_jsx("p", { className: "text-sm font-medium text-slate/80", children: "Active" }), _jsx("p", { className: "text-2xl font-bold text-charcoal", children: certificates.filter(c => c.status === 'active').length })] })] }) }), _jsx("div", { className: "card-lg card-hover", children: _jsxs("div", { className: "flex items-center", children: [_jsx(Calendar, { className: "h-8 w-8 text-blue-500" }), _jsxs("div", { className: "ml-4", children: [_jsx("p", { className: "text-sm font-medium text-slate/80", children: "Hours Completed" }), _jsx("p", { className: "text-2xl font-bold text-charcoal", children: certificates.reduce((total, cert) => total + cert.hours, 0) })] })] }) }), _jsx("div", { className: "card-lg card-hover", children: _jsxs("div", { className: "flex items-center", children: [_jsx(User, { className: "h-8 w-8 text-purple-500" }), _jsxs("div", { className: "ml-4", children: [_jsx("p", { className: "text-sm font-medium text-slate/80", children: "Skills Earned" }), _jsx("p", { className: "text-2xl font-bold text-charcoal", children: new Set(certificates.flatMap(c => c.skills)).size })] })] }) })] }), _jsx("div", { className: "card-lg card-hover mb-8", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-3 h-4 w-4 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search certificates...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "pl-10 pr-4 py-2 w-full rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsx("select", { value: filterCategory, onChange: (e) => setFilterCategory(e.target.value), className: "px-3 py-2 rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: categories.map(category => (_jsx("option", { value: category, children: category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1) }, category))) }), _jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "px-3 py-2 rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Status" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "expired", children: "Expired" })] }), _jsxs("select", { value: sortBy, onChange: (e) => setSortBy(e.target.value), className: "px-3 py-2 rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "date", children: "Sort by Date" }), _jsx("option", { value: "course", children: "Sort by Course" }), _jsx("option", { value: "grade", children: "Sort by Grade" })] })] }) }), loading ? (_jsxs("div", { className: "text-center py-12", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" }), _jsx("p", { className: "mt-4 text-gray-600", children: "Loading certificates..." })] })) : filteredCertificates.length === 0 ? (_jsx(EmptyState, { title: searchTerm ? 'No matching certificates' : 'No certificates yet', description: searchTerm ? 'Try adjusting your search filters' : 'Complete courses to earn your first certificate!', action: !searchTerm ? (_jsx("button", { onClick: () => navigate('/lms/courses'), className: "btn-cta", children: "Browse Courses" })) : undefined, illustrationSrc: undefined })) : (_jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6", children: filteredCertificates.map(certificate => (_jsxs("div", { className: "card-lg card-hover overflow-hidden transition-shadow", children: [_jsxs("div", { className: "px-6 py-4", style: { backgroundImage: 'var(--gradient-orange-red)' }, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Award, { className: "h-8 w-8 text-white" }), _jsx("span", { className: `px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(certificate.status)}`, children: certificate.status.charAt(0).toUpperCase() + certificate.status.slice(1) })] }), _jsx("h3", { className: "text-white font-bold text-lg mt-2 line-clamp-2", children: certificate.courseTitle }), _jsxs("p", { className: "text-orange-100 text-sm", children: ["Credential ID: ", certificate.credentialId] })] }), _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "space-y-3 mb-4", children: [_jsxs("div", { className: "flex items-center text-sm text-gray-600", children: [_jsx(Calendar, { className: "h-4 w-4 mr-2" }), "Completed: ", formatDate(certificate.completionDate)] }), _jsxs("div", { className: "flex items-center text-sm text-gray-600", children: [_jsx(User, { className: "h-4 w-4 mr-2" }), "Instructor: ", certificate.instructor] }), _jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("span", { className: "text-gray-600", children: [certificate.hours, " hours"] }), certificate.grade && (_jsxs("span", { className: `font-medium ${getGradeColor(certificate.grade)}`, children: ["Grade: ", certificate.grade] }))] })] }), _jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "text-xs font-medium text-gray-700 mb-2", children: "Skills Demonstrated:" }), _jsxs("div", { className: "flex flex-wrap gap-1", children: [certificate.skills.slice(0, 3).map(skill => (_jsx("span", { className: "px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full", children: skill }, skill))), certificate.skills.length > 3 && (_jsxs("span", { className: "px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full", children: ["+", certificate.skills.length - 3, " more"] }))] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("button", { onClick: () => viewCertificate(certificate), className: "flex-1 btn-outline", children: [_jsx(Eye, { className: "h-4 w-4 mr-2" }), "View"] }), _jsxs("button", { onClick: () => downloadCertificate(certificate), className: "flex-1 btn-cta", children: [_jsx(Download, { className: "h-4 w-4 mr-2" }), "Download"] }), _jsx("button", { onClick: () => shareCertificate(certificate), className: "btn-outline px-3 py-2", children: _jsx(Share2, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "mt-3 pt-3 border-t border-gray-100", children: _jsxs("a", { href: certificate.shareableUrl, target: "_blank", rel: "noopener noreferrer", className: "flex items-center text-xs text-gray-500 hover:text-orange-600", children: [_jsx(ExternalLink, { className: "h-3 w-3 mr-1" }), "Verify Certificate"] }) })] })] }, certificate.id))) }))] })] }) })] }));
};
export default LMSCertificates;
