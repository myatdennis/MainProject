import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User,
  Minimize2,
  Maximize2,
  RotateCcw,
  Lightbulb
} from 'lucide-react';
import { getAnalytics } from '../../dal/surveys';

const AIBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{
    id: string;
    type: 'user' | 'bot';
    content: string;
    timestamp: Date;
    suggestions?: string[];
  }>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [showTips, setShowTips] = useState(false);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isLMSRoute = location.pathname.startsWith('/lms');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Initial greeting based on route
      const greeting = getInitialGreeting();
      setMessages([{
        id: '1',
        type: 'bot',
        content: greeting.message,
        timestamp: new Date(),
        suggestions: greeting.suggestions
      }]);
    }
  }, [isOpen, isAdminRoute, isLMSRoute]);

  // cap messages to last 50 to avoid memory growth
  useEffect(() => {
    if (messages.length > 50) {
      setMessages(prev => prev.slice(prev.length - 50));
    }
  }, [messages]);

  const getInitialGreeting = () => {
    if (isAdminRoute) {
      return {
        message: "Hi Mya! I'm your AI assistant for The Huddle Co. admin portal. I can help you with analytics, user management, course insights, and more. What would you like to know?",
        suggestions: [
          "Show me users at risk of dropping out",
          "What's our completion rate this month?",
          "Which modules need improvement?",
          "Generate a progress report"
        ]
      };
    } else if (isLMSRoute) {
      return {
        message: "Hello! I'm here to help with your learning journey. I can answer questions about course content, provide study tips, remind you of deadlines, and suggest next steps. How can I assist you today?",
        suggestions: [
          "What should I focus on next?",
          "Explain inclusive leadership principles",
          "How do I handle difficult conversations?",
          "Show my progress summary"
        ]
      };
    } else {
      return {
        message: "Welcome to The Huddle Co.! I'm here to help you learn about our DEI consulting services, training programs, and how we can support your organization. What would you like to know?",
        suggestions: [
          "Tell me about your services",
          "How does the training work?",
          "What results do clients see?",
          "Schedule a discovery call"
        ]
      };
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const botResponse = generateBotResponse(message);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: botResponse.message,
        timestamp: new Date(),
        suggestions: botResponse.suggestions
      }]);
      setIsTyping(false);
    }, 1500);
  };

  const generateBotResponse = (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();

    if (isAdminRoute) {
      // If user requested survey-specific analytics, fetch structured analytics via surveyService
      if (lowerMessage.includes('survey') || lowerMessage.includes('climate') || lowerMessage.includes('inclusion') || lowerMessage.includes('equity')) {
        // Immediately respond with a placeholder, then fetch analytics async and replace placeholder with result
        const placeholderId = `fetch-${Date.now()}`;
        setMessages(prev => [...prev, { id: placeholderId, type: 'bot' as const, content: 'Fetching analytics...', timestamp: new Date() }].slice(-50));

        (async () => {
          try {
            const keyword = userMessage.match(/([a-z0-9\-]+-?\d{0,4})/i)?.[0] || 'climate-2025-q1';
            const analytics = await getAnalytics(keyword);
            const summary = `Survey ${analytics.surveyId} — ${analytics.title}\nResponses: ${analytics.totalResponses}, Completion Rate: ${analytics.completionRate}%, Avg Time: ${analytics.avgCompletionTime} min. Key insights: ${analytics.insights.join('; ')}`;
            // replace placeholder with summary
            setMessages(prev => {
              const replaced = prev.map(m => m.id === placeholderId ? { ...m, content: summary, suggestions: ['Export report', 'Create huddle report', 'Drill into question analytics'] } : m);
              return replaced.slice(-50);
            });
          } catch (err) {
            setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: 'Error retrieving survey analytics. Supabase may not be configured or an error occurred.' } : m));
          }
        })();

        return {
          message: "I'm fetching the latest survey analytics — I'll post a summary here in a moment.",
          suggestions: ["Show executive summary", "Export report", "Compare organizations"]
        };
      }
      // Admin-specific responses
      if (lowerMessage.includes('completion rate') || lowerMessage.includes('progress')) {
        return {
          message: "Based on current data, your overall completion rate is 87% this month, up 5% from last month. The 'Foundations of Inclusive Leadership' module has the highest completion rate at 94%, while 'Courageous Conversations' is at 78%. Would you like me to identify specific users who might need support?",
          suggestions: [
            "Show me struggling learners",
            "Compare by organization",
            "Export detailed report",
            "Send reminder emails"
          ]
        };
      } else if (lowerMessage.includes('at risk') || lowerMessage.includes('dropping out')) {
        return {
          message: "I've identified 23 learners at risk of dropping out based on engagement patterns. They haven't logged in for 7+ days and have completion rates below 40%. The main risk factors are: low initial engagement, long gaps between sessions, and incomplete first modules. Should I create targeted intervention campaigns?",
          suggestions: [
            "Create intervention campaign",
            "Show detailed risk analysis",
            "Schedule coaching calls",
            "Send personalized reminders"
          ]
        };
      } else if (lowerMessage.includes('module') || lowerMessage.includes('improvement')) {
        return {
          message: "The 'Conversation Planning Template' in Module 4 shows the lowest engagement (68% completion). User feedback indicates it's too text-heavy. I recommend breaking it into smaller, interactive segments. The 'Empathy Case Study' performs best with 92% completion and 4.9/5 rating.",
          suggestions: [
            "Redesign low-performing content",
            "Replicate successful formats",
            "View detailed feedback",
            "A/B test improvements"
          ]
        };
      }
    } else if (isLMSRoute) {
      // Learner-specific responses
      if (lowerMessage.includes('progress') || lowerMessage.includes('summary')) {
        return {
          message: "Great progress, Sarah! You've completed 3 out of 5 modules (60% complete). Your strongest area is 'Empathy in Action' where you scored 95%. I notice you haven't started 'Courageous Conversations' yet - this builds perfectly on your empathy skills. Would you like me to create a study plan?",
          suggestions: [
            "Create personalized study plan",
            "Review completed modules",
            "Practice conversation scenarios",
            "Schedule coaching session"
          ]
        };
      } else if (lowerMessage.includes('inclusive leadership') || lowerMessage.includes('principles')) {
        return {
          message: "Inclusive leadership centers on five core principles: 1) Psychological Safety - creating environments where people feel safe to speak up, 2) Active Listening - truly hearing diverse perspectives, 3) Empathy - understanding others' experiences, 4) Accountability - taking responsibility for inclusive outcomes, and 5) Growth Mindset - continuously learning and adapting. Which principle would you like to explore deeper?",
          suggestions: [
            "Explore psychological safety",
            "Practice active listening",
            "Develop empathy skills",
            "Learn accountability frameworks"
          ]
        };
      } else if (lowerMessage.includes('difficult conversation') || lowerMessage.includes('courageous')) {
        return {
          message: "Courageous conversations require preparation and skill. The BRIDGE framework helps: B-Build rapport, R-Respect perspectives, I-Inquire with curiosity, D-Discuss impact, G-Generate solutions, E-Establish next steps. Start with psychological safety, use 'I' statements, and focus on behaviors, not personalities. Would you like to practice with a scenario?",
          suggestions: [
            "Practice with scenarios",
            "Download conversation template",
            "Learn de-escalation techniques",
            "Schedule role-play session"
          ]
        };
      }
    } else {
      // General website responses
      if (lowerMessage.includes('service') || lowerMessage.includes('training')) {
        return {
          message: "The Huddle Co. offers three main services: 1) Inclusive Leadership Mini-Workshops (half-day intensive), 2) Courageous Conversations Facilitation (full-day workshop), and 3) Strategic DEI Planning (3-month engagement). All programs are customized for your organization's needs and include follow-up support. Which service interests you most?",
          suggestions: [
            "Learn about workshops",
            "Explore DEI planning",
            "See client results",
            "Schedule discovery call"
          ]
        };
      } else if (lowerMessage.includes('result') || lowerMessage.includes('outcome')) {
        return {
          message: "Our clients see measurable results: Pacific Coast University increased student engagement by 40%, Regional Fire Department reduced workplace complaints by 70%, and TechForward Solutions improved employee satisfaction by 45%. We track progress through engagement surveys, retention rates, and behavioral assessments. Would you like to see specific case studies?",
          suggestions: [
            "View case studies",
            "See testimonials",
            "Download success stories",
            "Book consultation"
          ]
        };
      }
    }

    // Default response
    return {
      message: "I'd be happy to help with that! Could you provide more specific details about what you're looking for? I can assist with course content, progress tracking, analytics, or general questions about The Huddle Co.'s services.",
      suggestions: [
        "Ask about specific topics",
        "Get help with navigation",
        "Contact support team",
        "View available resources"
      ]
    };
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    const greeting = getInitialGreeting();
    setMessages([{
      id: '1',
      type: 'bot',
      content: greeting.message,
      timestamp: new Date(),
      suggestions: greeting.suggestions
    }]);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-2">
        <button
          onClick={() => setShowTips(s => !s)}
          className="bg-yellow-400 text-white p-3 rounded-full shadow-lg"
          title="Tips & Shortcuts"
        >
          <Lightbulb className="h-6 w-6" />
        </button>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-orange-400 to-red-500 text-white p-4 rounded-full shadow-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-110"
          title="Open AI Assistant"
        >
          <MessageSquare className="h-6 w-6" />
        </button>

        {showTips && (
          <div className="mt-2 w-64 bg-white rounded-lg shadow-lg p-3 border border-gray-200 text-sm text-gray-700">
            <div className="font-semibold mb-1">AI Tips</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Ask for completion rates by org or course.</li>
              <li>Use "Show me users at risk" to get intervention lists.</li>
              <li>Say "export report" to prepare summaries.</li>
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 transition-all duration-300 ${
      isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50 rounded-t-2xl">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-orange-400 to-red-500 p-2 rounded-full">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">AI Assistant</h3>
            <p className="text-xs text-gray-600">
              {isAdminRoute ? 'Admin Support' : isLMSRoute ? 'Learning Coach' : 'The Huddle Co.'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={clearChat}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 h-96">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start space-x-2 max-w-[80%] ${msg.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`p-2 rounded-full ${msg.type === 'user' ? 'bg-orange-500' : 'bg-gray-100'}`}>
                    {msg.type === 'user' ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <div className={`p-3 rounded-2xl ${
                      msg.type === 'user' 
                        ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="block w-full text-left text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors duration-200"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="p-2 rounded-full bg-gray-100">
                    <Bot className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="bg-gray-100 p-3 rounded-2xl">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="bg-gradient-to-r from-orange-400 to-red-500 text-white p-2 rounded-full hover:from-orange-500 hover:to-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIBot;