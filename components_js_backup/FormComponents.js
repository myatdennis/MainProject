import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
export const FormField = ({ label, error, success, required, children, className = '', helpText }) => {
    const fieldId = React.useId();
    return (_jsxs("div", { className: `space-y-2 ${className}`, children: [_jsxs("label", { htmlFor: fieldId, className: "block text-sm font-medium text-gray-700", children: [label, required && _jsx("span", { className: "text-red-500 ml-1", "aria-label": "required", children: "*" })] }), React.cloneElement(children, {
                id: fieldId,
                'aria-describedby': `${fieldId}-help ${error ? `${fieldId}-error` : ''} ${success ? `${fieldId}-success` : ''}`,
                'aria-invalid': error ? 'true' : 'false',
                className: `${children.props.className} ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
                    success ? 'border-green-300 focus:ring-green-500 focus:border-green-500' :
                        'border-gray-300 focus:ring-orange-500 focus:border-orange-500'}`
            }), helpText && (_jsx("p", { id: `${fieldId}-help`, className: "text-sm text-gray-500", children: helpText })), error && (_jsxs("div", { id: `${fieldId}-error`, className: "flex items-center space-x-1 text-sm text-red-600", role: "alert", "aria-live": "polite", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), success && (_jsxs("div", { id: `${fieldId}-success`, className: "flex items-center space-x-1 text-sm text-green-600", role: "alert", "aria-live": "polite", children: [_jsx(CheckCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: success })] }))] }));
};
export const FormInput = ({ label, error, success, helpText, className = '', required, ...props }) => {
    if (label) {
        return (_jsx(FormField, { label: label, error: error, success: success, required: required, helpText: helpText, children: _jsx("input", { ...props, className: `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${className}` }) }));
    }
    return (_jsx("input", { ...props, className: `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
            success ? 'border-green-300 focus:ring-green-500 focus:border-green-500' :
                'border-gray-300 focus:ring-orange-500 focus:border-orange-500'} ${className}`, "aria-invalid": error ? 'true' : 'false' }));
};
export const FormTextarea = ({ label, error, success, helpText, className = '', required, ...props }) => {
    if (label) {
        return (_jsx(FormField, { label: label, error: error, success: success, required: required, helpText: helpText, children: _jsx("textarea", { ...props, className: `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-vertical ${className}` }) }));
    }
    return (_jsx("textarea", { ...props, className: `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-vertical ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
            success ? 'border-green-300 focus:ring-green-500 focus:border-green-500' :
                'border-gray-300 focus:ring-orange-500 focus:border-orange-500'} ${className}`, "aria-invalid": error ? 'true' : 'false' }));
};
export const FormSelect = ({ label, error, success, helpText, className = '', required, options, ...props }) => {
    const selectElement = (_jsx("select", { ...props, className: `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
            success ? 'border-green-300 focus:ring-green-500 focus:border-green-500' :
                'border-gray-300 focus:ring-orange-500 focus:border-orange-500'} ${className}`, "aria-invalid": error ? 'true' : 'false', children: options.map((option) => (_jsx("option", { value: option.value, disabled: option.disabled, children: option.label }, option.value))) }));
    if (label) {
        return (_jsx(FormField, { label: label, error: error, success: success, required: required, helpText: helpText, children: selectElement }));
    }
    return selectElement;
};
// Validation utilities
export const validators = {
    required: (value) => {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            return 'This field is required';
        }
        return null;
    },
    email: (value) => {
        if (!value)
            return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : 'Please enter a valid email address';
    },
    minLength: (min) => (value) => {
        if (!value)
            return null;
        return value.length >= min ? null : `Must be at least ${min} characters`;
    },
    maxLength: (max) => (value) => {
        if (!value)
            return null;
        return value.length <= max ? null : `Must be no more than ${max} characters`;
    },
    pattern: (regex, message) => (value) => {
        if (!value)
            return null;
        return regex.test(value) ? null : message;
    }
};
export const useFormValidation = (initialValues, validationRules) => {
    const [values, setValues] = React.useState(initialValues);
    const [errors, setErrors] = React.useState({});
    const [touched, setTouched] = React.useState({});
    const validateField = React.useCallback((name, value) => {
        const rules = validationRules[name];
        if (!rules)
            return null;
        for (const rule of rules) {
            const error = rule(value);
            if (error)
                return error;
        }
        return null;
    }, [validationRules]);
    const setValue = React.useCallback((name, value) => {
        setValues(prev => ({ ...prev, [name]: value }));
        if (touched[name]) {
            const error = validateField(name, value);
            setErrors(prev => ({ ...prev, [name]: error }));
        }
    }, [touched, validateField]);
    const setTouchedField = React.useCallback((name) => {
        setTouched(prev => ({ ...prev, [name]: true }));
        const error = validateField(name, values[name]);
        setErrors(prev => ({ ...prev, [name]: error }));
    }, [values, validateField]);
    const validateAll = React.useCallback(() => {
        const newErrors = {};
        let isValid = true;
        Object.keys(validationRules).forEach((key) => {
            const error = validateField(key, values[key]);
            if (error) {
                newErrors[key] = error;
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
