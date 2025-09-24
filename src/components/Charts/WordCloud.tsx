import React from 'react';

interface WordCloudProps {
  words: Array<{
    text: string;
    frequency: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
  }>;
  title?: string;
  maxWords?: number;
}

const WordCloud: React.FC<WordCloudProps> = ({ words, title = "Key Themes", maxWords = 20 }) => {
  // Sort words by frequency and limit
  const sortedWords = words
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, maxWords);
  
  const maxFreq = Math.max(...sortedWords.map(w => w.frequency));
  
  // Generate accessible, colorblind-friendly colors based on sentiment and frequency
  const getWordStyle = (word: { frequency: number; sentiment?: string }) => {
    const intensity = word.frequency / maxFreq;
    const fontSize = 12 + (intensity * 24); // 12px to 36px
    
    let color;
    switch (word.sentiment) {
      case 'positive':
        color = intensity > 0.7 ? 'text-green-700' : 
                intensity > 0.4 ? 'text-green-600' : 'text-green-500';
        break;
      case 'negative':
        color = intensity > 0.7 ? 'text-red-700' : 
                intensity > 0.4 ? 'text-red-600' : 'text-red-500';
        break;
      default:
        color = intensity > 0.7 ? 'text-blue-700' : 
                intensity > 0.4 ? 'text-blue-600' : 'text-blue-500';
    }
    
    return {
      fontSize: `${fontSize}px`,
      className: `${color} font-medium transition-all duration-200 hover:scale-110 cursor-pointer`,
    };
  };

  // Simple layout algorithm - arrange words in rows
  const arrangeWords = () => {
    const rows: typeof sortedWords[][] = [];
    let currentRow: typeof sortedWords = [];
    let currentRowLength = 0;
    const maxRowLength = 100; // Adjust based on container width
    
    sortedWords.forEach(word => {
      const wordLength = word.text.length * (12 + ((word.frequency / maxFreq) * 24) / 16);
      
      if (currentRowLength + wordLength > maxRowLength && currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [word];
        currentRowLength = wordLength;
      } else {
        currentRow.push(word);
        currentRowLength += wordLength;
      }
    });
    
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
    
    return rows;
  };

  const wordRows = arrangeWords();

  return (
    <div className="bg-white rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center space-x-4 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Positive</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Neutral</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Negative</span>
          </div>
        </div>
      </div>
      
      <div className="min-h-64 flex flex-col justify-center">
        {wordRows.map((row, rowIndex) => (
          <div key={rowIndex} className={`flex justify-center items-center flex-wrap gap-2 mb-2 ${rowIndex % 2 === 1 ? 'justify-start' : 'justify-end'}`}>
            {row.map((word, wordIndex) => {
              const style = getWordStyle(word);
              return (
                <span
                  key={`${rowIndex}-${wordIndex}`}
                  className={style.className}
                  style={{ fontSize: style.fontSize }}
                  title={`"${word.text}" mentioned ${word.frequency} times (${word.sentiment || 'neutral'} sentiment)`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Theme: ${word.text}, mentioned ${word.frequency} times, ${word.sentiment || 'neutral'} sentiment`}
                  onClick={() => console.log(`Clicked on "${word.text}"`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      console.log(`Selected "${word.text}"`);
                    }
                  }}
                >
                  {word.text}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Word count and frequency info */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="text-gray-600">Total Themes</div>
            <div className="font-semibold text-gray-900">{sortedWords.length}</div>
          </div>
          <div>
            <div className="text-gray-600">Most Mentioned</div>
            <div className="font-semibold text-gray-900">
              {sortedWords[0]?.text || 'None'} ({sortedWords[0]?.frequency || 0})
            </div>
          </div>
          <div>
            <div className="text-gray-600">Total Mentions</div>
            <div className="font-semibold text-gray-900">
              {sortedWords.reduce((sum, word) => sum + word.frequency, 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordCloud;