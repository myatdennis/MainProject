import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/ThemeContext';

const options: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
  description: string;
}> = [
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
    description: 'Light mode for bright environments.'
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
    description: 'Dark mode for low-light focus.'
  },
  {
    value: 'system',
    label: 'Auto',
    icon: Monitor,
    description: 'Follow your operating system preference.'
  }
];

const ThemeToggle = () => {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme preference"
      className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-subtle px-1 py-1 shadow-sm backdrop-blur"
    >
      {options.map(({ value, label, icon: Icon, description }) => {
        const isActive = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${label} theme`}
            title={description}
            onClick={() => setPreference(value)}
            className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors duration-fast focus:outline-none focus-visible:shadow-focus ${
              isActive
                ? 'bg-surface text-primary-strong shadow-card'
                : 'text-muted hover:text-foreground hover:bg-surface'
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? 'text-primary-strong' : 'text-muted'}`} aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
