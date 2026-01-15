import React, { useEffect, useMemo, useState } from 'react';
import { LazyImage } from '../PerformanceComponents';
import { Link, Outlet, useParams } from 'react-router-dom';
import notificationService from '../../dal/notifications';
import { useAuth } from '../../context/AuthContext';
import { useActiveOrganization } from '../../hooks/useActiveOrganization';

const OrgWorkspaceLayout: React.FC = () => {
  const { orgId } = useParams();
  const { isAuthenticated } = useAuth();
  const { memberships, selectOrganization } = useActiveOrganization({ surface: 'admin' });
  const [orgName, setOrgName] = useState<string>(`Organization ${orgId}`);
  const [allowed, setAllowed] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const membershipForOrg = useMemo(() => {
    if (!orgId) return null;
    return memberships.find((membership) => membership.orgId === orgId) ?? null;
  }, [memberships, orgId]);

  useEffect(() => {
    if (!orgId) return;
    selectOrganization(orgId).catch((error) => {
      console.warn('[OrgWorkspaceLayout] Failed to align active organization with workspace route', error);
    });
  }, [orgId, selectOrganization]);

  useEffect(() => {
    if (membershipForOrg?.organizationName) {
      setOrgName(membershipForOrg.organizationName);
    } else if (orgId) {
      setOrgName(`Organization ${orgId}`);
    }
  }, [membershipForOrg, orgId]);

  // Basic guard: this would be replaced with a real permission check
  useEffect(() => {
    let cancelled = false;

    const evaluateAccess = async () => {
      if (!orgId) {
        setAllowed(false);
        setNotifications([]);
        return;
      }

      const hasMembership = Boolean(membershipForOrg);
      if (hasMembership || isAuthenticated.admin) {
        setAllowed(true);
        try {
          const notes = await notificationService.listNotifications({ orgId });
          if (!cancelled) {
            setNotifications(notes.slice(0, 5));
          }
        } catch (error) {
          console.warn('Failed to load workspace notifications:', error);
          if (!cancelled) {
            setNotifications([]);
          }
        }
        return;
      }

      try {
  const svc = await import('../../dal/clientWorkspace');
        const access = await svc.checkWorkspaceAccess(orgId);
        const canAccess = Boolean(access) || isAuthenticated.admin;
        if (!cancelled) {
          setAllowed(canAccess);
        }

        if (canAccess) {
          const notes = await notificationService.listNotifications({ orgId });
          if (!cancelled) {
            setNotifications(notes.slice(0, 5));
          }
        } else if (!cancelled) {
          setNotifications([]);
        }
      } catch (error) {
        console.error('Failed to evaluate organization workspace access:', error);
        if (!cancelled) {
          setAllowed(isAuthenticated.admin);
          setNotifications([]);
        }
      }
    };

    evaluateAccess();

    return () => {
      cancelled = true;
    };
  }, [orgId, isAuthenticated.admin, membershipForOrg]);

  const [darkMode, setDarkMode] = useState(false);
  return (
    <div className={`p-6 max-w-7xl mx-auto ${darkMode ? 'dark' : ''}`}>
  <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
            <LazyImage
              src="/logo192.png"
              webpSrc="/logo192.webp"
              avifSrc="/logo192.avif"
              srcSet="/logo192.png 1x, /logo192@2x.png 2x"
              sizes="(max-width: 768px) 48px, 64px"
              alt="The Huddle Co. logo"
              fallbackSrc="/default-org-fallback.png"
              className={`h-12 w-12 rounded-full bg-gradient-to-r ${darkMode ? 'from-indigo-900/20 via-charcoal to-ivory' : 'from-sunrise/20 via-indigo-100 to-ivory'}`}
              aria-label="Organization logo for The Huddle Co."
              placeholder={<div className="w-12 h-12 rounded-full bg-mutedgrey animate-pulse" />}
            />
          <div>
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-sunrise' : 'text-sunrise'}`}>{orgName} Workspace</h1>
              <div className={`text-sm ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`}>Private workspace for your organization</div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link to="/client-portal" className={`text-sm ${darkMode ? 'text-sunrise' : 'text-gray-700'}`}>Back to Portal</Link>
        </div>
      </div>

  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {!allowed && (
          <div className={`md:col-span-4 rounded-lg p-8 border text-center ${darkMode ? 'bg-charcoal text-ivorywhite border-indigo-900' : 'bg-white'}`}> 
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className={`text-sm mb-4 ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`}>You must be a member of this organization or a Huddle Co. admin to view this workspace.</p>
            <div className="space-x-2">
              <button onClick={() => alert('Request access (mock)')} className={`px-4 py-2 rounded font-heading btn-cta`}>Request Access</button>
            </div>
          </div>
        )}
  <nav className={`md:col-span-1 rounded-lg p-4 border ${darkMode ? 'bg-charcoal text-ivorywhite border-indigo-900' : 'bg-white'}`}> 
          <ul className="space-y-2">
            <li><Link to="strategic-plans" className={`block p-2 rounded ${darkMode ? 'hover:bg-indigo-900/10' : 'hover:bg-gray-50'}`}>Strategic Plan Drafts</Link></li>
            <li><Link to="session-notes" className={`block p-2 rounded ${darkMode ? 'hover:bg-indigo-900/10' : 'hover:bg-gray-50'}`}>Session Notes & Follow-Ups</Link></li>
            <li><Link to="action-tracker" className={`block p-2 rounded ${darkMode ? 'hover:bg-indigo-900/10' : 'hover:bg-gray-50'}`}>Shared Action Tracker</Link></li>
            <li><Link to="documents" className={`block p-2 rounded ${darkMode ? 'hover:bg-indigo-900/10' : 'hover:bg-gray-50'}`}>Shared Documents</Link></li>
          </ul>
        </nav>
        <div className={`md:col-span-3 ${darkMode ? 'bg-charcoal text-ivorywhite' : ''}`}> 
          {notifications.length > 0 && (
            <div className={`mb-4 rounded-lg p-3 ${darkMode ? 'bg-indigo-900/10 border-indigo-900 text-ivorywhite' : 'bg-yellow-50 border border-yellow-100'}`}> 
              <h4 className="font-semibold">Recent Workspace Notifications</h4>
              <ul className="text-sm mt-2 space-y-1">
                {notifications.map(n => (
                  <li key={n.id}>{n.title} — <span className={darkMode ? 'text-mutedgrey' : 'text-gray-600'}>{new Date(n.createdAt).toLocaleString()}</span></li>
                ))}
              </ul>
            </div>
          )}
          <Outlet />
          {/* Dark mode toggle for Org Workspace */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="px-4 py-2 rounded-xl bg-charcoal text-ivorywhite font-heading hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrgWorkspaceLayout;
