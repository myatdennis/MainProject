import React from 'react';

interface TrendLineProps {
  data: Array<{
    date: string;
    value: number;
    label?: string;
  }>;
  title?: string;
  yAxisLabel?: string;
  height?: number;
  color?: string;
  showPoints?: boolean;
}

const TrendLine: React.FC<TrendLineProps> = ({ 
  data, 
  title = "Trend Over Time", 
  yAxisLabel = "Value",
  height = 300, 
  color = "stroke-orange-500",
  showPoints = true 
}) => {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const minValue = Math.min(...sortedData.map(d => d.value));
  const maxValue = Math.max(...sortedData.map(d => d.value));
  const valueRange = maxValue - minValue;
  const padding = valueRange * 0.1; // 10% padding
  
  const chartMinValue = Math.max(0, minValue - padding);
  const chartMaxValue = maxValue + padding;
  const chartRange = chartMaxValue - chartMinValue;

  const svgWidth = 600;
  const svgHeight = height - 120; // Account for labels and padding
  const leftPadding = 60;
  const rightPadding = 20;
  const topPadding = 20;
  const bottomPadding = 40;
  
  const chartWidth = svgWidth - leftPadding - rightPadding;
  const chartHeight = svgHeight - topPadding - bottomPadding;

  // Calculate points for the line
  const points = sortedData.map((item, index) => {
    const x = leftPadding + (index / (sortedData.length - 1)) * chartWidth;
    const y = topPadding + chartHeight - ((item.value - chartMinValue) / chartRange) * chartHeight;
    return { x, y, ...item };
  });

  // Generate path string for the line
  const pathData = points.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ');

  // Generate gradient area under the line
  const areaPath = `${pathData} L ${points[points.length - 1].x} ${topPadding + chartHeight} L ${leftPadding} ${topPadding + chartHeight} Z`;

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => 
    chartMinValue + (chartRange / (yTicks - 1)) * i
  );

  // X-axis labels (show max 6 labels)
  const maxXLabels = 6;
  const xLabelInterval = Math.max(1, Math.floor(sortedData.length / maxXLabels));
  const xLabels = sortedData.filter((_, index) => index % xLabelInterval === 0 || index === sortedData.length - 1);

  return (
    <div className="bg-white rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      <div className="relative" style={{ height }}>
        <svg width={svgWidth} height={svgHeight} className="overflow-visible">
          {/* Grid lines */}
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" className="stop-color-orange-200" stopOpacity="0.3" />
              <stop offset="100%" className="stop-color-orange-200" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          
          {/* Y-axis grid lines */}
          {yTickValues.map((tick, index) => {
            const y = topPadding + chartHeight - ((tick - chartMinValue) / chartRange) * chartHeight;
            return (
              <g key={index}>
                <line 
                  x1={leftPadding} 
                  y1={y} 
                  x2={leftPadding + chartWidth} 
                  y2={y} 
                  stroke="#e5e7eb" 
                  strokeDasharray="2,2"
                />
                <text 
                  x={leftPadding - 10} 
                  y={y + 4} 
                  textAnchor="end" 
                  className="text-xs fill-gray-600"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            );
          })}
          
          {/* Area under the line */}
          <path 
            d={areaPath} 
            fill={`url(#gradient-${color})`}
            className="transition-all duration-300"
          />
          
          {/* Trend line */}
          <path 
            d={pathData} 
            fill="none" 
            className={`${color} transition-all duration-300`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points */}
          {showPoints && points.map((point, index) => (
            <g key={index}>
              <circle 
                cx={point.x} 
                cy={point.y} 
                r="4" 
                className="fill-white stroke-orange-500 transition-all duration-200 hover:r-6"
                strokeWidth="3"
              />
              {/* Tooltip on hover */}
              <circle 
                cx={point.x} 
                cy={point.y} 
                r="12" 
                fill="transparent"
                className="cursor-pointer"
                title={`${new Date(point.date).toLocaleDateString()}: ${point.value}${point.label ? ` (${point.label})` : ''}`}
              />
            </g>
          ))}
          
          {/* X-axis labels */}
          {xLabels.map((item, index) => {
            const pointIndex = sortedData.indexOf(item);
            const x = leftPadding + (pointIndex / (sortedData.length - 1)) * chartWidth;
            return (
              <text 
                key={index}
                x={x} 
                y={svgHeight - 10} 
                textAnchor="middle" 
                className="text-xs fill-gray-600"
              >
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            );
          })}
          
          {/* Y-axis label */}
          <text 
            x="20" 
            y={svgHeight / 2} 
            textAnchor="middle" 
            className="text-sm fill-gray-700 font-medium"
            transform={`rotate(-90 20 ${svgHeight / 2})`}
          >
            {yAxisLabel}
          </text>
        </svg>
        
        {/* Stats summary */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="text-gray-600">Current</div>
            <div className="font-semibold text-gray-900">
              {sortedData[sortedData.length - 1].value.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Change</div>
            <div className={`font-semibold ${
              sortedData[sortedData.length - 1].value >= sortedData[0].value 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {sortedData.length > 1 
                ? `${sortedData[sortedData.length - 1].value >= sortedData[0].value ? '+' : ''}${((sortedData[sortedData.length - 1].value - sortedData[0].value) / sortedData[0].value * 100).toFixed(1)}%`
                : 'N/A'
              }
            </div>
          </div>
          <div>
            <div className="text-gray-600">Peak</div>
            <div className="font-semibold text-gray-900">
              {maxValue.toFixed(1)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendLine;