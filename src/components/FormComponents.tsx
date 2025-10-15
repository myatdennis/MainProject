import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface FormFieldProps {
  label: string;
  error?: string;
  success?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  helpText?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  success,
  required,
  children,
  className = '',
  helpText
}) => {
  const fieldId = React.useId();
  
  return (
    <div className={`space-y-2 ${className}`}>
      <label 
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
      </label>
      
      {React.cloneElement(children as React.ReactElement, {
        id: fieldId,
        'aria-describedby': `${fieldId}-help ${error ? `${fieldId}-error` : ''} ${success ? `${fieldId}-success` : ''}`,
        'aria-invalid': error ? 'true' : 'false',
        className: `${(children as React.ReactElement).props.className} ${
          error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 
          success ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : 
          'border-gray-300 focus:ring-orange-500 focus:border-orange-500'
        }`
      })}
      
      {helpText && (
        <p id={`${fieldId}-help`} className="text-sm text-gray-500">
          {helpText}
        </p>
      )}
      
      {error && (
        <div 
          id={`${fieldId}-error`}
          className="flex items-center space-x-1 text-sm text-red-600"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div 
          id={`${fieldId}-success`}
          className="flex items-center space-x-1 text-sm text-green-600"
          role="alert"
          aria-live="polite"
        >
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
};

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  helpText?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  success,
  helpText,
  className = '',
  required,
  ...props
}) => {
  if (label) {
    return (
      <FormField 
        label={label} 
        error={error} 
        success={success} 
        required={required}
        helpText={helpText}
      >
        <input
          {...props}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${className}`}
        />
      </FormField>
    );
  }

  return (
    <input
      {...props}
      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
        error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 
        success ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : 
        'border-gray-300 focus:ring-orange-500 focus:border-orange-500'
      } ${className}`}
      aria-invalid={error ? 'true' : 'false'}
    />
  );
};

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  success?: string;
  helpText?: string;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  error,
  success,
  helpText,
  className = '',
  required,
  ...props
}) => {
  if (label) {
    return (
      <FormField 
        label={label} 
        error={error} 
        success={success} 
        required={required}
        helpText={helpText}
      >
        <textarea
          {...props}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-vertical ${className}`}
        />
      </FormField>
    );
  }

  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-vertical ${
        error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 
        success ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : 
        'border-gray-300 focus:ring-orange-500 focus:border-orange-500'
      } ${className}`}
      aria-invalid={error ? 'true' : 'false'}
    />
  );
};

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  success?: string;
  helpText?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  error,
  success,
  helpText,
  className = '',
  required,
  options,
  ...props
}) => {
  const selectElement = (
    <select
      {...props}
      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
        error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 
        success ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : 
        'border-gray-300 focus:ring-orange-500 focus:border-orange-500'
      } ${className}`}
      aria-invalid={error ? 'true' : 'false'}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (label) {
    return (
      <FormField 
        label={label} 
        error={error} 
        success={success} 
        required={required}
        helpText={helpText}
      >
        {selectElement}
      </FormField>
    );
  }

  return selectElement;
};

// Validation utilities
export const validators = {
  required: (value: any) => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return 'This field is required';
    }
    return null;
  },
  
  email: (value: string) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Please enter a valid email address';
  },
  
  minLength: (min: number) => (value: string) => {
    if (!value) return null;
    return value.length >= min ? null : `Must be at least ${min} characters`;
  },
  
  maxLength: (max: number) => (value: string) => {
    if (!value) return null;
    return value.length <= max ? null : `Must be no more than ${max} characters`;
  },
  
  pattern: (regex: RegExp, message: string) => (value: string) => {
    if (!value) return null;
    return regex.test(value) ? null : message;
  }
};

export const useFormValidation = <T extends Record<string, any>>(
  initialValues: T,
  validationRules: Partial<Record<keyof T, Array<(value: any) => string | null>>>
) => {
  const [values, setValues] = React.useState<T>(initialValues);
  const [errors, setErrors] = React.useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = React.useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = React.useCallback((name: keyof T, value: any) => {
    const rules = validationRules[name];
    if (!rules) return null;

    for (const rule of rules) {
      const error = rule(value);
      if (error) return error;
    }
    return null;
  }, [validationRules]);

  const setValue = React.useCallback((name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [touched, validateField]);

  const setTouchedField = React.useCallback((name: keyof T) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, values[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [values, validateField]);

  const validateAll = React.useCallback(() => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    Object.keys(validationRules).forEach((key) => {
      const error = validateField(key as keyof T, values[key as keyof T]);
      if (error) {
        newErrors[key as keyof T] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    setTouched(Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    
    return isValid;
  }, [values, validationRules, validateField]);

  return {
    values,
    errors,
    touched,
    setValue,
    setTouchedField,
    validateAll,
    isValid: Object.keys(errors).length === 0
  };
};