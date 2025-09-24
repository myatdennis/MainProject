import React from 'react';

interface LikertHeatmapProps {
  data: Array<{
    questionId: string;
    question: string;
    distribution: number[]; // [1-star, 2-star, 3-star, 4-star, 5-star]
    avgScore: number;
  }>;
  title?: string;
  scaleLabels?: string[];
}

const LikertHeatmap: React.FC<LikertHeatmapProps> = ({ 
  data, 
  title = "Likert Scale Responses", 
  scaleLabels = ["1", "2", "3", "4", "5"] 
}) => {
  // Calculate max value for color scaling
  const maxValue = Math.max(...data.flatMap(item => item.distribution));
  
  // Color intensity function - accessible colors for color-blind users
  const getColorIntensity = (value: number) => {
    const intensity = value / maxValue;
    if (intensity === 0) return 'bg-gray-100';
    if (intensity <= 0.2) return 'bg-blue-100';
    if (intensity <= 0.4) return 'bg-blue-200';
    if (intensity <= 0.6) return 'bg-blue-300';
    if (intensity <= 0.8) return 'bg-blue-400';
    return 'bg-blue-500';
  };

  return (
    <div className="bg-white rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      {/* Header with scale labels */}
      <div className="mb-4">
        <div className="grid grid-cols-12 gap-2 mb-2">
          <div className="col-span-6"></div> {/* Space for question text */}
          <div className="col-span-1 text-center text-xs font-medium text-gray-600">Avg</div>
          {scaleLabels.map((label, index) => (
            <div key={index} className="col-span-1 text-center text-xs font-medium text-gray-600">
              {label}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-end space-x-2 text-xs text-gray-600 mb-4">
          <span>Less</span>
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-gray-100 rounded-sm"></div>
            <div className="w-3 h-3 bg-blue-100 rounded-sm"></div>
            <div className="w-3 h-3 bg-blue-200 rounded-sm"></div>
            <div className="w-3 h-3 bg-blue-300 rounded-sm"></div>
            <div className="w-3 h-3 bg-blue-400 rounded-sm"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Heatmap data */}
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={item.questionId} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-6 text-sm text-gray-700 pr-2">
              {item.question}
            </div>
            <div className="col-span-1 text-center text-sm font-medium text-gray-900">
              {item.avgScore.toFixed(1)}
            </div>
            {item.distribution.map((count, distIndex) => (
              <div key={distIndex} className="col-span-1 relative">
                <div 
                  className={`h-8 rounded-sm border border-gray-200 flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-105 cursor-pointer ${getColorIntensity(count)}`}
                  title={`${scaleLabels[distIndex]}: ${count} responses`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Question ${index + 1}, rating ${scaleLabels[distIndex]}: ${count} responses`}
                >
                  {count > 0 && count}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* Summary stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-600">Total Responses</div>
            <div className="text-lg font-semibold text-gray-900">
              {data.reduce((sum, item) => sum + item.distribution.reduce((a, b) => a + b, 0), 0)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Average Score</div>
            <div className="text-lg font-semibold text-gray-900">
              {(data.reduce((sum, item) => sum + item.avgScore, 0) / data.length).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Questions</div>
            <div className="text-lg font-semibold text-gray-900">{data.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LikertHeatmap;