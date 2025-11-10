import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { X, User, Building, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';
import { useFormValidation, validators } from './FormComponents';
import SecurityUtils from '../utils/SecurityUtils';
const AddUserModal = ({ isOpen, onClose, onUserAdded, editUser }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const isEditMode = !!editUser;
    const { values, errors, setValue, validateAll } = useFormValidation({
        firstName: editUser?.name?.split(' ')[0] || '',
        lastName: editUser?.name?.split(' ').slice(1).join(' ') || '',
        email: editUser?.email || '',
        role: editUser?.role || '',
        organization: editUser?.organization || '',
        cohort: editUser?.cohort || '',
        department: '',
        phoneNumber: '',
    }, {
        firstName: [validators.required, validators.minLength(2)],
        lastName: [validators.required, validators.minLength(2)],
        email: [validators.required, validators.email],
        role: [validators.required],
        organization: [validators.required],
        cohort: [validators.required],
    });
    const organizations = [
        'Pacific Coast University',
        'Mountain View High School',
        'Community Impact Network',
        'Regional Fire Department',
        'Healthcare Partners'
    ];
    const cohorts = [
        'Spring 2025 Leadership',
        'Winter 2025 Leadership',
        'Summer 2025 Leadership',
        'Custom Training'
    ];
    const roles = [
        'Executive Director',
        'VP Student Affairs',
        'Athletic Director',
        'Training Commander',
        'Department Manager',
        'Team Lead',
        'Specialist',
        'Other'
    ];
    // Framer Motion modal animation
    const modalVariants = {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
        exit: { opacity: 0, y: 40, transition: { duration: 0.18 } }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateAll()) {
            return;
        }
        // Security validation
        const emailValidation = SecurityUtils.validateAndSanitizeEmail(values.email);
        if (!emailValidation.isValid) {
            showToast('Please enter a valid email address', 'error');
            return;
        }
        const phoneValidation = SecurityUtils.validateAndSanitizePhone(values.phoneNumber || '');
        if (values.phoneNumber && !phoneValidation.isValid) {
            showToast('Please enter a valid phone number', 'error');
            return;
        }
        // Sanitize all text inputs
        const sanitizedData = {
            firstName: SecurityUtils.sanitizeInput(values.firstName),
            lastName: SecurityUtils.sanitizeInput(values.lastName),
            email: emailValidation.sanitized,
            phoneNumber: phoneValidation.sanitized,
            organization: SecurityUtils.sanitizeInput(values.organization),
            department: SecurityUtils.sanitizeInput(values.department || ''),
            role: SecurityUtils.sanitizeInput(values.role),
            cohort: SecurityUtils.sanitizeInput(values.cohort)
        };
        // Log security event
        SecurityUtils.logSecurityEvent({
            type: 'login_attempt',
            details: { action: 'create_user', email: sanitizedData.email },
            severity: 'low'
        });
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (isEditMode && editUser) {
                // Update existing user
                const updatedUser = {
                    ...editUser,
                    name: `${sanitizedData.firstName} ${sanitizedData.lastName}`,
                    email: sanitizedData.email,
                    organization: sanitizedData.organization,
                    cohort: sanitizedData.cohort,
                    role: sanitizedData.role,
                    department: sanitizedData.department,
                    phoneNumber: sanitizedData.phoneNumber,
                };
                onUserAdded?.(updatedUser);
                showToast('User updated successfully!', 'success');
            }
            else {
                // Create new user
                const newUser = {
                    id: Date.now().toString(),
                    name: `${sanitizedData.firstName} ${sanitizedData.lastName}`,
                    email: sanitizedData.email,
                    organization: sanitizedData.organization,
                    cohort: sanitizedData.cohort,
                    role: sanitizedData.role,
                    department: sanitizedData.department,
                    phoneNumber: sanitizedData.phoneNumber,
                    enrolled: new Date().toISOString(),
                    lastLogin: null,
                    status: 'active',
                    progress: {
                        foundations: 0,
                        bias: 0,
                        empathy: 0,
                        conversations: 0,
                        planning: 0
                    },
                    overallProgress: 0,
                    completedModules: 0,
                    totalModules: 5,
                    feedbackSubmitted: false
                };
                onUserAdded?.(newUser);
                showToast('User added successfully!', 'success');
            }
            // Reset form
            // Reset form values
            setValue('firstName', '');
            setValue('lastName', '');
            setValue('email', '');
            setValue('role', '');
            setValue('organization', '');
            setValue('cohort', '');
            setValue('department', '');
            setValue('phoneNumber', '');
            onClose();
        }
        catch (error) {
            showToast(isEditMode ? 'Failed to update user. Please try again.' : 'Failed to add user. Please try again.', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !loading) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // Focus the modal when it opens
            const modalElement = document.getElementById('add-user-modal');
            if (modalElement) {
                modalElement.focus();
            }
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, loading, onClose]);
    return (_jsx(AnimatePresence, { children: isOpen && (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", role: "dialog", "aria-modal": "true", "aria-labelledby": "add-user-modal-title", children: [_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "fixed inset-0 bg-gradient-to-br from-charcoal/60 via-indigo-900/40 to-sunrise/40 backdrop-blur-sm", onClick: onClose, "aria-label": "Close modal background" }), _jsxs(motion.div, { id: "add-user-modal", className: "bg-ivory rounded-3xl shadow-2xl border border-mutedgrey max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto focus:outline-none", tabIndex: -1, variants: modalVariants, initial: "hidden", animate: "visible", exit: "exit", onKeyDown: (e) => {
                        if (e.key === 'Tab') {
                            // Keep focus within modal
                            const focusableElements = e.currentTarget.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
                            const firstElement = focusableElements[0];
                            const lastElement = focusableElements[focusableElements.length - 1];
                            if (e.shiftKey && document.activeElement === firstElement) {
                                e.preventDefault();
                                lastElement.focus();
                            }
                            else if (!e.shiftKey && document.activeElement === lastElement) {
                                e.preventDefault();
                                firstElement.focus();
                            }
                        }
                    }, "aria-label": isEditMode ? 'Edit User Modal' : 'Add User Modal', children: [_jsxs("div", { className: "flex items-center justify-between p-8 border-b border-mutedgrey bg-gradient-to-r from-sunrise/10 to-indigo-100 rounded-t-3xl", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-sunrise/20 p-3 rounded-xl", children: _jsx(UserPlus, { className: "h-7 w-7 text-sunrise" }) }), _jsxs("div", { children: [_jsx("h2", { id: "add-user-modal-title", className: "text-2xl font-heading text-charcoal", children: isEditMode ? 'Edit User' : 'Add New User' }), _jsx("p", { className: "text-sm text-gray-600 font-body", children: isEditMode ? 'Update user information and settings' : 'Create a new user account and assign to courses' })] })] }), _jsx("button", { onClick: onClose, className: "p-2 text-gray-400 hover:text-charcoal rounded-full focus:outline-none focus:ring-2 focus:ring-sunrise", disabled: loading, "aria-label": "Close modal", children: _jsx(X, { className: "h-6 w-6" }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "p-8 space-y-8 font-body", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [_jsx(User, { className: "h-5 w-5 text-gray-600" }), _jsx("span", { children: "Personal Information" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "First Name *" }), _jsx("input", { type: "text", value: values.firstName, onChange: (e) => setValue('firstName', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.firstName ? 'border-red-300' : 'border-gray-300'}`, disabled: loading }), errors.firstName && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.firstName }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Last Name *" }), _jsx("input", { type: "text", value: values.lastName, onChange: (e) => setValue('lastName', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.lastName ? 'border-red-300' : 'border-gray-300'}`, disabled: loading }), errors.lastName && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.lastName }))] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mt-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Email Address *" }), _jsx("input", { type: "email", value: values.email, onChange: (e) => setValue('email', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.email ? 'border-red-300' : 'border-gray-300'}`, disabled: loading }), errors.email && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.email }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Phone Number" }), _jsx("input", { type: "tel", value: values.phoneNumber, onChange: (e) => setValue('phoneNumber', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", disabled: loading })] })] })] }), _jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [_jsx(Building, { className: "h-5 w-5 text-gray-600" }), _jsx("span", { children: "Organization Information" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization *" }), _jsxs("select", { value: values.organization, onChange: (e) => setValue('organization', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.organization ? 'border-red-300' : 'border-gray-300'}`, disabled: loading, children: [_jsx("option", { value: "", children: "Select Organization" }), organizations.map(org => (_jsx("option", { value: org, children: org }, org)))] }), errors.organization && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.organization }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Department" }), _jsx("input", { type: "text", value: values.department, onChange: (e) => setValue('department', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", disabled: loading })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mt-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Role *" }), _jsxs("select", { value: values.role, onChange: (e) => setValue('role', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.role ? 'border-red-300' : 'border-gray-300'}`, disabled: loading, children: [_jsx("option", { value: "", children: "Select Role" }), roles.map(role => (_jsx("option", { value: role, children: role }, role)))] }), errors.role && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.role }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Cohort *" }), _jsxs("select", { value: values.cohort, onChange: (e) => setValue('cohort', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.cohort ? 'border-red-300' : 'border-gray-300'}`, disabled: loading, children: [_jsx("option", { value: "", children: "Select Cohort" }), cohorts.map(cohort => (_jsx("option", { value: cohort, children: cohort }, cohort)))] }), errors.cohort && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.cohort }))] })] })] }), _jsxs("div", { className: "flex items-center justify-end space-x-4 pt-6 border-t border-gray-200", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200", disabled: loading, children: "Cancel" }), _jsxs(LoadingButton, { type: "submit", loading: loading, variant: "primary", children: [_jsx(UserPlus, { className: "h-4 w-4" }), isEditMode ? 'Update User' : 'Add User'] })] })] })] })] })) }));
};
export default AddUserModal;
