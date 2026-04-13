import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Clock } from 'lucide-react';
import ProfileView from '../../components/ProfileView';
import { useToast } from '../../context/ToastContext';
import {
  sendUserMessage,
  listUserMessages,
  type AdminMessageRecord,
} from '../../dal/adminCommunication';

const AdminUserProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { showToast } = useToast();
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<AdminMessageRecord[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    const loadMessages = async () => {
      if (!userId) return;
      setMessagesLoading(true);
      try {
        const response = await listUserMessages(userId);
        setMessages(response ?? []);
      } catch (error) {
        console.error('Failed to load user messages', error);
      } finally {
        setMessagesLoading(false);
      }
    };
    loadMessages();
  }, [userId]);

  const handleSendMessage = async () => {
    if (!userId) return;
    if (!messageForm.body.trim()) {
      showToast('Message body is required.', 'error');
      return;
    }
    setSending(true);
    try {
      await sendUserMessage(userId, {
        subject: messageForm.subject.trim() || undefined,
        body: messageForm.body.trim(),
        channel: 'email',
      });
      showToast('Message sent successfully.', 'success');
      setMessageForm({ subject: '', body: '' });
      const refreshed = await listUserMessages(userId);
      setMessages(refreshed ?? []);
    } catch (error) {
      console.error('Failed to send user message', error);
      showToast('Unable to send message. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (!userId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">User ID Not Found</h3>
          <p className="text-gray-600 mb-4">Please select a user to view their profile.</p>
          <Link 
            to="/admin/users" 
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            Back to Users
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link 
          to="/admin/users" 
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
        <p className="text-gray-600">View user details, learning progress, and manage resources.</p>
      </div>

      <ProfileView profileType="user" profileId={userId} isAdmin />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Send Message
            </h2>
            <span className="text-xs text-gray-500">Delivers via email</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
            <input
              type="text"
              value={messageForm.subject}
              onChange={(e) => setMessageForm((form) => ({ ...form, subject: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Welcome message, reminder, announcement…"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Message</label>
            <textarea
              rows={4}
              value={messageForm.body}
              onChange={(e) => setMessageForm((form) => ({ ...form, body: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Write a personalized note to this learner."
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={sending}
            className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send Message'}
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Message History</h2>
            <span className="text-sm text-gray-500">{messages.length} sent</span>
          </div>
          {messagesLoading ? (
            <p className="text-sm text-gray-500">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-500">No messages logged for this user yet.</p>
          ) : (
            <ul className="space-y-3">
              {messages.slice(0, 5).map((message) => (
                <li key={message.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">{message.subject || 'Untitled message'}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {message.sentAt ? new Date(message.sentAt).toLocaleString() : '—'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {message.channel?.toUpperCase() ?? 'EMAIL'} • {message.status ?? 'queued'}
                  </p>
                  <p className="text-sm text-gray-600 truncate">{message.body || '—'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserProfile;
