import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Calendar,
  Mail,
  Clock,
  Settings,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Users,
  Edit3,
  Save,
  Plus
} from 'lucide-react';
import { 
  scheduleReminders, 
  sendReminder, 
  type ReminderTemplate 
} from '../../services/surveyService';

interface SurveyReminderManagerProps {
  surveyId: string;
  surveyTitle: string;
  isActive?: boolean;
}

const SurveyReminderManager: React.FC<SurveyReminderManagerProps> = ({ 
  surveyId, 
  surveyTitle,
  isActive = true 
}) => {
  const [reminderSettings, setReminderSettings] = useState({
    enabled: true,
    schedule: [3, 7, 14], // days after initial invite
    maxReminders: 3,
    escalateToManagers: false
  });
  
  const [reminderTemplates, setReminderTemplates] = useState<ReminderTemplate[]>([
    {
      id: '1',
      name: 'Standard Reminder',
      subject: 'Reminder: Complete Your Survey',
      body: `Hi there!\n\nWe noticed you haven't completed the "${surveyTitle}" survey yet. Your feedback is valuable to us.\n\nIt only takes about 15 minutes to complete. You can start or continue where you left off.\n\n[SURVEY_LINK]\n\nThank you for your time!`,
      trigger_days: [3, 7, 14],
      escalation_rules: {
        max_reminders: 3,
        escalate_to: [],
        escalation_subject: 'Survey Completion Follow-up Needed',
        escalation_body: 'This team member has not completed the required survey after multiple reminders.'
      }
    }
  ]);

  const [activeTemplate, setActiveTemplate] = useState<string>('1');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [reminderHistory, setReminderHistory] = useState([
    { id: '1', recipient: 'john.doe@company.com', sentAt: '2025-03-10T10:30:00Z', status: 'delivered', type: 'reminder' },
    { id: '2', recipient: 'jane.smith@company.com', sentAt: '2025-03-09T14:15:00Z', status: 'opened', type: 'reminder' },
    { id: '3', recipient: 'mike.johnson@company.com', sentAt: '2025-03-08T09:00:00Z', status: 'clicked', type: 'reminder' },
  ]);

  useEffect(() => {
    // Load reminder settings and history for this survey
    const loadReminderData = async () => {
      try {
        // In production, this would load from the database
        console.log(`Loading reminder data for survey ${surveyId}`);
      } catch (error) {
        console.error('Failed to load reminder data:', error);
      }
    };

    loadReminderData();
  }, [surveyId]);

  const handleScheduleReminders = async () => {
    if (!reminderSettings.enabled) return;

    try {
      const scheduledReminders = await scheduleReminders(surveyId, reminderSettings.schedule);
      console.log(`Scheduled ${scheduledReminders.length} reminders for survey ${surveyId}`);
      // Update UI to show scheduled reminders
    } catch (error) {
      console.error('Failed to schedule reminders:', error);
    }
  };

  const handleSaveTemplate = (template: ReminderTemplate) => {
    if (editingTemplate) {
      setReminderTemplates(prev => 
        prev.map(t => t.id === template.id ? template : t)
      );
    } else {
      const newTemplate = { ...template, id: Date.now().toString() };
      setReminderTemplates(prev => [...prev, newTemplate]);
    }
    setEditingTemplate(null);
    setShowTemplateEditor(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-blue-600 bg-blue-50';
      case 'opened': return 'text-green-600 bg-green-50';
      case 'clicked': return 'text-orange-600 bg-orange-50';
      case 'bounced': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Reminder Settings */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Bell className="h-6 w-6 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">Reminder Management</h2>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Reminders</span>
            <button
              onClick={() => setReminderSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                reminderSettings.enabled ? 'bg-orange-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  reminderSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reminder Schedule (days)
            </label>
            <div className="space-y-2">
              {reminderSettings.schedule.map((day, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={day}
                    onChange={(e) => {
                      const newSchedule = [...reminderSettings.schedule];
                      newSchedule[index] = parseInt(e.target.value) || 0;
                      setReminderSettings(prev => ({ ...prev, schedule: newSchedule }));
                    }}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600">days after invite</span>
                </div>
              ))}
              <button
                onClick={() => setReminderSettings(prev => ({ 
                  ...prev, 
                  schedule: [...prev.schedule, prev.schedule[prev.schedule.length - 1] + 7] 
                }))}
                className="flex items-center space-x-2 text-sm text-orange-600 hover:text-orange-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add reminder</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Reminders
            </label>
            <select
              value={reminderSettings.maxReminders}
              onChange={(e) => setReminderSettings(prev => ({ 
                ...prev, 
                maxReminders: parseInt(e.target.value) 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value={1}>1 reminder</option>
              <option value={2}>2 reminders</option>
              <option value={3}>3 reminders</option>
              <option value={5}>5 reminders</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Escalation Options
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={reminderSettings.escalateToManagers}
                  onChange={(e) => setReminderSettings(prev => ({ 
                    ...prev, 
                    escalateToManagers: e.target.checked 
                  }))}
                  className="h-4 w-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="ml-2 text-sm text-gray-700">Escalate to managers</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={handleScheduleReminders}
            disabled={!reminderSettings.enabled || !isActive}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
          >
            <Calendar className="h-4 w-4" />
            <span>Schedule Reminders</span>
          </button>
          
          <div className="text-sm text-gray-600">
            {isActive ? (
              <span className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Survey is active</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-gray-500" />
                <span>Survey is not active</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reminder Templates */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">Reminder Templates</h3>
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowTemplateEditor(true);
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Template</span>
          </button>
        </div>

        <div className="space-y-4">
          {reminderTemplates.map((template) => (
            <div key={template.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{template.name}</h4>
                <div className="flex items-center space-x-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="activeTemplate"
                      checked={activeTemplate === template.id}
                      onChange={() => setActiveTemplate(template.id)}
                      className="h-4 w-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">Active</span>
                  </label>
                  <button
                    onClick={() => {
                      setEditingTemplate(template);
                      setShowTemplateEditor(true);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">Subject: {template.subject}</p>
              <p className="text-sm text-gray-500">
                Triggers: {template.trigger_days.join(', ')} days
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Reminder History */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Reminder Activity</h3>
        
        <div className="space-y-3">
          {reminderHistory.map((reminder) => (
            <div key={reminder.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-medium text-gray-900">{reminder.recipient}</div>
                  <div className="text-sm text-gray-600">
                    Sent: {new Date(reminder.sentAt).toLocaleDateString()} at {new Date(reminder.sentAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(reminder.status)}`}>
                {reminder.status}
              </div>
            </div>
          ))}
        </div>

        {reminderHistory.length === 0 && (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No reminders sent yet</h4>
            <p className="text-gray-600">Reminder activity will appear here once you start sending reminders.</p>
          </div>
        )}
      </div>

      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
                <input
                  type="text"
                  defaultValue={editingTemplate?.name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Standard Reminder"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
                <input
                  type="text"
                  defaultValue={editingTemplate?.subject || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Reminder: Complete Your Survey"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Body</label>
                <textarea
                  rows={8}
                  defaultValue={editingTemplate?.body || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter your reminder message..."
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowTemplateEditor(false)}
                className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Handle save logic here
                  setShowTemplateEditor(false);
                }}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyReminderManager;