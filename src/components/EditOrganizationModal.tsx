import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Users, 
  Calendar,
  DollarSign,
  Settings,
  Shield,
  CreditCard,
  Activity,
  Save,
  AlertTriangle
} from 'lucide-react';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';

interface EditOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization?: any;
  onOrganizationUpdated?: (organization: any) => void;
}

interface OrganizationFormData {
  // Basic Information
  name: string;
  type: string;
  description?: string;
  logo?: string;
  
  // Contact Information
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  
  // Address Information
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  
  // Subscription & Billing
  subscription: string;
  billingEmail?: string;
  billingCycle: 'monthly' | 'quarterly' | 'annually';
  customPricing?: number;
  
  // Capacity & Limits
  maxLearners?: number;
  maxCourses?: number;
  maxStorage?: number; // in GB
  
  // Features & Permissions
  features: {
    analytics: boolean;
    certificates: boolean;
    apiAccess: boolean;
    customBranding: boolean;
    sso: boolean;
    mobileApp: boolean;
    reporting: boolean;
    integrations: boolean;
  };
  
  // Settings
  settings: {
    autoEnrollment: boolean;
    emailNotifications: boolean;
    progressTracking: boolean;
    allowDownloads: boolean;
    requireCompletion: boolean;
    dataRetention: number; // in months
  };
  
  // Status & Metadata
  status: 'active' | 'inactive' | 'suspended' | 'trial';
  contractStart?: string;
  contractEnd?: string;
  notes?: string;
  tags: string[];
}

const EditOrganizationModal: React.FC<EditOrganizationModalProps> = ({ 
  isOpen, 
  onClose, 
  organization, 
  onOrganizationUpdated 
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'subscription' | 'features' | 'settings'>('basic');
  
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: '',
    type: '',
    description: '',
    logo: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    subscription: 'Standard',
    billingEmail: '',
    billingCycle: 'monthly',
    customPricing: 0,
    maxLearners: 100,
    maxCourses: 50,
    maxStorage: 10,
    features: {
      analytics: true,
      certificates: true,
      apiAccess: false,
      customBranding: false,
      sso: false,
      mobileApp: true,
      reporting: true,
      integrations: false,
    },
    settings: {
      autoEnrollment: false,
      emailNotifications: true,
      progressTracking: true,
      allowDownloads: true,
      requireCompletion: false,
      dataRetention: 24,
    },
    status: 'active',
    contractStart: '',
    contractEnd: '',
    notes: '',
    tags: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load organization data when modal opens
  useEffect(() => {
    if (isOpen && organization) {
      setFormData({
        name: organization.name || '',
        type: organization.type || '',
        description: organization.description || '',
        logo: organization.logo || '',
        contactPerson: organization.contactPerson || '',
        contactEmail: organization.contactEmail || '',
        contactPhone: organization.contactPhone || '',
        website: organization.website || '',
        address: organization.address || '',
        city: organization.city || '',
        state: organization.state || '',
        country: organization.country || 'United States',
        postalCode: organization.postalCode || '',
        subscription: organization.subscription || 'Standard',
        billingEmail: organization.billingEmail || organization.contactEmail || '',
        billingCycle: organization.billingCycle || 'monthly',
        customPricing: organization.customPricing || 0,
        maxLearners: organization.maxLearners || 100,
        maxCourses: organization.maxCourses || 50,
        maxStorage: organization.maxStorage || 10,
        features: {
          analytics: organization.features?.analytics ?? true,
          certificates: organization.features?.certificates ?? true,
          apiAccess: organization.features?.apiAccess ?? false,
          customBranding: organization.features?.customBranding ?? false,
          sso: organization.features?.sso ?? false,
          mobileApp: organization.features?.mobileApp ?? true,
          reporting: organization.features?.reporting ?? true,
          integrations: organization.features?.integrations ?? false,
        },
        settings: {
          autoEnrollment: organization.settings?.autoEnrollment ?? false,
          emailNotifications: organization.settings?.emailNotifications ?? true,
          progressTracking: organization.settings?.progressTracking ?? true,
          allowDownloads: organization.settings?.allowDownloads ?? true,
          requireCompletion: organization.settings?.requireCompletion ?? false,
          dataRetention: organization.settings?.dataRetention ?? 24,
        },
        status: organization.status || 'active',
        contractStart: organization.contractStart || '',
        contractEnd: organization.contractEnd || '',
        notes: organization.notes || '',
        tags: organization.tags || [],
      });
    }
  }, [isOpen, organization]);

  if (!isOpen) return null;

  const organizationTypes = [
    'Educational Institution',
    'Healthcare Organization',
    'Technology Company',
    'Government Agency',
    'Non-Profit Organization',
    'Financial Services',
    'Manufacturing',
    'Consulting Firm',
    'Retail & E-commerce',
    'Media & Entertainment',
    'Transportation',
    'Real Estate',
    'Other'
  ];

  const subscriptionTypes = [
    { value: 'Trial', label: 'Trial (14 days)', price: 0 },
    { value: 'Standard', label: 'Standard', price: 299 },
    { value: 'Premium', label: 'Premium', price: 599 },
    { value: 'Enterprise', label: 'Enterprise', price: 1299 },
    { value: 'Custom', label: 'Custom Pricing', price: 0 }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active', color: 'text-green-700 bg-green-100' },
    { value: 'trial', label: 'Trial', color: 'text-blue-700 bg-blue-100' },
    { value: 'inactive', label: 'Inactive', color: 'text-yellow-700 bg-yellow-100' },
    { value: 'suspended', label: 'Suspended', color: 'text-red-700 bg-red-100' },
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Organization name is required';
    }

    if (!formData.type) {
      newErrors.type = 'Organization type is required';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Contact email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Contact email is invalid';
    }

    if (formData.billingEmail && !/\S+@\S+\.\S+/.test(formData.billingEmail)) {
      newErrors.billingEmail = 'Billing email is invalid';
    }

    if (formData.maxLearners && formData.maxLearners < 1) {
      newErrors.maxLearners = 'Max learners must be at least 1';
    }

    if (formData.contractStart && formData.contractEnd) {
      if (new Date(formData.contractStart) >= new Date(formData.contractEnd)) {
        newErrors.contractEnd = 'Contract end date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Please fix the errors before saving', 'error');
      return;
    }

    setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const updatedOrganization = {
        ...organization,
        ...formData,
        id: organization?.id || Date.now().toString(),
        updatedAt: new Date().toISOString(),
        totalLearners: organization?.totalLearners || 0,
        activeLearners: organization?.activeLearners || 0,
        completionRate: organization?.completionRate || 0,
      };

      if (onOrganizationUpdated) {
        onOrganizationUpdated(updatedOrganization);
      }

      showToast('Organization updated successfully!', 'success');
      onClose();
    } catch (error) {
      showToast('Failed to update organization', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...(prev as any)[parent],
            [child]: value
          }
        };
      }
      return { ...prev, [field]: value };
    });

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Building2 },
    { id: 'contact', label: 'Contact & Address', icon: User },
    { id: 'subscription', label: 'Subscription & Billing', icon: CreditCard },
    { id: 'features', label: 'Features & Access', icon: Shield },
    { id: 'settings', label: 'Settings & Preferences', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {organization ? 'Edit Organization' : 'Add Organization'}
              </h2>
              <p className="text-sm text-gray-600">
                {organization ? `Manage ${organization.name || 'organization'} settings` : 'Create a new organization'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter organization name"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.type ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select type</option>
                      {organizationTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    {errors.type && (
                      <p className="mt-1 text-sm text-red-600">{errors.type}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description of the organization"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Logo URL
                    </label>
                    <input
                      type="url"
                      value={formData.logo}
                      onChange={(e) => handleInputChange('logo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={formData.tags.join(', ')}
                    onChange={(e) => handleInputChange('tags', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="VIP, Enterprise, Priority (comma-separated)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Internal Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Internal notes for this organization"
                  />
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="inline h-4 w-4 mr-1" />
                      Primary Contact *
                    </label>
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Mail className="inline h-4 w-4 mr-1" />
                      Contact Email *
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.contactEmail ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="contact@example.com"
                    />
                    {errors.contactEmail && (
                      <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Phone className="inline h-4 w-4 mr-1" />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Globe className="inline h-4 w-4 mr-1" />
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Street address"
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State/Province
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="State"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => handleInputChange('postalCode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="12345"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Australia">Australia</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'subscription' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <CreditCard className="inline h-4 w-4 mr-1" />
                      Subscription Plan
                    </label>
                    <select
                      value={formData.subscription}
                      onChange={(e) => handleInputChange('subscription', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {subscriptionTypes.map((plan) => (
                        <option key={plan.value} value={plan.value}>
                          {plan.label} {plan.price > 0 && `- $${plan.price}/month`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Billing Cycle
                    </label>
                    <select
                      value={formData.billingCycle}
                      onChange={(e) => handleInputChange('billingCycle', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>
                </div>

                {formData.subscription === 'Custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <DollarSign className="inline h-4 w-4 mr-1" />
                      Custom Monthly Price
                    </label>
                    <input
                      type="number"
                      value={formData.customPricing}
                      onChange={(e) => handleInputChange('customPricing', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={formData.billingEmail}
                    onChange={(e) => handleInputChange('billingEmail', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.billingEmail ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="billing@example.com"
                  />
                  {errors.billingEmail && (
                    <p className="mt-1 text-sm text-red-600">{errors.billingEmail}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Users className="inline h-4 w-4 mr-1" />
                      Max Learners
                    </label>
                    <input
                      type="number"
                      value={formData.maxLearners}
                      onChange={(e) => handleInputChange('maxLearners', parseInt(e.target.value))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.maxLearners ? 'border-red-300' : 'border-gray-300'
                      }`}
                      min="1"
                    />
                    {errors.maxLearners && (
                      <p className="mt-1 text-sm text-red-600">{errors.maxLearners}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Courses
                    </label>
                    <input
                      type="number"
                      value={formData.maxCourses}
                      onChange={(e) => handleInputChange('maxCourses', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Storage (GB)
                    </label>
                    <input
                      type="number"
                      value={formData.maxStorage}
                      onChange={(e) => handleInputChange('maxStorage', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="inline h-4 w-4 mr-1" />
                      Contract Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.contractStart}
                      onChange={(e) => handleInputChange('contractStart', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contract End Date
                    </label>
                    <input
                      type="date"
                      value={formData.contractEnd}
                      onChange={(e) => handleInputChange('contractEnd', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.contractEnd ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.contractEnd && (
                      <p className="mt-1 text-sm text-red-600">{errors.contractEnd}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'features' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Available Features</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(formData.features).map(([key, value]) => (
                      <label key={key} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => handleInputChange(`features.${key}`, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-medium text-gray-900 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <div className="text-sm text-gray-600">
                            {key === 'analytics' && 'Advanced analytics and reporting'}
                            {key === 'certificates' && 'Digital certificates and badges'}
                            {key === 'apiAccess' && 'REST API access for integrations'}
                            {key === 'customBranding' && 'Custom branding and white-label'}
                            {key === 'sso' && 'Single Sign-On (SSO) integration'}
                            {key === 'mobileApp' && 'Mobile app access'}
                            {key === 'reporting' && 'Advanced reporting tools'}
                            {key === 'integrations' && 'Third-party integrations'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {!formData.features.analytics && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-yellow-800">Limited Analytics</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          Without analytics enabled, this organization will have limited reporting capabilities.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Organization Settings</h4>
                  <div className="space-y-4">
                    {Object.entries(formData.settings).map(([key, value]) => {
                      if (key === 'dataRetention') {
                        return (
                          <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900">Data Retention Period</div>
                              <div className="text-sm text-gray-600">
                                How long to keep user data after account deletion
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={value as number}
                                onChange={(e) => handleInputChange(`settings.${key}`, parseInt(e.target.value))}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                min="1"
                                max="120"
                              />
                              <span className="text-sm text-gray-600">months</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <label key={key} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div>
                            <div className="font-medium text-gray-900 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                            <div className="text-sm text-gray-600">
                              {key === 'autoEnrollment' && 'Automatically enroll new users in default courses'}
                              {key === 'emailNotifications' && 'Send email notifications to users'}
                              {key === 'progressTracking' && 'Track and report user progress'}
                              {key === 'allowDownloads' && 'Allow users to download course materials'}
                              {key === 'requireCompletion' && 'Require course completion for certificates'}
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={value as boolean}
                            onChange={(e) => handleInputChange(`settings.${key}`, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Activity className="h-4 w-4" />
              <span>Last updated: {new Date().toLocaleString()}</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <LoadingButton
                type="submit"
                loading={loading}
                variant="primary"
              >
                <Save className="h-4 w-4" />
                {organization ? 'Update Organization' : 'Create Organization'}
              </LoadingButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditOrganizationModal;