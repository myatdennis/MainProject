import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, CheckCircle, AlertTriangle, Settings, Plus, Eye, EyeOff, RefreshCw, Database, Mail, CreditCard, Users, BarChart3, MessageSquare, Globe, Shield, Key } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const AdminIntegrations = () => {
  const { showToast } = useToast();
  const [showApiKeys, setShowApiKeys] = useState<{[key: string]: boolean}>({});
  const [activeTab, setActiveTab] = useState('overview');

  const integrations = [
    {
      id: 'mailchimp',
      name: 'Mailchimp',
      description: 'Email marketing and automation',
      category: 'Marketing',
      status: 'connected',
      icon: Mail,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      lastSync: '2025-03-11 10:30 AM',
      features: ['Email campaigns', 'Subscriber management', 'Automation workflows'],
      apiKey: 'mc_live_1234567890abcdef',
      webhookUrl: 'https://api.thehuddleco.com/webhooks/mailchimp'
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment processing and billing',
      category: 'Payments',
      status: 'connected',
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      lastSync: '2025-03-11 09:15 AM',
      features: ['Payment processing', 'Subscription billing', 'Invoice generation'],
      apiKey: 'sk_live_1234567890abcdef',
      webhookUrl: 'https://api.thehuddleco.com/webhooks/stripe'
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Video conferencing and webinars',
      category: 'Communication',
      status: 'connected',
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      lastSync: '2025-03-11 08:45 AM',
      features: ['Meeting scheduling', 'Webinar hosting', 'Recording management'],
      apiKey: 'zoom_jwt_1234567890abcdef',
      webhookUrl: 'https://api.thehuddleco.com/webhooks/zoom'
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Team communication and notifications',
      category: 'Communication',
      status: 'connected',
      icon: MessageSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      lastSync: '2025-03-11 11:00 AM',
      features: ['Notifications', 'Team updates', 'Progress alerts'],
      apiKey: 'xoxb-1234567890-abcdef',
      webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Customer relationship management',
      category: 'CRM',
      status: 'pending',
      icon: Database,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      lastSync: 'Never',
      features: ['Contact sync', 'Lead management', 'Opportunity tracking'],
      apiKey: '',
      webhookUrl: ''
    },
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Website and learning analytics',
      category: 'Analytics',
      status: 'connected',
      icon: BarChart3,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      lastSync: '2025-03-11 10:00 AM',
      features: ['User tracking', 'Engagement metrics', 'Conversion analysis'],
      apiKey: 'GA4-XXXXXXXXX-X',
      webhookUrl: 'https://api.thehuddleco.com/webhooks/google-analytics'
    },
    {
      id: 'microsoft-teams',
      name: 'Microsoft Teams',
      description: 'Enterprise communication platform',
      category: 'Communication',
      status: 'disconnected',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      lastSync: '2025-02-15 03:20 PM',
      features: ['Team meetings', 'File sharing', 'Collaboration'],
      apiKey: '',
      webhookUrl: ''
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Marketing and sales automation',
      category: 'CRM',
      status: 'error',
      icon: Database,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      lastSync: '2025-03-10 02:30 PM',
      features: ['Contact management', 'Email marketing', 'Sales pipeline'],
      apiKey: 'hub_live_1234567890abcdef',
      webhookUrl: 'https://api.thehuddleco.com/webhooks/hubspot'
    }
  ];

  const webhooks = [
    {
      id: '1',
      name: 'Course Completion Webhook',
      url: 'https://api.client-org.com/webhooks/completion',
      events: ['course.completed', 'certificate.issued'],
      status: 'active',
      lastTriggered: '2025-03-11 10:45 AM',
      successRate: 98.5
    },
    {
      id: '2',
      name: 'User Progress Webhook',
      url: 'https://api.university.edu/lms/progress',
      events: ['user.progress', 'module.started'],
      status: 'active',
      lastTriggered: '2025-03-11 09:30 AM',
      successRate: 99.2
    },
    {
      id: '3',
      name: 'Enrollment Webhook',
      url: 'https://api.nonprofit.org/training/enroll',
      events: ['user.enrolled', 'cohort.created'],
      status: 'error',
      lastTriggered: '2025-03-10 04:15 PM',
      successRate: 85.3
    }
  ];

  const apiEndpoints = [
    {
      method: 'GET',
      endpoint: '/api/v1/users',
      description: 'Retrieve user list with progress data',
      usage: '1,234 calls/month'
    },
    {
      method: 'POST',
      endpoint: '/api/v1/users/{id}/enroll',
      description: 'Enroll user in specific course',
      usage: '567 calls/month'
    },
    {
      method: 'GET',
      endpoint: '/api/v1/courses/{id}/progress',
      description: 'Get course completion statistics',
      usage: '890 calls/month'
    },
    {
      method: 'POST',
      endpoint: '/api/v1/certificates/issue',
      description: 'Issue certificate to user',
      usage: '234 calls/month'
    }
  ];

  const toggleApiKey = (integrationId: string) => {
    setShowApiKeys(prev => ({
      ...prev,
      [integrationId]: !prev[integrationId]
    }));
  };

  const navigate = useNavigate();

  const handleConfigure = (id: string) => {
    navigate(`/admin/integrations/${id}`);
  };

  const handleTest = (name: string) => {
    showToast(`Testing handshake with ${name}…`, 'info');
  };

  const handleRegenerate = (keyName: string) => {
    showToast(`${keyName} regenerated. Share the new secret with your team.`, 'success');
  };

  const handleAddWebhook = () => {
    showToast('Webhook creation coming soon. Contact support for early access.', 'info');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Globe },
    { id: 'webhooks', name: 'Webhooks', icon: Zap },
    { id: 'api', name: 'API Access', icon: Key },
    { id: 'sso', name: 'SSO & Auth', icon: Shield }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Integrations & API</h1>
        <p className="text-gray-600">Connect with third-party services and manage API access</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div>
              {/* Integration Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">6</div>
                  <div className="text-sm text-green-700">Connected</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">1</div>
                  <div className="text-sm text-yellow-700">Pending</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">1</div>
                  <div className="text-sm text-red-700">Error</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">1</div>
                  <div className="text-sm text-gray-700">Disconnected</div>
                </div>
              </div>

              {/* Integrations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations.map((integration) => {
                  const Icon = integration.icon;
                  return (
                    <div key={integration.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${integration.bgColor}`}>
                            <Icon className={`h-6 w-6 ${integration.color}`} />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{integration.name}</h3>
                            <p className="text-sm text-gray-600">{integration.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(integration.status)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(integration.status)}`}>
                            {integration.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-4">{integration.description}</p>

                      <div className="space-y-2 mb-4">
                        <div className="text-xs text-gray-500">Features:</div>
                        <div className="flex flex-wrap gap-1">
                          {integration.features.map((feature, index) => (
                            <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 mb-4">
                        Last sync: {integration.lastSync}
                      </div>

                      <div className="flex items-center justify-between">
                        <button onClick={() => handleConfigure(integration.id)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                          Configure
                        </button>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => handleTest(integration.name)} className="p-1 text-gray-400 hover:text-gray-600" title="Test">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleConfigure(integration.id)} className="p-1 text-gray-400 hover:text-gray-600" title="Settings">
                            <Settings className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div>
                <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Webhook Management</h2>
                <button onClick={handleAddWebhook} className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Webhook</span>
                </button>
              </div>

              <div className="space-y-4">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-gray-900 mb-1">{webhook.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{webhook.url}</p>
                        <div className="flex flex-wrap gap-2">
                          {webhook.events.map((event, index) => (
                            <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                              {event}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(webhook.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(webhook.status)}`}>
                          {webhook.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Last Triggered:</span>
                        <div className="font-medium text-gray-900">{webhook.lastTriggered}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Success Rate:</span>
                        <div className="font-medium text-gray-900">{webhook.successRate}%</div>
                      </div>
                        <div className="flex items-center space-x-2">
                        <button onClick={() => handleTest(webhook.name)} className="text-blue-600 hover:text-blue-700">Test</button>
                        <button onClick={() => alert('Edit webhook (demo)')} className="text-gray-600 hover:text-gray-700">Edit</button>
                        <button onClick={() => { if(confirm('Delete webhook?')) alert('Deleted (demo)'); }} className="text-red-600 hover:text-red-700">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">API Keys</h2>
                  <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">Production API Key</h3>
                        <button
                          onClick={() => toggleApiKey('production')}
                          className="text-sm text-orange-500 hover:text-orange-600 flex items-center space-x-1"
                        >
                          {showApiKeys['production'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          <span>{showApiKeys['production'] ? 'Hide' : 'Show'}</span>
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type={showApiKeys['production'] ? 'text' : 'password'}
                          value="hc_live_1234567890abcdef1234567890abcdef"
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                        />
                        <button onClick={() => handleRegenerate('production')} className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-1">
                          <RefreshCw className="h-4 w-4" />
                          <span>Regenerate</span>
                        </button>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">Test API Key</h3>
                        <button
                          onClick={() => toggleApiKey('test')}
                          className="text-sm text-orange-500 hover:text-orange-600 flex items-center space-x-1"
                        >
                          {showApiKeys['test'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          <span>{showApiKeys['test'] ? 'Hide' : 'Show'}</span>
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type={showApiKeys['test'] ? 'text' : 'password'}
                          value="hc_test_1234567890abcdef1234567890abcdef"
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                        />
                        <button onClick={() => handleRegenerate('test')} className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center space-x-1">
                          <RefreshCw className="h-4 w-4" />
                          <span>Regenerate</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">API Endpoints</h2>
                  <div className="space-y-3">
                    {apiEndpoints.map((endpoint, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            endpoint.method === 'GET' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {endpoint.method}
                          </span>
                          <code className="text-sm font-mono text-gray-900">{endpoint.endpoint}</code>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{endpoint.description}</p>
                        <div className="text-xs text-gray-500">{endpoint.usage}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sso' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Single Sign-On & Authentication</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">SSO Providers</h3>
                  <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="bg-blue-50 p-2 rounded-lg">
                            <Shield className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">SAML 2.0</h4>
                            <p className="text-sm text-gray-600">Enterprise SSO</p>
                          </div>
                        </div>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                          Active
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>Metadata URL: https://api.thehuddleco.com/saml/metadata</div>
                        <div>ACS URL: https://api.thehuddleco.com/saml/acs</div>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="bg-green-50 p-2 rounded-lg">
                            <Key className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">OAuth 2.0</h4>
                            <p className="text-sm text-gray-600">Modern authentication</p>
                          </div>
                        </div>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                          Active
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>Client ID: hc_oauth_1234567890</div>
                        <div>Redirect URI: https://app.thehuddleco.com/auth/callback</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Two-Factor Authentication</div>
                        <div className="text-sm text-gray-600">Require 2FA for admin accounts</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Session Timeout</div>
                        <div className="text-sm text-gray-600">Auto-logout after inactivity</div>
                      </div>
                      <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option>30 minutes</option>
                        <option>1 hour</option>
                        <option>2 hours</option>
                        <option>4 hours</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">IP Restrictions</div>
                        <div className="text-sm text-gray-600">Limit access by IP address</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminIntegrations;