import React, { useState } from 'react';
import ResourceSender from '../../components/ResourceSender';

const AdminResourceSender: React.FC = () => {
  const [sentResources, setSentResources] = useState<any[]>([]);

  const handleResourceSent = (resource: any, profileType: 'user' | 'organization', profileId: string) => {
    setSentResources(prev => [...prev, { resource, profileType, profileId, sentAt: new Date() }]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Send Resources</h1>
        <p className="text-gray-600">
          Send documents, links, notes, and other resources directly to user or organization profiles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ResourceSender onResourceSent={handleResourceSent} />
        </div>

        {/* Recent Activity Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            {sentResources.length === 0 ? (
              <p className="text-gray-500 text-sm">No resources sent yet.</p>
            ) : (
              <div className="space-y-3">
                {sentResources.slice(-5).reverse().map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium text-sm text-gray-900">
                      {item.resource.title}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Sent to {item.profileType} • {item.sentAt.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminResourceSender;