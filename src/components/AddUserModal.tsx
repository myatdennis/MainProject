import React, { useEffect, useState } from 'react';
import { X, User, Building, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';
import { useFormValidation, validators } from './FormComponents';
import SecurityUtils from '../utils/SecurityUtils';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded?: (user: any) => void;
  editUser?: any;
}

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onUserAdded, editUser }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!editUser;
  const { values, errors, setValue, validateAll } = useFormValidation(
    {
      firstName: editUser?.name?.split(' ')[0] || '',
      lastName: editUser?.name?.split(' ').slice(1).join(' ') || '',
      email: editUser?.email || '',
      role: editUser?.role || '',
      organization: editUser?.organization || '',
      cohort: editUser?.cohort || '',
      department: '',
      phoneNumber: '',
    },
    {
      firstName: [validators.required, validators.minLength(2)],
      lastName: [validators.required, validators.minLength(2)],
      email: [validators.required, validators.email],
      role: [validators.required],
      organization: [validators.required],
      cohort: [validators.required],
    }
  );

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

  const handleSubmit = async (e: React.FormEvent) => {
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
      } else {
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
    } catch (error) {
      showToast(isEditMode ? 'Failed to update user. Please try again.' : 'Failed to add user. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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

  return (

    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="add-user-modal-title">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-br from-charcoal/60 via-indigo-900/40 to-sunrise/40 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close modal background"
          />
          <motion.div
            id="add-user-modal"
            className="bg-ivory rounded-3xl shadow-2xl border border-mutedgrey max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto focus:outline-none"
            tabIndex={-1}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                // Keep focus within modal
                const focusableElements = e.currentTarget.querySelectorAll(
                  'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0] as HTMLElement;
                const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
                if (e.shiftKey && document.activeElement === firstElement) {
                  e.preventDefault();
                  lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                  e.preventDefault();
                  firstElement.focus();
                }
              }
            }}
            aria-label={isEditMode ? 'Edit User Modal' : 'Add User Modal'}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-8 border-b border-mutedgrey bg-gradient-to-r from-sunrise/10 to-indigo-100 rounded-t-3xl">
              <div className="flex items-center space-x-3">
                <div className="bg-sunrise/20 p-3 rounded-xl">
                  <UserPlus className="h-7 w-7 text-sunrise" />
                </div>
                <div>
                  <h2 id="add-user-modal-title" className="text-2xl font-heading text-charcoal">
                    {isEditMode ? 'Edit User' : 'Add New User'}
                  </h2>
                  <p className="text-sm text-gray-600 font-body">
                    {isEditMode ? 'Update user information and settings' : 'Create a new user account and assign to courses'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-charcoal rounded-full focus:outline-none focus:ring-2 focus:ring-sunrise"
                disabled={loading}
                aria-label="Close modal"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            {/* Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-8 font-body">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <User className="h-5 w-5 text-gray-600" />
                  <span>Personal Information</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={values.firstName}
                      onChange={(e) => setValue('firstName', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.firstName ? 'border-red-300' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={values.lastName}
                      onChange={(e) => setValue('lastName', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.lastName ? 'border-red-300' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={values.email}
                      onChange={(e) => setValue('email', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={values.phoneNumber}
                      onChange={(e) => setValue('phoneNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
              {/* Organization Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Building className="h-5 w-5 text-gray-600" />
                  <span>Organization Information</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization *
                    </label>
                    <select
                      value={values.organization}
                      onChange={(e) => setValue('organization', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.organization ? 'border-red-300' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    >
                      <option value="">Select Organization</option>
                      {organizations.map(org => (
                        <option key={org} value={org}>{org}</option>
                      ))}
                    </select>
                    {errors.organization && (
                      <p className="mt-1 text-sm text-red-600">{errors.organization}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <input
                      type="text"
                      value={values.department}
                      onChange={(e) => setValue('department', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role *
                    </label>
                    <select
                      value={values.role}
                      onChange={(e) => setValue('role', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.role ? 'border-red-300' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    >
                      <option value="">Select Role</option>
                      {roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    {errors.role && (
                      <p className="mt-1 text-sm text-red-600">{errors.role}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cohort *
                    </label>
                    <select
                      value={values.cohort}
                      onChange={(e) => setValue('cohort', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.cohort ? 'border-red-300' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    >
                      <option value="">Select Cohort</option>
                      {cohorts.map(cohort => (
                        <option key={cohort} value={cohort}>{cohort}</option>
                      ))}
                    </select>
                    {errors.cohort && (
                      <p className="mt-1 text-sm text-red-600">{errors.cohort}</p>
                    )}
                  </div>
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                  disabled={loading}
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={loading}
                  variant="primary"
                >
                  <UserPlus className="h-4 w-4" />
                  {isEditMode ? 'Update User' : 'Add User'}
                </LoadingButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default AddUserModal;
