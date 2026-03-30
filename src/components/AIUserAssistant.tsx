import React, { useState } from 'react';
import { Lightbulb, X } from 'lucide-react';

interface Suggestion {
  id: string;
  field: string;
  message: string;
  suggestion: string;
  autoApplyable?: boolean;
}

interface AIUserAssistantProps {
  values: Record<string, any>;
  errors: Record<string, string>;
  onApplySuggestion: (field: string, value: string) => void;
  onDismissSuggestion: (id: string) => void;
}

const requiredFields = [
  { field: 'firstName', label: 'First Name', min: 2 },
  { field: 'lastName', label: 'Last Name', min: 2 },
  { field: 'email', label: 'Email Address', min: 5 },
  { field: 'role', label: 'Role', min: 2 },
  { field: 'organization', label: 'Organization', min: 1 },
  { field: 'cohort', label: 'Cohort', min: 2 },
];

function generateSuggestions(values: Record<string, any>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  requiredFields.forEach(({ field, label, min }) => {
    if (!values[field] || (typeof values[field] === 'string' && values[field].length < min)) {
      suggestions.push({
        id: `missing-${field}`,
        field,
        message: `${label} is required and should be at least ${min} characters.`,
        suggestion: `Suggest: Fill in a valid ${label.toLowerCase()}.`,
        autoApplyable: false,
      });
    }
  });
  if (values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
    suggestions.push({
      id: 'invalid-email',
      field: 'email',
      message: 'Email address format is invalid.',
      suggestion: 'Suggest: Enter a valid email address.',
      autoApplyable: false,
    });
  }
  return suggestions;
}

const AIUserAssistant: React.FC<AIUserAssistantProps> = ({ values, onDismissSuggestion }) => {
  const [show, setShow] = useState(true);
  const suggestions = generateSuggestions(values);

  if (!show || suggestions.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex items-center mb-2">
        <Lightbulb className="h-5 w-5 text-yellow-500 mr-2" />
        <h4 className="font-semibold text-gray-900">AI User Assistant</h4>
        <button className="ml-auto text-gray-400 hover:text-gray-600" onClick={() => setShow(false)}><X className="h-4 w-4" /></button>
      </div>
      <ul className="space-y-2">
        {suggestions.map(s => (
          <li key={s.id} className="flex items-center justify-between bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded">
            <span className="text-sm text-gray-800">{s.message}</span>
            <button
              className="ml-2 px-2 py-1 text-xs bg-yellow-400 text-white rounded hover:bg-yellow-500"
              onClick={() => onDismissSuggestion(s.id)}
            >Dismiss</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AIUserAssistant;
