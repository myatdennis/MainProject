import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
const Breadcrumbs = ({ items, separator = '/', className }) => {
    return (_jsx("nav", { "aria-label": "Breadcrumb", className: `breadcrumbs ${className ?? ''}`.trim(), children: items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (_jsxs("span", { className: "flex items-center gap-2", children: [item.to && !isLast ? (_jsx(Link, { to: item.to, children: item.label })) : (_jsx("span", { className: "current", "aria-current": "page", children: item.label })), !isLast && _jsx("span", { "aria-hidden": "true", children: separator })] }, idx));
        }) }));
};
export default Breadcrumbs;
