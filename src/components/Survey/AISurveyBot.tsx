import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  FileText, 
  BarChart3, 
  Users, 
  Lightbulb,
  Copy,
  RefreshCw,
  Wand2,
  MessageCircle,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface AIResponse {
  id: string;
  requestId: string;
  content: string;
  suggestions?: Array<{
    title: string;
    description: string;
    action?: () => void;
  }>;
  insights?: Array<{
    type: 'trend' | 'concern' | 'opportunity' | 'recommendation';
    title: string;
    description: string;
    confidence: number;
  }>;
  timestamp: Date;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  aiResponse?: AIResponse;
  isLoading?: boolean;
}

interface AISurveyBotProps {
  surveyData?: {
    id: string;
    title: string;
    questions: any[];
    responses: any[];
  };
  onSuggestionApply?: (suggestion: any) => void;
}

const AI_CAPABILITIES = [
  {
    id: 'generate',
    title: 'Generate Questions',
    description: 'Create DEI survey questions based on your requirements',
    icon: FileText,
    prompts: [
      'Generate 5 questions about workplace psychological safety',
      'Create bias awareness questions for managers',
      'Design inclusive leadership assessment questions',
      'Write accessibility needs survey questions'
    ]
  },
  {
    id: 'analyze',
    title: 'Analyze Responses',
    description: 'Get AI insights from your survey response data',
    icon: BarChart3,
    prompts: [
      'Analyze sentiment trends in open-ended responses',
      'Identify demographic differences in satisfaction',
      'Find correlations between tenure and inclusion scores',
      'Highlight areas of concern from the data'
    ]
  },
  {
    id: 'insights',
    title: 'Extract Insights',
    description: 'Discover patterns and themes in survey data',
    icon: Lightbulb,
    prompts: [
      'What are the main themes in employee feedback?',
      'Which departments show the highest engagement?',
      'What factors correlate with inclusion scores?',
      'Identify potential bias indicators in responses'
    ]
  },
  {
    id: 'improve',
    title: 'Improve Surveys',
    description: 'Get suggestions to enhance your survey design',
    icon: TrendingUp,
    prompts: [
      'How can I improve question clarity and reduce bias?',
      'Suggest better response scales for DEI measurement',
      'Recommend additional questions for comprehensive assessment',
      'How to increase survey completion rates?'
    ]
  }
];

const SAMPLE_RESPONSES: { [key: string]: AIResponse } = {
  generate: {
    id: 'resp-1',
    requestId: 'req-1',
    content: `Here are 5 research-backed psychological safety questions for your DEI survey:

**1. Team Voice & Speaking Up**
"I feel comfortable expressing my opinions and ideas in team meetings, even when they differ from others."
*Scale: Strongly Disagree to Strongly Agree*

**2. Error Discussion**
"When I make a mistake at work, I feel safe to discuss it openly with my team to prevent future issues."
*Scale: Strongly Disagree to Strongly Agree*

**3. Authentic Self**
"I can be my authentic self at work without fear of negative consequences."
*Scale: Strongly Disagree to Strongly Agree*

**4. Challenge & Questions**
"I feel comfortable challenging decisions or processes when I believe there's a better approach."
*Scale: Strongly Disagree to Strongly Agree*

**5. Support Seeking**
"I feel comfortable asking for help when I'm struggling with work tasks or challenges."
*Scale: Strongly Disagree to Strongly Agree*`,
    suggestions: [
      {
        title: 'Add to Survey Builder',
        description: 'Import these questions directly into your current survey',
      },
      {
        title: 'Customize Questions',
        description: 'Modify the questions to better fit your organization',
      },
      {
        title: 'Add Logic Branching',
        description: 'Set up conditional questions based on responses',
      }
    ],
    timestamp: new Date()
  },
  analyze: {
    id: 'resp-2',
    requestId: 'req-2',
    content: `**Analysis Summary for Workplace Climate Survey**

Based on 723 completed responses, here are the key findings:

**🎯 Overall Sentiment: Moderately Positive (72.4/100)**
- 68% of responses show positive sentiment
- 24% neutral, 8% negative sentiment
- Improvement from last quarter (+5.2 points)

**📊 Demographic Insights:**
- **Technology Division**: Highest satisfaction (84%)
- **New Employees** (<1 year): Lower belonging scores (65%)
- **Mid-level managers**: Mixed feedback on psychological safety

**⚠️ Areas of Concern:**
- Recognition and career development feedback is declining
- Remote work inclusion needs attention  
- Communication between departments needs improvement`,
    insights: [
      {
        type: 'trend',
        title: 'Positive Trajectory',
        description: 'Overall DEI metrics improving over time',
        confidence: 87
      },
      {
        type: 'concern',
        title: 'New Employee Experience',
        description: 'Onboarding may not adequately address inclusion',
        confidence: 92
      },
      {
        type: 'opportunity',
        title: 'Technology Division Success',
        description: 'Replicate successful practices across other divisions',
        confidence: 78
      }
    ],
    timestamp: new Date()
  }
};

const AISurveyBot: React.FC<AISurveyBotProps> = ({ 
  surveyData, 
  onSuggestionApply 
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'ai',
      content: `👋 Hello! I'm your AI Survey Assistant. I can help you:

• **Generate** DEI survey questions based on research best practices
• **Analyze** survey response data for insights and patterns  
• **Extract** key themes and trends from open-ended feedback
• **Improve** survey design and question effectiveness

What would you like to work on today?`,
      timestamp: new Date()
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCapability, setActiveCapability] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Add loading AI message
    const loadingMessage: Message = {
      id: `ai-${Date.now()}`,
      type: 'ai',
      content: 'Analyzing your request...',
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, loadingMessage]);

    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Determine response type based on message content
    let responseType = 'generate';
    if (message.toLowerCase().includes('analyz') || message.toLowerCase().includes('data')) {
      responseType = 'analyze';
    } else if (message.toLowerCase().includes('insight') || message.toLowerCase().includes('theme')) {
      responseType = 'insights';
    } else if (message.toLowerCase().includes('improve') || message.toLowerCase().includes('better')) {
      responseType = 'improve';
    }

    // Get mock AI response
    const aiResponse = SAMPLE_RESPONSES[responseType] || SAMPLE_RESPONSES.generate;

    // Update loading message with actual response
    setMessages(prev => prev.map(msg => 
      msg.id === loadingMessage.id 
        ? { 
            ...msg, 
            content: aiResponse.content,
            aiResponse,
            isLoading: false
          }
        : msg
    ));

    setIsLoading(false);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
  };

  const handleSuggestionClick = (suggestion: any) => {
    if (onSuggestionApply) {
      onSuggestionApply(suggestion);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Bot className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Survey Assistant</h2>
            <p className="text-sm text-gray-600">Powered by advanced language models trained on DEI research</p>
          </div>
        </div>

        {/* Capability Tabs */}
        <div className="flex space-x-2 mt-4 overflow-x-auto">
          {AI_CAPABILITIES.map((capability) => (
            <button
              key={capability.id}
              onClick={() => setActiveCapability(
                activeCapability === capability.id ? null : capability.id
              )}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeCapability === capability.id
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <capability.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{capability.title}</span>
            </button>
          ))}
        </div>

        {/* Quick Prompts for Selected Capability */}
        {activeCapability && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-2">
              {AI_CAPABILITIES.find(c => c.id === activeCapability)?.title} - Quick Prompts:
            </div>
            <div className="flex flex-wrap gap-2">
              {AI_CAPABILITIES.find(c => c.id === activeCapability)?.prompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-3xl ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
              {message.type === 'ai' && (
                <div className="flex items-center space-x-2 mb-2">
                  <div className="p-1 bg-purple-100 rounded">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">AI Assistant</span>
                  {message.isLoading && (
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce delay-100" />
                      <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce delay-200" />
                    </div>
                  )}
                </div>
              )}
              
              <div className={`p-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* AI Response Actions */}
                {message.type === 'ai' && !message.isLoading && (
                  <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => copyToClipboard(message.content)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    
                    <button className="flex items-center space-x-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50">
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate</span>
                    </button>
                    
                    {message.aiResponse?.suggestions && (
                      <button className="flex items-center space-x-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 border border-purple-200 rounded hover:bg-purple-200">
                        <Wand2 className="w-3 h-3" />
                        <span>Apply Suggestions</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* AI Suggestions */}
              {message.aiResponse?.suggestions && (
                <div className="mt-3 space-y-2">
                  {message.aiResponse.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 cursor-pointer transition-colors"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <div>
                          <div className="font-medium text-gray-900">{suggestion.title}</div>
                          <div className="text-sm text-gray-600">{suggestion.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Insights */}
              {message.aiResponse?.insights && (
                <div className="mt-3 space-y-2">
                  <div className="text-sm font-medium text-gray-700 mb-2">Key Insights:</div>
                  {message.aiResponse.insights.map((insight, index) => (
                    <div key={index} className="flex items-start space-x-2 p-2 bg-white border border-gray-200 rounded">
                      <div className={`p-1 rounded ${
                        insight.type === 'trend' ? 'bg-green-100' :
                        insight.type === 'concern' ? 'bg-red-100' :
                        insight.type === 'opportunity' ? 'bg-blue-100' :
                        'bg-yellow-100'
                      }`}>
                        {insight.type === 'trend' && <TrendingUp className="w-3 h-3 text-green-600" />}
                        {insight.type === 'concern' && <AlertCircle className="w-3 h-3 text-red-600" />}
                        {insight.type === 'opportunity' && <Lightbulb className="w-3 h-3 text-blue-600" />}
                        {insight.type === 'recommendation' && <MessageCircle className="w-3 h-3 text-yellow-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{insight.title}</div>
                        <div className="text-xs text-gray-600">{insight.description}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Confidence: {insight.confidence}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-500 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
              placeholder="Ask me to generate questions, analyze data, extract insights, or improve your survey..."
              className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isLoading}
            />
            {surveyData && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <Users className="w-3 h-3" />
                  <span>{surveyData.responses?.length || 0}</span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Context Info */}
        {surveyData && (
          <div className="mt-2 flex items-center space-x-4 text-xs text-gray-600">
            <div className="flex items-center space-x-1">
              <FileText className="w-3 h-3" />
              <span>Survey: {surveyData.title}</span>
            </div>
            <div className="flex items-center space-x-1">
              <BarChart3 className="w-3 h-3" />
              <span>{surveyData.questions?.length || 0} questions</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="w-3 h-3" />
              <span>{surveyData.responses?.length || 0} responses</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AISurveyBot;