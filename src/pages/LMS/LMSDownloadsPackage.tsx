import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

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

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center px-6 py-12 lg:px-10">
      <Card tone="muted" className="w-full text-center" padding="lg">
        <div className="mx-auto mb-4 flex justify-center">
          <LoadingSpinner size="md" />
        </div>
        <h1 className="font-heading text-xl font-semibold text-charcoal">Redirecting to downloads</h1>
        <p className="mt-2 text-sm text-slate/75">
          Package downloads are still rolling out. We&apos;re taking you to your downloads library now.
        </p>
        <div className="mt-4">
          <Link to="/lms/downloads" className="text-sm font-medium text-skyblue hover:underline">
            Continue manually
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default LMSDownloadsPackage;
