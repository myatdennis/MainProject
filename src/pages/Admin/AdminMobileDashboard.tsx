import { Link } from 'react-router-dom';
import { Smartphone, LayoutDashboard, Users, TrendingUp, Settings } from 'lucide-react';

const quickLinks = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Performance', to: '/admin/performance', icon: TrendingUp },
  { label: 'Settings', to: '/admin/settings', icon: Settings }
];

const AdminMobileDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Smartphone className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Admin Mobile Workspace</h1>
            <p className="text-sm text-gray-600">
              Access the most important admin actions in a layout optimized for smaller screens.
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quickLinks.map(link => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="group flex items-center space-x-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-orange-200 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500 transition group-hover:bg-orange-500 group-hover:text-white">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-base font-medium text-gray-900 group-hover:text-orange-600">{link.label}</span>
              </Link>
            );
          })}
        </section>

        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Need the full experience?</h2>
          <p className="text-sm text-gray-600">
            This lightweight dashboard surfaces the most common admin actions. For course creation, advanced analytics, and other
            high-resolution features, switch back to the full admin portal.
          </p>
          <Link
            to="/admin/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Return to full admin portal
          </Link>
        </section>
      </div>
    </div>
  );
};

export default AdminMobileDashboard;
