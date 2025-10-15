import React, { useState } from 'react';
import { X, Info } from 'lucide-react';

const DemoModeBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  
  // Check if we're in demo mode
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const isDemoMode = !supabaseUrl || !supabaseAnonKey;
  
  // Don't show banner if not in demo mode or if user closed it
  if (!isDemoMode || !isVisible) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Info className="h-5 w-5 text-blue-400 mr-3" />
          <div>
            <p className="text-sm text-blue-800">
              <strong>Demo Mode:</strong> You're viewing a demonstration of The Huddle Co platform. 
              All data is simulated and progress is stored locally. 
              <a 
                href="mailto:contact@thehuddleco.com" 
                className="underline ml-1 hover:text-blue-900"
              >
                Contact us to get started with your organization
              </a>
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-blue-400 hover:text-blue-600 transition-colors"
          aria-label="Close demo banner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default DemoModeBanner;