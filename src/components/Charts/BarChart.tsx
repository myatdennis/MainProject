import React from 'react';

interface BarChartProps {
  data: Array<{
    label: string;
    value: number;
    percentage?: number;
    color?: string;
  }>;
  title?: string;
  height?: number;
  showPercentages?: boolean;
  horizontal?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({ 
  data, 
  title, 
  height = 300, 
  showPercentages = true, 
  horizontal = false 
}) => {
  const maxValue = Math.max(...data.map(item => item.value));
  
  return (
    <div className="bg-white rounded-lg p-6">
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}
      
      <div className={`space-y-3 ${horizontal ? 'flex flex-col' : 'grid grid-cols-1'}`} style={{ height }}>
        {data.map((item, index) => {
          const barWidth = horizontal ? `${(item.value / maxValue) * 100}%` : 'auto';
          const barHeight = horizontal ? '24px' : `${(item.value / maxValue) * (height - 100)}px`;
          const bgColor = item.color || 'bg-gradient-to-r from-orange-400 to-red-500';
          
          return (
            <div key={index} className={horizontal ? 'flex items-center space-x-3' : 'flex flex-col items-center justify-end'}>
              {horizontal && (
                <div className="w-24 text-sm text-gray-700 text-right">{item.label}</div>
              )}
              
              <div className={horizontal ? 'flex-1 flex items-center' : 'w-full flex justify-center mb-2'}>
                <div 
                  className={`${bgColor} rounded ${horizontal ? 'h-6' : 'w-8 min-h-[8px]'} transition-all duration-500 ease-out`}
                  style={horizontal ? { width: barWidth } : { height: barHeight }}
                  title={`${item.label}: ${item.value}${showPercentages && item.percentage ? ` (${item.percentage}%)` : ''}`}
                />
              </div>
              
              {horizontal ? (
                <div className="text-sm font-medium text-gray-900 w-16 text-left">
                  {item.value} {showPercentages && item.percentage && `(${item.percentage}%)`}
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900">{item.value}</div>
                  {showPercentages && item.percentage && (
                    <div className="text-xs text-gray-600">({item.percentage}%)</div>
                  )}
                  <div className="text-xs text-gray-700 mt-1 max-w-20 break-words">{item.label}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BarChart;