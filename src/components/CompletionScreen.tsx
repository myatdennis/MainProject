import React from 'react';
import { Award, Share2, Download } from 'lucide-react';

interface CompletionScreenProps {
  courseTitle: string;
  certificateUrl?: string;
  onShare?: () => void;
  onDownloadCertificate?: () => void;
  onNextCourse?: () => void;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({
  courseTitle,
  certificateUrl,
  onShare,
  onDownloadCertificate,
  onNextCourse
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gradient-to-br from-blue-50 to-green-50 rounded-xl shadow-lg p-10 text-center animate-fade-in">
      <Award className="w-16 h-16 text-yellow-400 mb-6 animate-bounce" />
      <h1 className="text-3xl font-bold text-green-700 mb-2">Congratulations!</h1>
      <p className="text-lg text-gray-700 mb-6">
        You have completed <span className="font-semibold text-blue-700">{courseTitle}</span>.
      </p>
      {certificateUrl && (
        <button
          onClick={onDownloadCertificate}
          className="mb-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Download className="w-5 h-5 mr-2" />
          <span>Download Certificate</span>
        </button>
      )}
      <button
        onClick={onShare}
        className="mb-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
      >
        <Share2 className="w-5 h-5 mr-2" />
        <span>Share Achievement</span>
      </button>
      <button
        onClick={onNextCourse}
        className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 mt-2"
      >
        Start Next Course
      </button>
    </div>
  );
};

export default CompletionScreen;
