import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HelpCircle, 
  Search, 
  Book, 
  MessageCircle, 
  Mail,
  Phone,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Clock
} from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import { useToast } from '../../context/ToastContext';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  helpful: number;
}

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: number;
  lastUpdated: string;
  url: string;
}

interface SupportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  action: string;
  available: boolean;
  responseTime?: string;
}

const LMSHelp: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'faq' | 'guides' | 'contact'>('faq');

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'courses', label: 'Courses & Learning' },
    { id: 'progress', label: 'Progress & Certificates' },
    { id: 'technical', label: 'Technical Issues' },
    { id: 'account', label: 'Account & Settings' }
  ];

  const faqs: FAQItem[] = [
    {
      id: 'faq_001',
      question: 'How do I access my courses?',
      answer: 'You can access your courses by clicking on the "Courses" tab in the main navigation menu. From there, you\'ll see all your enrolled courses with progress indicators.',
      category: 'getting-started',
      helpful: 45
    },
    {
      id: 'faq_002',
      question: 'How do I track my learning progress?',
      answer: 'Visit the Progress page from the main menu to view detailed analytics of your learning journey, including completion rates, time spent, and achievement milestones.',
      category: 'progress',
      helpful: 38
    },
    {
      id: 'faq_003',
      question: 'Can I download my certificates?',
      answer: 'Yes! Once you complete a course, you can download your certificate from the Certificates page. Click the download button next to any earned certificate.',
      category: 'progress',
      helpful: 52
    },
    {
      id: 'faq_004',
      question: 'What if a video won\'t play?',
      answer: 'If you\'re experiencing video playback issues, try refreshing the page, clearing your browser cache, or switching to a different browser. Ensure you have a stable internet connection.',
      category: 'technical',
      helpful: 29
    },
    {
      id: 'faq_005',
      question: 'How do I change my notification settings?',
      answer: 'Go to Settings from the main menu, then select the Notifications tab. You can customize email notifications, course reminders, and progress updates.',
      category: 'account',
      helpful: 33
    },
    {
      id: 'faq_006',
      question: 'Can I retake a course?',
      answer: 'Yes, you can retake any course you\'ve previously completed. Simply navigate to the course and click "Restart Course" to begin again.',
      category: 'courses',
      helpful: 41
    }
  ];

  const helpArticles: HelpArticle[] = [
    {
      id: 'guide_001',
      title: 'Getting Started with Your Learning Journey',
      description: 'A comprehensive guide to navigating the platform and maximizing your learning experience.',
      category: 'getting-started',
      readTime: 5,
      lastUpdated: '2024-01-20',
      url: '/help/getting-started'
    },
    {
      id: 'guide_002',
      title: 'Understanding Course Structure',
      description: 'Learn about modules, lessons, quizzes, and how courses are organized.',
      category: 'courses',
      readTime: 7,
      lastUpdated: '2024-01-18',
      url: '/help/course-structure'
    },
    {
      id: 'guide_003',
      title: 'Troubleshooting Common Issues',
      description: 'Solutions to the most frequently encountered technical problems.',
      category: 'technical',
      readTime: 10,
      lastUpdated: '2024-01-22',
      url: '/help/troubleshooting'
    },
    {
      id: 'guide_004',
      title: 'Maximizing Your Progress Tracking',
      description: 'Tips for setting learning goals and using the progress analytics features.',
      category: 'progress',
      readTime: 6,
      lastUpdated: '2024-01-19',
      url: '/help/progress-tracking'
    }
  ];

  const supportOptions: SupportOption[] = [
    {
      id: 'chat',
      title: 'Live Chat Support',
      description: 'Get instant help from our support team',
      icon: MessageCircle,
      action: 'start-chat',
      available: true,
      responseTime: 'Usually responds in minutes'
    },
    {
      id: 'email',
      title: 'Email Support',
      description: 'Send us a detailed message about your issue',
      icon: Mail,
      action: 'send-email',
      available: true,
      responseTime: 'Response within 24 hours'
    },
    {
      id: 'phone',
      title: 'Phone Support',
      description: 'Speak directly with a support representative',
      icon: Phone,
      action: 'schedule-call',
      available: false,
      responseTime: 'Available Mon-Fri, 9 AM - 5 PM EST'
    }
  ];

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredArticles = helpArticles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleFAQ = (faqId: string) => {
    setExpandedFAQ(expandedFAQ === faqId ? null : faqId);
  };

  const handleSupportAction = (action: string) => {
    switch (action) {
      case 'start-chat':
        showToast('Connecting to live chat...', 'info');
        // Implement chat widget opening
        break;
      case 'send-email':
        window.location.href = 'mailto:support@inclusiveexcellence.com?subject=Learning Platform Support';
        break;
      case 'schedule-call':
        showToast('Phone support is currently unavailable', 'info');
        break;
      default:
        break;
    }
  };

  const markHelpful = (_faqId: string) => {
    showToast('Thank you for your feedback!', 'success');
    // In a real app, you'd update the helpful count in the backend
  };

  return (
    <>
      <SEO 
        title="Help Center - Learning Platform"
        description="Find answers to common questions and get support for your learning journey"
        keywords={['help', 'support', 'faq', 'guides', 'contact']}
      />
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate('/lms/dashboard')}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Dashboard
                </button>
                <div className="flex items-center space-x-3">
                  <HelpCircle className="h-6 w-6 text-orange-500" />
                  <h1 className="text-xl font-bold text-gray-900">Help Center</h1>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">How can we help you?</h2>
            <p className="text-gray-600 mb-6">Search for answers or browse our help categories below</p>
            
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for help articles, FAQs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
                />
              </div>
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { key: 'faq', label: 'Frequently Asked Questions', icon: HelpCircle },
                  { key: 'guides', label: 'Help Articles & Guides', icon: Book },
                  { key: 'contact', label: 'Contact Support', icon: MessageCircle }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.key
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-6">
              {/* FAQ Tab */}
              {activeTab === 'faq' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {filteredFAQs.length} question{filteredFAQs.length !== 1 ? 's' : ''} found
                  </h3>
                  
                  {filteredFAQs.length === 0 ? (
                    <div className="text-center py-8">
                      <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">No FAQs found matching your search.</p>
                    </div>
                  ) : (
                    filteredFAQs.map(faq => (
                      <div key={faq.id} className="border border-gray-200 rounded-lg">
                        <button
                          onClick={() => toggleFAQ(faq.id)}
                          className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">{faq.question}</span>
                          {expandedFAQ === faq.id ? (
                            <ChevronDown className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-500" />
                          )}
                        </button>
                        
                        {expandedFAQ === faq.id && (
                          <div className="px-6 pb-4 border-t border-gray-200 bg-gray-50">
                            <p className="text-gray-700 mt-4 leading-relaxed">{faq.answer}</p>
                            <div className="mt-4 flex items-center justify-between">
                              <button
                                onClick={() => markHelpful(faq.id)}
                                className="text-sm text-orange-600 hover:text-orange-700"
                              >
                                Was this helpful? ({faq.helpful} people found this helpful)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Help Articles Tab */}
              {activeTab === 'guides' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {filteredArticles.length} guide{filteredArticles.length !== 1 ? 's' : ''} available
                  </h3>
                  
                  {filteredArticles.length === 0 ? (
                    <div className="text-center py-8">
                      <Book className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">No guides found matching your search.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredArticles.map(article => (
                        <div key={article.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-medium text-gray-900 line-clamp-2">{article.title}</h4>
                            <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                          </div>
                          
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{article.description}</p>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {article.readTime} min read
                            </div>
                            <span>Updated {new Date(article.lastUpdated).toLocaleDateString()}</span>
                          </div>
                          
                          <button
                            onClick={() => window.open(article.url, '_blank')}
                            className="mt-4 w-full text-center py-2 px-4 text-sm font-medium text-orange-600 border border-orange-600 rounded-lg hover:bg-orange-50"
                          >
                            Read Guide
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Contact Support Tab */}
              {activeTab === 'contact' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Still need help?</h3>
                    <p className="text-gray-600">Our support team is here to assist you with any questions or issues.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {supportOptions.map(option => {
                      const Icon = option.icon;
                      return (
                        <div key={option.id} className="border border-gray-200 rounded-lg p-6 text-center">
                          <Icon className="h-8 w-8 text-orange-500 mx-auto mb-4" />
                          <h4 className="font-medium text-gray-900 mb-2">{option.title}</h4>
                          <p className="text-gray-600 text-sm mb-4">{option.description}</p>
                          {option.responseTime && (
                            <p className="text-xs text-gray-500 mb-4">{option.responseTime}</p>
                          )}
                          <button
                            onClick={() => handleSupportAction(option.action)}
                            disabled={!option.available}
                            className={`w-full py-2 px-4 text-sm font-medium rounded-lg ${
                              option.available
                                ? 'text-white bg-orange-600 hover:bg-orange-700'
                                : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                            }`}
                          >
                            {option.available ? 'Get Help' : 'Currently Unavailable'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Quick Links */}
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="font-medium text-gray-900 mb-4">Quick Links</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <a href="/help/system-requirements" className="text-sm text-orange-600 hover:text-orange-700">
                        System Requirements
                      </a>
                      <a href="/help/accessibility" className="text-sm text-orange-600 hover:text-orange-700">
                        Accessibility Features
                      </a>
                      <a href="/help/privacy" className="text-sm text-orange-600 hover:text-orange-700">
                        Privacy Policy
                      </a>
                      <a href="/help/terms" className="text-sm text-orange-600 hover:text-orange-700">
                        Terms of Service
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LMSHelp;