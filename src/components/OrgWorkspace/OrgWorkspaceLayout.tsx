import React, { useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const OrgWorkspaceLayout: React.FC = () => {
  const { orgId } = useParams();
  const { isAuthenticated } = useAuth();
  const [orgName] = useState<string>(`Organization ${orgId}`);
  const [allowed, setAllowed] = useState<boolean>(false);

  // Basic guard: this would be replaced with a real permission check
  useEffect(() => {
    // Front-end membership check: localStorage flag or admin
    const memberFlag = orgId ? localStorage.getItem(`huddle_org_${orgId}_member`) === 'true' : false;
    const admin = isAuthenticated.admin;
    setAllowed(memberFlag || admin);
  }, [orgId]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
            <img src="/logo192.png" alt="The Huddle Co." className="h-12 w-12 rounded" />
          <div>
              <h1 className="text-2xl font-bold text-orange-600">{orgName} Workspace</h1>
              <div className="text-sm text-gray-600">Private workspace for your organization</div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link to="/client-portal" className="text-sm text-gray-700">Back to Portal</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {!allowed && (
          <div className="md:col-span-4 bg-white rounded-lg p-8 border text-center">
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-sm text-gray-600 mb-4">You must be a member of this organization or a Huddle Co. admin to view this workspace.</p>
            <div className="space-x-2">
              <button onClick={() => alert('Request access (mock)')} className="px-4 py-2 bg-orange-500 text-white rounded">Request Access</button>
            </div>
          </div>
        )}
        <nav className="md:col-span-1 bg-white rounded-lg p-4 border">
          <ul className="space-y-2">
            <li><Link to="strategic-plans" className="block p-2 rounded hover:bg-gray-50">Strategic Plan Drafts</Link></li>
            <li><Link to="session-notes" className="block p-2 rounded hover:bg-gray-50">Session Notes & Follow-Ups</Link></li>
            <li><Link to="action-tracker" className="block p-2 rounded hover:bg-gray-50">Shared Action Tracker</Link></li>
          </ul>
        </nav>
        <div className="md:col-span-3">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default OrgWorkspaceLayout;
