export { default as BarChart } from './BarChart';
export { default as LikertHeatmap } from './LikertHeatmap';
export { default as WordCloud } from './WordCloud';
export { default as TrendLine } from './TrendLine';

// Chart utility types and functions
export interface ChartData {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
}

export interface TrendData {
  date: string;
  value: number;
  label?: string;
}

export interface WordData {
  text: string;
  frequency: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface LikertData {
  questionId: string;
  question: string;
  distribution: number[];
  avgScore: number;
}

// Accessible, color-blind friendly color palettes
export const chartColors = {
  primary: [
    'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500', 
    'bg-teal-500', 'bg-pink-500', 'bg-indigo-500', 'bg-red-500'
  ],
  gradients: [
    'bg-gradient-to-r from-blue-400 to-blue-600',
    'bg-gradient-to-r from-green-400 to-green-600',
    'bg-gradient-to-r from-orange-400 to-orange-600',
    'bg-gradient-to-r from-purple-400 to-purple-600',
  ],
  sentiment: {
    positive: 'text-green-600',
    neutral: 'text-blue-600',
    negative: 'text-red-600'
  }
};