import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * LMSDownloadsPackage - redirects to the main Downloads page.
 * The bulk-ZIP download feature is not yet available; users are returned
 * to /lms/downloads where individual files can still be accessed.
 */
const LMSDownloadsPackage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/lms/downloads', { replace: true });
  }, [navigate]);

  return null;
};

export default LMSDownloadsPackage;
