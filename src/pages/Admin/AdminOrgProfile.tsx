import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ProfileView from '../../components/ProfileView';

const AdminOrgProfile: React.FC = () => {
  const { orgProfileId } = useParams<{ orgProfileId: string }>();

  if (!orgProfileId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Organization Profile ID Not Found</h3>
          <p className="text-gray-600 mb-4">Please select an organization to view their profile.</p>
          <Link 
            to="/admin/organizations" 
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            Back to Organizations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link 
          to="/admin/organizations" 
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Organizations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Organization Profile</h1>
        <p className="text-gray-600">View organization details, metrics, and manage resources.</p>
      </div>

      <ProfileView 
        profileType="organization" 
        profileId={orgProfileId} 
        isAdmin={true}
      />
    </div>
  );
};

export default AdminOrgProfile;