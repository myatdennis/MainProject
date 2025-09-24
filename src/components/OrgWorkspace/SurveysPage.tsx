import React from 'react';
import { useParams } from 'react-router-dom';
import ClientSurveyDashboard from '../Survey/ClientSurveyDashboard';

const SurveysPage: React.FC = () => {
  const { orgId } = useParams();

  if (!orgId) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Organization ID is required to view surveys.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-6">
        <ClientSurveyDashboard organizationId={orgId} />
      </div>
    </div>
  );
};

export default SurveysPage;