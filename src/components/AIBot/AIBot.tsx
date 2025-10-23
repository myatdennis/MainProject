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
  Lightbulb,
} from 'lucide-react';
import { aiCourseService } from '../../services/aiCourseService';
import { useAuth } from '../../context/AuthContext';

const focusableSelectors = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
const stripFormatting = (value: string) => value.replace(/[\*_`>#]/g, '');

const AIBot = () => {
  const { user } = useAuth();
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const [showTips, setShowTips] = useState(false);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isLMSRoute = location.pathname.startsWith('/lms');
  const routeContext: 'admin' | 'lms' | 'marketing' = isAdminRoute ? 'admin' : isLMSRoute ? 'lms' : 'marketing';
  const dialogTitleId = 'ai-assistant-title';
  const dialogDescriptionId = 'ai-assistant-description';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setIsOpen(prev => !prev);
        setIsMinimized(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      openButtonRef.current?.focus();
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusFirstElement = () => {
      const elements = dialog.querySelectorAll<HTMLElement>(focusableSelectors);
      elements[0]?.focus();
    };

    focusFirstElement();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const elements = dialog.querySelectorAll<HTMLElement>(focusableSelectors);
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = getInitialGreeting();
      setMessages([
        {
          id: 'welcome',
          type: 'bot',
          content: greeting.message,
          timestamp: new Date(),
          suggestions: greeting.suggestions,
        },
      ]);
      setLiveMessage(stripFormatting(greeting.message));
    }
  }, [isOpen, isAdminRoute, isLMSRoute]);

  useEffect(() => {
    if (messages.length > 50) {
      setMessages(prev => prev.slice(prev.length - 50));
    }
  }, [messages]);

  const getInitialGreeting = () => {
    if (isAdminRoute) {
      return {
        message:
          "Hi Mya! I'm your AI assistant for The Huddle Co. admin portal. I can help with analytics, user management, course insights, and more. What would you like to know?",
        suggestions: [
          'Show me users at risk of dropping out',
          "What's our completion rate this month?",
          'Which modules need improvement?',
          'Generate a progress report',
        ],
      };
    }

    if (isLMSRoute) {
      return {
        message:
          "Hello! I'm here to support your learning journey. I can answer questions about course content, provide study tips, remind you of deadlines, and suggest next steps. How can I assist you today?",
        suggestions: [
          'What should I focus on next?',
          'Explain inclusive leadership principles',
          'How do I handle difficult conversations?',
          'Show my progress summary',
        ],
      };
    }

    return {
      message:
        "Welcome to The Huddle Co.! I'm here to help you learn about our DEI consulting services, training programs, and how we can support your organization. What would you like to know?",
      suggestions: [
        'Tell me about your services',
        'How does the training work?',
        'What results do clients see?',
        'Schedule a discovery call',
      ],
    };
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);
    setErrorMessage(null);

    try {
      const reply = await aiCourseService.getAssistantReply({
        prompt: userMessage.content,
        route: routeContext,
        organizationId: undefined,
        userId: user?.id,
      });

      const botMessage = {
        id: `${Date.now()}-bot`,
        type: 'bot' as const,
        content: reply.message,
        timestamp: new Date(),
        suggestions: reply.suggestions,
      };

      setMessages(prev => [...prev, botMessage]);
      setLiveMessage(stripFormatting(reply.message));
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'I ran into an issue while generating a response. Please try again.';
      const botMessage = {
        id: `${Date.now()}-error`,
        type: 'bot' as const,
        content: fallback,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
      setErrorMessage(fallback);
      setLiveMessage(stripFormatting(fallback));
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    const greeting = getInitialGreeting();
    setMessages([
      {
        id: 'welcome',
        type: 'bot',
        content: greeting.message,
        timestamp: new Date(),
        suggestions: greeting.suggestions,
      },
    ]);
    setLiveMessage(stripFormatting(greeting.message));
    setErrorMessage(null);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-2">
        <button
          onClick={() => setShowTips(s => !s)}
          className="bg-yellow-400 text-white p-3 rounded-full shadow-lg"
          title="Tips & Shortcuts"
          aria-expanded={showTips}
          aria-controls="ai-assistant-tips"
        >
          <Lightbulb className="h-6 w-6" />
        </button>
        <button
          ref={openButtonRef}
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-orange-400 to-red-500 text-white p-4 rounded-full shadow-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-110"
          title="Open AI Assistant"
          aria-haspopup="dialog"
          aria-expanded={false}
          aria-controls="ai-assistant-panel"
        >
          <MessageSquare className="h-6 w-6" />
        </button>

        {showTips && (
          <div
            id="ai-assistant-tips"
            className="mt-2 w-64 bg-white rounded-lg shadow-lg p-3 border border-gray-200 text-sm text-gray-700"
          >
            <div className="font-semibold mb-1">AI Tips</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Press Alt + Shift + A to toggle the assistant anywhere.</li>
              <li>Ask for completion trends or intervention lists.</li>
              <li>Say "export report" to prepare summaries.</li>
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={dialogRef}
      id="ai-assistant-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
      className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 transition-all duration-300 ${
        isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
      }`}
    >
      <p id={dialogDescriptionId} className="sr-only">
        Conversational assistant with keyboard navigation and accessible controls. Press Escape to close.
      </p>
      <div className="sr-only" aria-live="polite">
        {liveMessage}
      </div>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50 rounded-t-2xl">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-orange-400 to-red-500 p-2 rounded-full">
            <Bot className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h3 id={dialogTitleId} className="font-bold text-gray-900">
              AI Assistant
            </h3>
            <p className="text-xs text-gray-600">
              {isAdminRoute ? 'Admin Support' : isLMSRoute ? 'Learning Coach' : 'The Huddle Co.'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label={isMinimized ? 'Expand assistant' : 'Minimize assistant'}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={clearChat}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Clear conversation"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Close assistant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 h-96" aria-live="polite">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`flex items-start space-x-2 max-w-[80%] ${
                    msg.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div
                    className={`p-2 rounded-full ${msg.type === 'user' ? 'bg-orange-500' : 'bg-gray-100'}`}
                    aria-hidden="true"
                  >
                    {msg.type === 'user' ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-sm ${
                      msg.type === 'user'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-2 space-x-2 space-y-2">
                        {msg.suggestions.map(suggestion => (
                          <button
                            key={suggestion}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={`inline-flex items-center text-xs px-3 py-1 rounded-full transition-colors border ${
                              msg.type === 'user'
                                ? 'border-white/80 text-white bg-white/10 hover:bg-white/20'
                                : 'border-orange-100 text-orange-600 bg-orange-50 hover:bg-orange-100'
                            }`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-[10px] uppercase tracking-wide opacity-70">
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-center space-x-2 text-sm text-gray-500" aria-live="assertive">
                <Bot className="h-4 w-4" aria-hidden="true" />
                <span>Thinking…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {errorMessage && (
            <div className="px-4 text-xs text-red-600" role="status">
              {errorMessage}
            </div>
          )}

          <div className="p-4 border-t border-gray-100 bg-white space-y-2">
            <label htmlFor="ai-assistant-input" className="sr-only">
              Ask the AI assistant
            </label>
            <textarea
              id="ai-assistant-input"
              className="w-full h-24 resize-none rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent px-3 py-2 text-sm"
              placeholder="Ask me for analytics, learning support, or platform guidance..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              aria-label="Message the AI assistant"
            />
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-gray-500">
                Tip: Press Enter to send, Shift + Enter for a new line.
              </div>
              <button
                onClick={handleSendMessage}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full shadow-lg hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
                aria-label="Send message"
              >
                <span>Send</span>
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
