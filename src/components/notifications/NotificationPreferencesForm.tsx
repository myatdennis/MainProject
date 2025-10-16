import { ChangeEvent } from 'react';
import { cn } from '../../utils/cn';
import { useNotificationCenter } from '../../context/NotificationContext';

const ToggleRow = ({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-[#3A7FFF]/40 dark:border-slate-700 dark:bg-slate-900">
    <div className="pr-4">
      <p className="text-sm font-semibold text-slate-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        {label}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-300" style={{ fontFamily: 'Lato, sans-serif' }}>
        {description}
      </p>
    </div>
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        enabled ? 'bg-[#2D9B66]' : 'bg-slate-300',
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3A7FFF]'
      )}
      role="switch"
      aria-checked={enabled}
      aria-label={`Toggle ${label}`}
    >
      <span
        className={cn(
          enabled ? 'translate-x-6' : 'translate-x-1',
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform'
        )}
      />
    </button>
  </div>
);

const NotificationPreferencesForm = () => {
  const { preferences, setPreferences } = useNotificationCenter();

  const handleToggle = (key: keyof typeof preferences) => (value: boolean) => {
    setPreferences({ [key]: value });
  };

  const handleDigestChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPreferences({ digestFrequency: event.target.value as typeof preferences.digestFrequency });
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Notification Preferences
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lato, sans-serif' }}>
          Choose which updates you want to receive and how often we should send summaries.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleRow
          label="Course assignments"
          description="Get alerts the moment a new course or module is assigned to you."
          enabled={preferences.assignments}
          onChange={handleToggle('assignments')}
        />
        <ToggleRow
          label="Course updates"
          description="Stay informed when modules change or new lessons drop."
          enabled={preferences.courseUpdates}
          onChange={handleToggle('courseUpdates')}
        />
        <ToggleRow
          label="Survey reminders"
          description="Receive nudges before surveys become due."
          enabled={preferences.surveyReminders}
          onChange={handleToggle('surveyReminders')}
        />
        <ToggleRow
          label="Celebration messages"
          description="Celebrate milestones with a congratulatory note."
          enabled={preferences.completionCelebrations}
          onChange={handleToggle('completionCelebrations')}
        />
        <ToggleRow
          label="Announcements"
          description="Hear about leadership updates and organization-wide news."
          enabled={preferences.announcements}
          onChange={handleToggle('announcements')}
        />
        <ToggleRow
          label="System updates"
          description="Know about planned maintenance or new LMS features."
          enabled={preferences.systemUpdates}
          onChange={handleToggle('systemUpdates')}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <label className="flex flex-col space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Digest frequency
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lato, sans-serif' }}>
            Receive a summary of unread items delivered straight to your inbox.
          </span>
          <select
            value={preferences.digestFrequency}
            onChange={handleDigestChange}
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="daily">Daily summary</option>
            <option value="weekly">Weekly digest</option>
            <option value="off">Turn off email summaries</option>
          </select>
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ToggleRow
            label="Allow push alerts"
            description="Enable browser and mobile push notifications for instant updates."
            enabled={preferences.allowPush}
            onChange={handleToggle('allowPush')}
          />
          <ToggleRow
            label="Email summaries"
            description="Receive in-app updates as part of an email summary."
            enabled={preferences.emailSummary}
            onChange={handleToggle('emailSummary')}
          />
        </div>
      </div>
    </section>
  );
};

export default NotificationPreferencesForm;
