import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const EmptyState = ({ title, description, action, illustrationSrc }) => {
    return (_jsxs("div", { className: "card-lg card-hover centered", children: [illustrationSrc && (_jsx("img", { src: illustrationSrc, alt: "", "aria-hidden": true, className: "mx-auto mb-4 h-24 w-24 object-contain" })), _jsx("h3", { className: "h3", children: title }), description && _jsx("p", { className: "measure lead mx-auto", children: description }), action && _jsx("div", { className: "mt-4", children: action })] }));
};
export default EmptyState;
