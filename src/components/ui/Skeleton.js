import { jsx as _jsx } from "react/jsx-runtime";
const Skeleton = ({ variant = 'block', width, height, rounded, className, style, ...rest }) => {
    const classes = ['skeleton'];
    if (variant === 'text')
        classes.push('skeleton-text');
    if (variant === 'avatar')
        classes.push('skeleton-avatar');
    if (variant === 'card')
        classes.push('skeleton-card');
    if (rounded)
        classes.push('rounded-xl');
    const mergedStyle = { ...style };
    if (width)
        mergedStyle.width = width;
    if (height)
        mergedStyle.height = height;
    return _jsx("div", { className: [...classes, className ?? ''].join(' ').trim(), style: mergedStyle, ...rest });
};
export default Skeleton;
