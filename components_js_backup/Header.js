import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, Zap } from 'lucide-react';
import Button from './ui/Button';
import Input from './ui/Input';
import cn from '../utils/cn';
const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();
    const navigation = [
        { name: 'Home', href: '/' },
        { name: 'Courses', href: '/courses' },
        { name: 'Resources', href: '/resources' },
        { name: 'About', href: '/about' },
        { name: 'Contact', href: '/contact' },
    ];
    const navigate = useNavigate();
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    const isActive = (href) => location.pathname === href;
    return (_jsxs("header", { className: `sticky top-0 z-50 border-b border-mist/60 bg-softwhite/95 backdrop-blur supports-[backdrop-filter]:bg-softwhite/80 transition-shadow ${scrolled ? 'shadow-[0_6px_24px_rgba(16,24,40,0.08)]' : ''}`, "aria-label": "Primary navigation", role: "navigation", children: [_jsxs("div", { className: "mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12", children: [_jsx(Link, { to: "/", "aria-label": "Go to home", className: "flex items-center gap-3 no-underline", children: _jsx("img", { src: "/logo.svg", alt: "Huddle Co.", className: "h-12 w-12 rounded-2xl shadow-card-sm" }) }), _jsx("nav", { className: "hidden lg:flex items-center gap-2", "aria-label": "Main navigation", children: navigation.map((item) => (_jsx(Link, { to: item.href, "aria-current": isActive(item.href) ? 'page' : undefined, className: `nav-link ${isActive(item.href) ? 'is-active' : ''}`, children: item.name }, item.name))) }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "hidden md:flex items-center gap-2 rounded-full border border-mist bg-white px-3 py-1.5 shadow-sm", children: [_jsx(Search, { className: "h-4 w-4 text-slate/70" }), _jsx(Input, { placeholder: "Search courses", className: "w-40 border-none p-0 text-sm text-charcoal focus-visible:ring-0 focus-visible:ring-offset-0" })] }), _jsx(Button, { variant: "ghost", size: "sm", className: "hidden md:inline-flex", leadingIcon: _jsx(Zap, { className: "h-4 w-4" }), children: "Demo Mode" }), _jsx(Link, { to: "/lms/login", className: cn('hidden sm:inline-flex h-11 items-center justify-center rounded-lg border border-skyblue/30 px-4 text-sm font-semibold text-skyblue transition-colors hover:bg-skyblue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite'), children: "Client Login" }), _jsx("button", { type: "button", onClick: () => navigate('/admin/login'), className: "inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-heading font-semibold shadow-card-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite btn-cta", children: "Admin Portal" }), _jsx("button", { onClick: () => setIsMenuOpen(!isMenuOpen), "aria-expanded": isMenuOpen, "aria-label": isMenuOpen ? 'Close menu' : 'Open menu', className: "ml-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-mist text-charcoal lg:hidden", children: isMenuOpen ? _jsx(X, { className: "h-5 w-5" }) : _jsx(Menu, { className: "h-5 w-5" }) })] })] }), isMenuOpen && (_jsx("div", { className: "border-t border-mist/60 bg-softwhite lg:hidden", children: _jsxs("div", { className: "mx-auto flex max-w-7xl flex-col gap-2 px-6 py-4", children: [navigation.map((item) => (_jsx(Link, { to: item.href, onClick: () => setIsMenuOpen(false), className: `nav-link ${isActive(item.href) ? 'is-active' : ''}`, children: item.name }, item.name))), _jsxs("div", { className: "mt-2 grid grid-cols-2 gap-2", children: [_jsx(Link, { to: "/lms/login", onClick: () => setIsMenuOpen(false), className: "inline-flex h-11 items-center justify-center rounded-lg border border-skyblue/30 text-sm font-semibold text-skyblue transition hover:bg-skyblue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite", children: "Client" }), _jsx(Link, { to: "/admin/login", onClick: () => setIsMenuOpen(false), className: "inline-flex h-11 items-center justify-center rounded-lg text-sm font-heading font-semibold shadow-card-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite btn-cta", children: "Admin" })] })] }) }))] }));
};
export default Header;
