import { jsx as _jsx } from "react/jsx-runtime";
import cn from '../../utils/cn';
const ProgressBar = ({ value, className, tone = 'default', srLabel = 'Progress', }) => {
    const width = Math.max(0, Math.min(100, value));
    // Use design tokens for color/gradient per brand rules
    const trackClass = 'w-full rounded-full bg-mist/60 p-[3px]';
    const barBaseClass = 'h-2 rounded-full transition-all duration-300 ease-out';
    const barStyle = { width: `${width}%` };
    if (tone === 'info') {
        // Info tone: brand blue
        barStyle.background = 'var(--hud-blue)';
    }
    else {
        // Default/success: Blue→Green gradient
        barStyle.backgroundImage = 'var(--gradient-blue-green)';
    }
    return (_jsx("div", { className: cn(trackClass, className), children: _jsx("div", { role: "progressbar", "aria-label": srLabel, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(width), className: barBaseClass, style: barStyle }) }));
};
export default ProgressBar;
