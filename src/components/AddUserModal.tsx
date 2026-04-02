import React, { useEffect, useState } from 'react';
import AIUserAssistant from './AIUserAssistant';
import { X, User, Building, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';
import { useFormValidation, validators } from './FormComponents';
import SecurityUtils from '../utils/SecurityUtils';
import { listOrgs } from '../dal/orgs';
import apiRequest from '../utils/apiClient';
import { useSecureAuth } from '../context/SecureAuthContext';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded?: (user: any, transfer?: { fromOrganizationId?: string | null; toOrganizationId?: string | null }) => void;
  editUser?: any;
  /** Pass pre-fetched orgs from the parent page; the modal will also fetch its own if not provided. */
  organizations?: Array<{ id: string; name: string }>;
  /** Optional default org to preselect (e.g., current filter selection). */
  defaultOrgId?: string | null;
}

const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onUserAdded,
  editUser,
  organizations: orgsProp,
  defaultOrgId,
}) => {
  const { showToast } = useToast();
  const { activeOrgId } = useSecureAuth();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState<{
    setupLink?: string | null;
    emailSent?: boolean;
    userId?: string | null;
    email?: string | null;
  } | null>(null);
  const PASSWORD_MIN_LENGTH = 8;
  const isEditMode = !!editUser;
  const { values, errors, setValue, validateAll } = useFormValidation(
    {
      firstName: editUser?.name?.split(' ')[0] || '',
      lastName: editUser?.name?.split(' ').slice(1).join(' ') || '',
      email: editUser?.email || '',
      role: editUser?.role || '',
      organization: editUser?.organization || '',
      cohort: editUser?.cohort || '',
      membershipRole: editUser?.membershipRole || 'member',
      department: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    },
    {
      firstName: [validators.required, validators.minLength(2)],
      lastName: [validators.required, validators.minLength(2)],
      email: [validators.required, validators.email],
      role: [validators.required],
      membershipRole: [validators.required],
      organization: [validators.required],
      cohort: [validators.required],
      // Require password and confirmPassword for new users only
      password: isEditMode ? [] : [
        validators.required,
        (v: string) =>
          v.length >= PASSWORD_MIN_LENGTH ? null : `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      ],
      confirmPassword: isEditMode ? [] : [
        validators.required,
        (v: string): string | null =>
          v === values.password ? null : 'Passwords do not match',
      ],
    }
  );

  // Fetch real organizations from the API when no pre-fetched list is supplied
  const [fetchedOrgs, setFetchedOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // If parent already passed orgs, no need to fetch
    if (orgsProp && orgsProp.length > 0) return;
    let cancelled = false;
    setOrgsLoading(true);
    listOrgs()
      .then((orgs) => {
        if (cancelled) return;
        setFetchedOrgs(
          orgs.map((o) => ({ id: o.id, name: o.name ?? o.id }))
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[AddUserModal] Failed to load organizations', err);
      })
      .finally(() => {
        if (!cancelled) setOrgsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, orgsProp]);

  useEffect(() => {
    if (!isOpen) {
      setDeliveryInfo(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isEditMode) return;
    if (!values.organization) {
      const fallbackOrgId =
        defaultOrgId ||
        (orgsProp && orgsProp.length === 1 ? orgsProp[0].id : null) ||
        activeOrgId;
      if (fallbackOrgId) {
        setValue('organization', fallbackOrgId);
      }
    }
  }, [activeOrgId, defaultOrgId, isEditMode, isOpen, orgsProp, setValue, values.organization]);

  // Resolved org list: prefer prop, fall back to fetched
  const organizations = (orgsProp && orgsProp.length > 0) ? orgsProp : fetchedOrgs;

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

  const membershipRoles = [
    { label: 'Member', value: 'member' },
    { label: 'Editor', value: 'editor' },
    { label: 'Manager', value: 'manager' },
    { label: 'Admin', value: 'admin' },
    { label: 'Owner', value: 'owner' },
  ];

  // Framer Motion modal animation
  const modalVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
    exit: { opacity: 0, y: 40, transition: { duration: 0.18 } }
  };

  // AIUserAssistant dismiss logic
  const handleDismissSuggestion = (_id: string) => {};

  // Optionally, you could add auto-apply logic here

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
      membershipRole: SecurityUtils.sanitizeInput(values.membershipRole || 'member'),
      cohort: SecurityUtils.sanitizeInput(values.cohort),
      password: values.password,
      confirmPassword: values.confirmPassword,
    };

    if (!isEditMode) {
      // Password and confirmPassword are now required and validated above
    }

    // Log security event
    SecurityUtils.logSecurityEvent({
      type: 'login_attempt',
      details: { action: 'create_user', email: sanitizedData.email },
      severity: 'low'
    });

    setLoading(true);

  const shouldClose = true;
  try {
      if (isEditMode && editUser) {
        // Update the real user profile and membership state via PATCH
        const orgId = sanitizedData.organization;
        const response: any = await apiRequest(`/api/admin/users/${editUser.id}`, {
          method: 'PATCH',
          body: {
            orgId,
            organizationId: orgId,
            org_id: orgId,
            organization_id: orgId,
            firstName: sanitizedData.firstName,
            lastName: sanitizedData.lastName,
            email: sanitizedData.email,
            jobTitle: sanitizedData.role,
            department: sanitizedData.department,
            cohort: sanitizedData.cohort,
            phoneNumber: sanitizedData.phoneNumber,
          },
        });

        // Use normalized org from API response as canonical
        const normalizedOrg = response?.data?.organization_id || orgId;
        const updatedUser = {
          ...editUser,
          ...response?.data,
          name: `${sanitizedData.firstName} ${sanitizedData.lastName}`,
          email: sanitizedData.email,
          organization: normalizedOrg,
          cohort: sanitizedData.cohort,
          role: sanitizedData.role,
        };

        const transfer = {
          fromOrganizationId: editUser.organization || editUser.orgId || editUser.organization_id || null,
          toOrganizationId: normalizedOrg || null,
        };

        onUserAdded?.(updatedUser, transfer);
      } else {
        // Provision a real login-backed user account and activate membership immediately.
        const orgId = sanitizedData.organization || defaultOrgId || activeOrgId;
        if (!orgId) {
          showToast('Please select an organization', 'error');
          setLoading(false);
          return;
        }
        const response = await apiRequest<{
          data?: any;
          created?: boolean;
          existingAccount?: boolean;
          inviteOnly?: boolean;
          duplicateInvite?: boolean;
          message?: string;
          setupLink?: string;
          emailSent?: boolean;
        }>(`/api/admin/users`, {
          method: 'POST',
          body: {
            orgId,
            organizationId: orgId,
            firstName: sanitizedData.firstName,
            lastName: sanitizedData.lastName,
            email: sanitizedData.email,
            password: sanitizedData.password,
            membershipRole: sanitizedData.membershipRole,
            jobTitle: sanitizedData.role,
            department: sanitizedData.department,
            cohort: sanitizedData.cohort,
            phoneNumber: sanitizedData.phoneNumber,
          },
        });

        if (response?.inviteOnly) {
          showToast('Unable to create direct account. Invite-only fallback is disabled in this deployment.', 'error');
          setLoading(false);
          return;
        }

        const responseUserId = response?.data?.id ?? null;
        const latestDelivery = {
          setupLink: response?.setupLink ?? null,
          emailSent: response?.emailSent ?? false,
          userId: responseUserId,
          email: sanitizedData.email,
        };
        setDeliveryInfo(latestDelivery);

        const newUser = {
          id: response?.data?.id ?? `user-${Date.now()}`,
          name: `${sanitizedData.firstName} ${sanitizedData.lastName}`,
          email: sanitizedData.email,
          organization: response?.data?.organization_id ?? orgId,
          cohort: sanitizedData.cohort,
          role: sanitizedData.role,
          department: sanitizedData.department,
          phoneNumber: sanitizedData.phoneNumber,
          enrolled: new Date().toISOString(),
          lastLogin: '',
          status: 'active' as const,
          progress: { foundations: 0, bias: 0, empathy: 0, conversations: 0, planning: 0 },
          overallProgress: 0,
          completedModules: 0,
          totalModules: 5,
          feedbackSubmitted: false,
        };
        onUserAdded?.(newUser);
      }
    } catch (error: any) {
      showToast(
        error?.message ??
          (isEditMode ? 'Failed to update user. Please try again.' : 'Failed to add user. Please try again.'),
        'error',
      );
    } finally {
      setLoading(false);
      if (shouldClose) onClose();
    }
  };

  const handleCopyLink = async () => {
    if (!deliveryInfo?.setupLink) return;
    try {
      await navigator.clipboard.writeText(deliveryInfo.setupLink);
      showToast('Setup link copied to clipboard', 'success');
    } catch (err) {
      console.warn('[AddUserModal] Failed to copy setup link', err);
      showToast('Unable to copy link. Please copy it manually.', 'error');
    }
  };

  const handleOpenLink = () => {
    if (!deliveryInfo?.setupLink) return;
    window.open(deliveryInfo.setupLink, '_blank', 'noopener');
  };

  const handleResendEmail = async () => {
    if (!deliveryInfo?.userId) {
      showToast('User id missing for resend.', 'error');
      return;
    }
    setResendLoading(true);
    try {
      const resendResponse = await apiRequest<{
        success?: boolean;
        setupLink?: string;
        emailSent?: boolean;
        error?: string | null;
      }>(`/api/admin/users/${deliveryInfo.userId}/resend-email`, {
        method: 'POST',
      });

      setDeliveryInfo((prev) => ({
        ...prev,
        setupLink: resendResponse?.setupLink ?? prev?.setupLink,
        emailSent: resendResponse?.emailSent ?? prev?.emailSent,
      }));

      if (resendResponse?.emailSent) {
        showToast('Email sent successfully!', 'success');
      } else {
        showToast('Unable to send email. Use the setup link below.', 'warning');
      }
    } catch (err) {
      console.warn('[AddUserModal] Resend email failed', err);
      showToast('Failed to resend email.', 'error');
    } finally {
      setResendLoading(false);
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
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
            aria-label="Close modal background"
          />
          <motion.div
            id="add-user-modal"
            className="relative bg-white rounded-2xl shadow-2xl border border-cloud max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto focus:outline-none z-50"
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
            <div className="flex items-center justify-between p-6 border-b border-cloud">
              <div className="flex items-center space-x-3">
                <div className="bg-sunrise/10 p-2.5 rounded-xl">
                  <UserPlus className="h-6 w-6 text-sunrise" />
                </div>
                <div>
                  <h2 id="add-user-modal-title" className="text-xl font-heading font-semibold text-charcoal">
                    {isEditMode ? 'Edit User' : 'Add New User'}
                  </h2>
                  <p className="text-sm text-slate/70 font-body">
                    {isEditMode ? 'Update user information and settings' : 'Create a new user account, add them to this organization, and assign all published courses and surveys'}
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
            {/* AI User Assistant Suggestions */}
            <AIUserAssistant
              values={values}
              errors={errors}
              onApplySuggestion={() => {}}
              onDismissSuggestion={handleDismissSuggestion}
            />
            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6 font-body">
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
                {!isEditMode && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={values.password}
                        onChange={(e) => setValue('password', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.password ? 'border-red-300' : 'border-gray-300'}`}
                        disabled={loading}
                        autoComplete="new-password"
                      />
                      {errors.password && (
                        <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        value={values.confirmPassword}
                        onChange={(e) => setValue('confirmPassword', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'}`}
                        disabled={loading}
                        autoComplete="new-password"
                      />
                      {errors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>
                )}
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
                      disabled={loading || orgsLoading}
                    >
                      <option value="">
                        {orgsLoading ? 'Loading organizations…' : 'Select Organization'}
                      </option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>{org.name}</option>
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
                      Membership Role *
                    </label>
                    <select
                      value={values.membershipRole}
                      onChange={(e) => setValue('membershipRole', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.membershipRole ? 'border-red-300' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    >
                      <option value="">Select membership role</option>
                      {membershipRoles.map((roleOption) => (
                        <option key={roleOption.value} value={roleOption.value}>
                          {roleOption.label}
                        </option>
                      ))}
                    </select>
                    {errors.membershipRole && (
                      <p className="mt-1 text-sm text-red-600">{errors.membershipRole}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
              {deliveryInfo?.setupLink && !deliveryInfo?.emailSent && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold mb-2">Email not sent — share the setup link</p>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      readOnly
                      value={deliveryInfo.setupLink}
                      className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold"
                      >
                        Copy Link
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenLink}
                        className="px-3 py-2 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-semibold"
                      >
                        Open Link
                      </button>
                      <button
                        type="button"
                        onClick={handleResendEmail}
                        disabled={resendLoading}
                        className="px-3 py-2 rounded-lg bg-amber-100 text-amber-900 text-xs font-semibold"
                      >
                        {resendLoading ? 'Resending…' : 'Resend Email'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {deliveryInfo?.setupLink && deliveryInfo?.emailSent && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">Email sent successfully.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleResendEmail}
                      disabled={resendLoading}
                      className="px-3 py-2 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-semibold"
                    >
                      {resendLoading ? 'Resending…' : 'Resend Email'}
                    </button>
                  </div>
                </div>
              )}
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
