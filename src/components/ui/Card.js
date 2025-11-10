import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import cn from '../../utils/cn';
const paddingMap = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
};
const toneMap = {
    default: 'bg-white shadow-card border border-[rgba(31,41,51,0.08)]',
    muted: 'bg-cloud border border-mist shadow-card-sm',
    gradient: 'bg-white shadow-card border border-[rgba(31,41,51,0.08)] bg-[radial-gradient(circle_at_top,var(--color-soft-white)_0%,white_60%)]',
};
export const Card = ({ tone = 'default', withBorder = true, padding = 'md', header, footer, className, children, ...props }) => {
    return (_jsxs("div", { className: cn('rounded-2xl transition-shadow duration-200', toneMap[tone], withBorder ? '' : 'border-none', paddingMap[padding], className), ...props, children: [header && _jsx("div", { className: "mb-4", children: header }), children, footer && _jsx("div", { className: "mt-6 pt-4 border-t border-mist/60", children: footer })] }));
};
export default Card;
