import { jsx as _jsx } from "react/jsx-runtime";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
const CompletionChart = ({ data = [] }) => {
    const labels = data.map((d) => d.label);
    const values = data.map((d) => d.value);
    const chartData = {
        labels,
        datasets: [
            {
                label: 'Completion %',
                data: values,
                backgroundColor: 'rgba(58, 123, 255, 0.8)'
            }
        ]
    };
    return _jsx("div", { style: { maxWidth: 800 }, children: _jsx(Bar, { data: chartData }) });
};
export default CompletionChart;
