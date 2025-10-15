import React, { useState } from 'react';
import { Calendar, Clock, User, MessageSquare, X, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface BookingWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BookingForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  timeZone: string;
  preferredDate: string;
  preferredTime: string;
  sessionType: 'discovery' | 'strategy' | 'consultation';
  message: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const BookingWidget: React.FC<BookingWidgetProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  
  const [step, setStep] = useState<'info' | 'scheduling' | 'confirmation'>('info');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<BookingForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    role: '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    preferredDate: '',
    preferredTime: '',
    sessionType: 'discovery',
    message: ''
  });

  const sessionTypes = [
    {
      id: 'discovery',
      title: 'Discovery Call',
      duration: '30 minutes',
      description: 'Learn about our services and discuss your DEI goals',
      popular: true
    },
    {
      id: 'strategy',
      title: 'Strategy Session',
      duration: '60 minutes', 
      description: 'Deep dive into your specific challenges and create an action plan'
    },
    {
      id: 'consultation',
      title: 'Leadership Consultation',
      duration: '45 minutes',
      description: 'Executive-level discussion on organizational transformation'
    }
  ];

  const timeSlots: TimeSlot[] = [
    { time: '09:00 AM', available: true },
    { time: '10:00 AM', available: true },
    { time: '11:00 AM', available: false },
    { time: '01:00 PM', available: true },
    { time: '02:00 PM', available: true },
    { time: '03:00 PM', available: true },
    { time: '04:00 PM', available: false },
    { time: '05:00 PM', available: true }
  ];

  const timeZones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver', 
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo'
  ];

  // Get next 14 days for date selection
  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1); // Start from tomorrow
    return {
      value: date.toISOString().split('T')[0],
      label: date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }),
      disabled: date.getDay() === 0 || date.getDay() === 6 // Disable weekends
    };
  });

  const updateForm = (field: keyof BookingForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = () => {
    if (step === 'info') {
      return form.firstName && form.lastName && form.email && form.company;
    }
    if (step === 'scheduling') {
      return form.preferredDate && form.preferredTime && form.sessionType;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    if (step === 'info') {
      setStep('scheduling');
    } else if (step === 'scheduling') {
      submitBooking();
    }
  };

  const submitBooking = async () => {
    setLoading(true);
    try {
      // Mock API call - replace with actual booking service
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStep('confirmation');
      showToast('Your discovery call has been scheduled!', 'success');
    } catch (error) {
      showToast('Failed to schedule call. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      role: '',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      preferredDate: '',
      preferredTime: '',
      sessionType: 'discovery',
      message: ''
    });
    setStep('info');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-2xl px-6 py-4 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {step === 'confirmation' ? 'Booking Confirmed!' : 'Schedule Your Discovery Call'}
              </h3>
              <p className="text-sm text-gray-500">
                {step === 'info' && 'Tell us about yourself and your organization'}
                {step === 'scheduling' && 'Choose your preferred date and time'}
                {step === 'confirmation' && 'We\'re excited to connect with you'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress indicator */}
          {step !== 'confirmation' && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center space-x-4">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step === 'info' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-500'
                }`}>
                  {step === 'scheduling' ? <Check className="h-4 w-4" /> : '1'}
                </div>
                <div className={`h-1 w-16 ${step === 'scheduling' ? 'bg-orange-500' : 'bg-gray-200'}`} />
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step === 'scheduling' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  2
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Contact Information */}
          {step === 'info' && (
            <div className="py-6 space-y-6">
              {/* Session Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What type of session would you like?
                </label>
                <div className="space-y-3">
                  {sessionTypes.map(session => (
                    <label
                      key={session.id}
                      className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                        form.sessionType === session.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="sessionType"
                        value={session.id}
                        checked={form.sessionType === session.id}
                        onChange={(e) => updateForm('sessionType', e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{session.title}</span>
                          {session.popular && (
                            <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded">
                              Popular
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {session.duration} • {session.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Contact Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => updateForm('firstName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => updateForm('lastName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company/Organization *
                  </label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => updateForm('company', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Role
                  </label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => updateForm('role', e.target.value)}
                    placeholder="e.g., HR Director, CEO, Manager"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What would you like to discuss? (Optional)
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => updateForm('message', e.target.value)}
                  rows={3}
                  placeholder="Tell us about your DEI goals, challenges, or specific questions..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Step 2: Scheduling */}
          {step === 'scheduling' && (
            <div className="py-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Zone
                </label>
                <select
                  value={form.timeZone}
                  onChange={(e) => updateForm('timeZone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {timeZones.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Preferred Date
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {availableDates.map(date => (
                    <button
                      key={date.value}
                      onClick={() => updateForm('preferredDate', date.value)}
                      disabled={date.disabled}
                      className={`p-3 text-sm rounded-lg border ${
                        date.disabled
                          ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                          : form.preferredDate === date.value
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                      }`}
                    >
                      {date.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.preferredDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Preferred Time
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {timeSlots.map(slot => (
                      <button
                        key={slot.time}
                        onClick={() => updateForm('preferredTime', slot.time)}
                        disabled={!slot.available}
                        className={`p-3 text-sm rounded-lg border ${
                          !slot.available
                            ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                            : form.preferredTime === slot.time
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Session Summary */}
              {form.preferredDate && form.preferredTime && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Session Summary</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      {sessionTypes.find(s => s.id === form.sessionType)?.title} 
                      ({sessionTypes.find(s => s.id === form.sessionType)?.duration})
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {new Date(form.preferredDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      {form.preferredTime} ({form.timeZone})
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirmation' && (
            <div className="py-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Your call is confirmed!
              </h3>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Session:</span>
                    <span className="font-medium">{sessionTypes.find(s => s.id === form.sessionType)?.title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">
                      {new Date(form.preferredDate).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-medium">{form.preferredTime}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{sessionTypes.find(s => s.id === form.sessionType)?.duration}</span>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-600 mb-4">
                We've sent a calendar invitation to <strong>{form.email}</strong> with the meeting details.
              </p>
              
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 mb-6">
                <MessageSquare className="h-4 w-4" />
                <span>You'll receive a confirmation email with preparation materials shortly.</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            {step === 'confirmation' ? (
              <div className="flex w-full justify-center">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {step === 'scheduling' && (
                  <button
                    onClick={() => setStep('info')}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Back
                  </button>
                )}
                
                <div className="flex space-x-3 ml-auto">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!validateStep() || loading}
                    className="px-6 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Scheduling...' : step === 'info' ? 'Next' : 'Schedule Call'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingWidget;