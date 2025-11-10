import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import SEO from '../components/SEO';
const TestWrapper = ({ children }) => (_jsx(HelmetProvider, { children: _jsx(BrowserRouter, { children: children }) }));
describe('SEO Component', () => {
    it('renders with default title', () => {
        render(_jsxs(TestWrapper, { children: [_jsx(SEO, {}), _jsx("div", { children: "Test content" })] }));
        return waitFor(() => {
            expect(document.title).toBe('MainProject LMS - Modern Learning Management System');
        });
    });
    it('renders with custom title', async () => {
        render(_jsxs(TestWrapper, { children: [_jsx(SEO, { title: "Custom Page Title" }), _jsx("div", { children: "Test content" })] }));
        await waitFor(() => {
            expect(document.title).toBe('Custom Page Title | MainProject LMS');
        });
    });
    it('sets meta description', async () => {
        const customDescription = 'Custom description for testing';
        render(_jsxs(TestWrapper, { children: [_jsx(SEO, { description: customDescription }), _jsx("div", { children: "Test content" })] }));
        await waitFor(() => {
            const metaDescription = document.querySelector('meta[name="description"]');
            expect(metaDescription?.getAttribute('content')).toBe(customDescription);
        });
    });
});
