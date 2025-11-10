import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, FileText, BarChart3, Users, Lightbulb, Copy, RefreshCw, Wand2, MessageCircle, TrendingUp, AlertCircle } from 'lucide-react';
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
const SAMPLE_RESPONSES = {
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
const AISurveyBot = ({ surveyData, onSuggestionApply }) => {
    const [messages, setMessages] = useState([
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
    const [activeCapability, setActiveCapability] = useState(null);
    const messagesEndRef = useRef(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    const handleSendMessage = async (message) => {
        if (!message.trim() || isLoading)
            return;
        // Add user message
        const userMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: message,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);
        // Add loading AI message
        const loadingMessage = {
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
        }
        else if (message.toLowerCase().includes('insight') || message.toLowerCase().includes('theme')) {
            responseType = 'insights';
        }
        else if (message.toLowerCase().includes('improve') || message.toLowerCase().includes('better')) {
            responseType = 'improve';
        }
        // Get mock AI response
        const aiResponse = SAMPLE_RESPONSES[responseType] || SAMPLE_RESPONSES.generate;
        // Update loading message with actual response
        setMessages(prev => prev.map(msg => msg.id === loadingMessage.id
            ? {
                ...msg,
                content: aiResponse.content,
                aiResponse,
                isLoading: false
            }
            : msg));
        setIsLoading(false);
    };
    const handleQuickPrompt = (prompt) => {
        setInputValue(prompt);
    };
    const handleSuggestionClick = (suggestion) => {
        if (onSuggestionApply) {
            onSuggestionApply(suggestion);
        }
    };
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            // You could add a toast notification here
        }
        catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };
    return (_jsxs("div", { className: "max-w-4xl mx-auto h-full flex flex-col bg-white", children: [_jsxs("div", { className: "border-b border-gray-200 p-4", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "p-2 bg-purple-100 rounded-lg", children: _jsx(Bot, { className: "w-6 h-6 text-purple-600" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "AI Survey Assistant" }), _jsx("p", { className: "text-sm text-gray-600", children: "Powered by advanced language models trained on DEI research" })] })] }), _jsx("div", { className: "flex space-x-2 mt-4 overflow-x-auto", children: AI_CAPABILITIES.map((capability) => (_jsxs("button", { onClick: () => setActiveCapability(activeCapability === capability.id ? null : capability.id), className: `flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${activeCapability === capability.id
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: [_jsx(capability.icon, { className: "w-4 h-4" }), _jsx("span", { className: "text-sm font-medium", children: capability.title })] }, capability.id))) }), activeCapability && (_jsxs("div", { className: "mt-3 p-3 bg-gray-50 rounded-lg", children: [_jsxs("div", { className: "text-sm font-medium text-gray-700 mb-2", children: [AI_CAPABILITIES.find(c => c.id === activeCapability)?.title, " - Quick Prompts:"] }), _jsx("div", { className: "flex flex-wrap gap-2", children: AI_CAPABILITIES.find(c => c.id === activeCapability)?.prompts.map((prompt, index) => (_jsx("button", { onClick: () => handleQuickPrompt(prompt), className: "text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 text-left", children: prompt }, index))) })] }))] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-4", children: [messages.map((message) => (_jsx("div", { className: `flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`, children: _jsxs("div", { className: `max-w-3xl ${message.type === 'user' ? 'order-2' : 'order-1'}`, children: [message.type === 'ai' && (_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx("div", { className: "p-1 bg-purple-100 rounded", children: _jsx(Bot, { className: "w-4 h-4 text-purple-600" }) }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "AI Assistant" }), message.isLoading && (_jsxs("div", { className: "flex space-x-1", children: [_jsx("div", { className: "w-1 h-1 bg-purple-500 rounded-full animate-bounce" }), _jsx("div", { className: "w-1 h-1 bg-purple-500 rounded-full animate-bounce delay-100" }), _jsx("div", { className: "w-1 h-1 bg-purple-500 rounded-full animate-bounce delay-200" })] }))] })), _jsxs("div", { className: `p-3 rounded-lg ${message.type === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 text-gray-900'}`, children: [_jsx("div", { className: "whitespace-pre-wrap", children: message.content }), message.type === 'ai' && !message.isLoading && (_jsxs("div", { className: "flex items-center space-x-2 mt-3 pt-3 border-t border-gray-200", children: [_jsxs("button", { onClick: () => copyToClipboard(message.content), className: "flex items-center space-x-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50", children: [_jsx(Copy, { className: "w-3 h-3" }), _jsx("span", { children: "Copy" })] }), _jsxs("button", { className: "flex items-center space-x-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50", children: [_jsx(RefreshCw, { className: "w-3 h-3" }), _jsx("span", { children: "Regenerate" })] }), message.aiResponse?.suggestions && (_jsxs("button", { className: "flex items-center space-x-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 border border-purple-200 rounded hover:bg-purple-200", children: [_jsx(Wand2, { className: "w-3 h-3" }), _jsx("span", { children: "Apply Suggestions" })] }))] }))] }), message.aiResponse?.suggestions && (_jsx("div", { className: "mt-3 space-y-2", children: message.aiResponse.suggestions.map((suggestion, index) => (_jsx("div", { className: "p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 cursor-pointer transition-colors", onClick: () => handleSuggestionClick(suggestion), children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Sparkles, { className: "w-4 h-4 text-purple-500" }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: suggestion.title }), _jsx("div", { className: "text-sm text-gray-600", children: suggestion.description })] })] }) }, index))) })), message.aiResponse?.insights && (_jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("div", { className: "text-sm font-medium text-gray-700 mb-2", children: "Key Insights:" }), message.aiResponse.insights.map((insight, index) => (_jsxs("div", { className: "flex items-start space-x-2 p-2 bg-white border border-gray-200 rounded", children: [_jsxs("div", { className: `p-1 rounded ${insight.type === 'trend' ? 'bg-green-100' :
                                                        insight.type === 'concern' ? 'bg-red-100' :
                                                            insight.type === 'opportunity' ? 'bg-blue-100' :
                                                                'bg-yellow-100'}`, children: [insight.type === 'trend' && _jsx(TrendingUp, { className: "w-3 h-3 text-green-600" }), insight.type === 'concern' && _jsx(AlertCircle, { className: "w-3 h-3 text-red-600" }), insight.type === 'opportunity' && _jsx(Lightbulb, { className: "w-3 h-3 text-blue-600" }), insight.type === 'recommendation' && _jsx(MessageCircle, { className: "w-3 h-3 text-yellow-600" })] }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-sm text-gray-900", children: insight.title }), _jsx("div", { className: "text-xs text-gray-600", children: insight.description }), _jsxs("div", { className: "text-xs text-gray-500 mt-1", children: ["Confidence: ", insight.confidence, "%"] })] })] }, index)))] })), _jsx("div", { className: "text-xs text-gray-500 mt-2", children: message.timestamp.toLocaleTimeString() })] }) }, message.id))), _jsx("div", { ref: messagesEndRef })] }), _jsxs("div", { className: "border-t border-gray-200 p-4", children: [_jsxs("div", { className: "flex space-x-2", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx("input", { type: "text", value: inputValue, onChange: (e) => setInputValue(e.target.value), onKeyPress: (e) => e.key === 'Enter' && handleSendMessage(inputValue), placeholder: "Ask me to generate questions, analyze data, extract insights, or improve your survey...", className: "w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent", disabled: isLoading }), surveyData && (_jsx("div", { className: "absolute right-2 top-1/2 transform -translate-y-1/2", children: _jsxs("div", { className: "flex items-center space-x-1 text-xs text-gray-500", children: [_jsx(Users, { className: "w-3 h-3" }), _jsx("span", { children: surveyData.responses?.length || 0 })] }) }))] }), _jsx("button", { onClick: () => handleSendMessage(inputValue), disabled: !inputValue.trim() || isLoading, className: "px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2", children: _jsx(Send, { className: "w-4 h-4" }) })] }), surveyData && (_jsxs("div", { className: "mt-2 flex items-center space-x-4 text-xs text-gray-600", children: [_jsxs("div", { className: "flex items-center space-x-1", children: [_jsx(FileText, { className: "w-3 h-3" }), _jsxs("span", { children: ["Survey: ", surveyData.title] })] }), _jsxs("div", { className: "flex items-center space-x-1", children: [_jsx(BarChart3, { className: "w-3 h-3" }), _jsxs("span", { children: [surveyData.questions?.length || 0, " questions"] })] }), _jsxs("div", { className: "flex items-center space-x-1", children: [_jsx(Users, { className: "w-3 h-3" }), _jsxs("span", { children: [surveyData.responses?.length || 0, " responses"] })] })] }))] })] }));
};
export default AISurveyBot;
