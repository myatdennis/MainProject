import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const brandColors = [
    { name: 'Sunrise Orange', value: '#de7b12' },
    { name: 'Deep Red', value: '#D72638' },
    { name: 'Sky Blue', value: '#3A7DFF' },
    { name: 'Forest Green', value: '#228B22' },
    { name: 'Dark Navy', value: '#1E1E22' },
    { name: 'Soft White', value: '#F8F9FB' }
];
const brandFonts = [
    { name: 'Montserrat', usage: 'Headings & display' },
    { name: 'Lato', usage: 'Body copy' },
    { name: 'Quicksand', usage: 'Highlights & supporting labels' }
];
const brandIcons = [
    { name: 'Lucide', usage: 'UI Icons' },
    { name: 'Custom', usage: 'Brand/Logo' }
];
const BrandKitPage = () => {
    return (_jsxs("div", { className: "max-w-4xl mx-auto p-8", children: [_jsx("h1", { className: "text-3xl font-heading font-bold mb-6", children: "Brand Kit" }), _jsxs("section", { className: "mb-8", children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Colors" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-6", children: brandColors.map(color => (_jsxs("div", { className: "flex flex-col items-center", children: [_jsx("div", { className: "w-16 h-16 rounded-full shadow-lg mb-2", style: { background: color.value } }), _jsx("span", { className: "font-medium", children: color.name }), _jsx("span", { className: "text-xs text-mutedgrey uppercase tracking-wide", children: color.value })] }, color.name))) })] }), _jsxs("section", { className: "mb-8", children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Typography" }), _jsx("div", { className: "grid grid-cols-2 gap-6", children: brandFonts.map(font => (_jsxs("div", { className: "flex flex-col items-start", children: [_jsx("span", { className: "font-heading text-lg mb-1", children: font.name }), _jsx("span", { className: "text-sm text-mutedgrey", children: font.usage })] }, font.name))) })] }), _jsxs("section", { className: "mb-8", children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Icons" }), _jsx("div", { className: "grid grid-cols-2 gap-6", children: brandIcons.map(icon => (_jsxs("div", { className: "flex flex-col items-start", children: [_jsx("span", { className: "font-heading text-lg mb-1", children: icon.name }), _jsx("span", { className: "text-sm text-mutedgrey", children: icon.usage })] }, icon.name))) })] }), _jsxs("section", { className: "mb-8", children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Logo" }), _jsxs("div", { className: "flex items-center space-x-6", children: [_jsx("img", { src: "/logo192.png", alt: "The Huddle Co. Logo", className: "h-20 w-20 rounded-full border shadow-lg" }), _jsx("a", { href: "/logo192.png", download: true, className: "px-4 py-2 rounded-xl font-heading transition-colors btn-cta", children: "Download Logo" })] })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Usage Guidelines" }), _jsxs("ul", { className: "list-disc pl-6 text-mutedgrey", children: [_jsx("li", { children: "Use brand colors for primary actions, backgrounds, and highlights." }), _jsx("li", { children: "Headings use Montserrat, body copy leans on Lato, with Quicksand for accents." }), _jsx("li", { children: "Icons should be consistent and accessible." }), _jsx("li", { children: "Logo must be clear and not distorted." })] })] })] }));
};
export default BrandKitPage;
