import { jsx as _jsx } from "react/jsx-runtime";
const PageWrapper = ({ children, className }) => {
    return (_jsx("div", { className: `${className || ''} page-wrapper`, children: _jsx("div", { className: "page-inner", children: children }) }));
};
export default PageWrapper;
