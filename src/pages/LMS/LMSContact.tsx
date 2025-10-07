import { useState } from 'react';
import { 
  Calendar, 
  Mail, 
  Phone, 
  Clock, 
  MessageSquare,
  Video,
  CheckCircle,
  Send
} from 'lucide-react';

const LMSContact = () => {
  const [contactType, setContactType] = useState('coaching');
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    urgency: 'normal',
    preferredContact: 'email',
    availableTimes: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const contactOptions = [
    {
      id: 'coaching',
      title: 'Book Coaching Session',
      description: 'Schedule a 1-on-1 session with your coach',
      icon: Calendar,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'question',
      title: 'Ask a Question',
      description: 'Get help with course content or concepts',
      icon: MessageSquare,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      id: 'support',
      title: 'Technical Support',
      description: 'Report issues or get technical help',
      icon: Phone,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    {
      id: 'general',
      title: 'General Inquiry',
      description: 'Other questions or requests',
      icon: Mail,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ];

  const coachInfo = {
    name: 'Mya Dennis',
    title: 'Founder & Lead Facilitator',
    image: 'https://images.pexels.com/photos/3184416/pexels-photo-3184416.jpeg?auto=compress&cs=tinysrgb&w=400',
    availability: 'Monday - Friday, 9:00 AM - 5:00 PM EST',
    responseTime: 'Within 24 hours',
    specialties: ['Inclusive Leadership', 'DEI Strategy', 'Team Development', 'Organizational Change']
  };

  const upcomingSessions = [
    {
      date: 'March 15, 2025',
      time: '2:00 PM EST',
      type: 'Individual Coaching',
      duration: '60 minutes',
      status: 'confirmed'
    },
    {
      date: 'March 22, 2025',
      time: '10:00 AM EST',
      type: 'Group Q&A Session',
      duration: '45 minutes',
      status: 'available'
    }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the message to your backend
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Message Sent Successfully!
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {contactType === 'coaching' 
              ? "Your coaching session request has been received. You'll receive a calendar invitation within 24 hours."
              : "Your message has been sent to Mya Dennis. You can expect a response within 24 hours."
            }
          </p>
          <div className="bg-orange-50 p-6 rounded-lg mb-8">
            <h3 className="font-semibold text-gray-900 mb-2">What's Next?</h3>
            <ul className="text-left space-y-2 text-gray-700">
              <li>• You'll receive an email confirmation shortly</li>
              <li>• {contactType === 'coaching' ? 'A calendar invitation will be sent with session details' : 'Mya will review your message and respond personally'}</li>
              <li>• Check your email for any follow-up questions</li>
              <li>• Urgent matters will be prioritized for faster response</li>
            </ul>
          </div>
          <button 
            onClick={() => setIsSubmitted(false)}
            className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200"
          >
            Send Another Message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Your Coach</h1>
        <p className="text-gray-600">
          Get personalized support, schedule coaching sessions, or ask questions about your learning journey.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Contact Form */}
        <div className="lg:col-span-2">
          {/* Contact Type Selection */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">How can we help you?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contactOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setContactType(option.id)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                      contactType === option.id
                        ? `${option.borderColor} ${option.bgColor}`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Icon className={`h-6 w-6 ${option.color}`} />
                      <h3 className="font-semibold text-gray-900">{option.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder={
                    contactType === 'coaching' ? 'Coaching session request' :
                    contactType === 'question' ? 'Question about...' :
                    contactType === 'support' ? 'Technical issue with...' :
                    'General inquiry about...'
                  }
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder={
                    contactType === 'coaching' ? 'Please describe what you\'d like to focus on in your coaching session and any specific challenges you\'re facing...' :
                    contactType === 'question' ? 'Please describe your question in detail. Include any specific modules or concepts you need help with...' :
                    contactType === 'support' ? 'Please describe the technical issue you\'re experiencing, including what you were trying to do and any error messages...' :
                    'Please provide details about your inquiry...'
                  }
                />
              </div>

              {contactType === 'coaching' && (
                <div>
                  <label htmlFor="availableTimes" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Available Times
                  </label>
                  <textarea
                    id="availableTimes"
                    name="availableTimes"
                    value={formData.availableTimes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Please share your availability (days, times, time zone) so we can schedule your session..."
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="urgency" className="block text-sm font-medium text-gray-700 mb-2">
                    Priority Level
                  </label>
                  <select
                    id="urgency"
                    name="urgency"
                    value={formData.urgency}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="low">Low - General inquiry</option>
                    <option value="normal">Normal - Standard response</option>
                    <option value="high">High - Need response soon</option>
                    <option value="urgent">Urgent - Need immediate help</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="preferredContact" className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Response Method
                  </label>
                  <select
                    id="preferredContact"
                    name="preferredContact"
                    value={formData.preferredContact}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone call</option>
                    <option value="video">Video call</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <Send className="h-5 w-5" />
                <span>
                  {contactType === 'coaching' ? 'Request Coaching Session' : 'Send Message'}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Coach Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Your Coach</h3>
            <div className="flex items-center space-x-4 mb-4">
              <img 
                src={coachInfo.image} 
                alt={coachInfo.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <h4 className="font-bold text-gray-900">{coachInfo.name}</h4>
                <p className="text-sm text-gray-600">{coachInfo.title}</p>
              </div>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">{coachInfo.availability}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Response time: {coachInfo.responseTime}</span>
              </div>
            </div>

            <div className="mt-4">
              <h5 className="font-semibold text-gray-900 mb-2">Specialties:</h5>
              <div className="flex flex-wrap gap-2">
                {coachInfo.specialties.map((specialty, index) => (
                  <span key={index} className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming Sessions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Upcoming Sessions</h3>
            <div className="space-y-4">
              {upcomingSessions.map((session, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{session.type}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      session.status === 'confirmed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>{session.date}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>{session.time} ({session.duration})</span>
                    </div>
                  </div>
                  {session.status === 'confirmed' && (
                    <a href="/lms/meeting" className="mt-3 w-full bg-blue-500 text-white py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center space-x-2">
                      <Video className="h-4 w-4" />
                      <span>Join Meeting</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Contact */}
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Need Immediate Help?</h3>
            <p className="text-sm text-gray-600 mb-4">
              For urgent technical issues or time-sensitive questions, you can reach out directly.
            </p>
            <div className="space-y-2">
              <a 
                href="mailto:mya@thehuddleco.com" 
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
              >
                <Mail className="h-4 w-4" />
                <span>mya@thehuddleco.com</span>
              </a>
              <a 
                href="tel:+15551234567" 
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
              >
                <Phone className="h-4 w-4" />
                <span>(555) 123-4567</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LMSContact;