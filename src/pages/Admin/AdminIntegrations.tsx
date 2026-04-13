import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Globe, Key, Shield } from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Button from '../../components/ui/Button';
import { integrationsCatalog, integrationSupportItems } from '../../data/integrationsCatalog';

const badgeClassByAvailability: Record<string, string> = {
  supported: 'bg-green-100 text-green-800',
  beta: 'bg-yellow-100 text-yellow-800',
  planned: 'bg-gray-100 text-gray-800',
};

const tabs = [
  { id: 'catalog', name: 'Catalog', icon: Globe },
  { id: 'api', name: 'API Access', icon: Key },
  { id: 'security', name: 'Provisioning', icon: Shield },
];

const AdminIntegrations = () => {
  const [activeTab, setActiveTab] = useState('catalog');
  const navigate = useNavigate();

  const availabilityTotals = useMemo(
    () =>
      integrationsCatalog.reduce(
        (acc, integration) => {
          acc[integration.availability] += 1;
          return acc;
        },
        { supported: 0, beta: 0, planned: 0 },
      ),
    [],
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Integrations', to: '/admin/integrations' }]} />
      </div>
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Integrations & API</h1>
        <p className="text-sm text-gray-600 sm:text-base">
          Review supported integrations, setup requirements, and the current provisioning model.
        </p>
      </div>

      <div className="card-lg mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex gap-2 overflow-x-auto px-2 py-2 sm:px-6 sm:py-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center space-x-2 rounded-md border-b-2 px-3 py-2 text-sm font-medium sm:rounded-none sm:px-1 sm:py-4 ${
                    activeTab === tab.id
                      ? 'border-orange-500 bg-orange-50 text-orange-600 sm:bg-transparent'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 hover:border-gray-300 sm:hover:bg-transparent'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'catalog' && (
            <div className="space-y-8">
              <p className="text-sm text-gray-600">
                Only integrations with a verified backend contract should be activated for customers. This page now shows
                readiness and setup requirements instead of exposing fake connection state or editable secrets.
              </p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="rounded-xl bg-green-50 p-4">
                  <div className="text-2xl font-bold text-green-600">{availabilityTotals.supported}</div>
                  <div className="text-sm text-green-800">Supported now</div>
                </div>
                <div className="rounded-xl bg-yellow-50 p-4">
                  <div className="text-2xl font-bold text-yellow-600">{availabilityTotals.beta}</div>
                  <div className="text-sm text-yellow-800">Limited beta</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-2xl font-bold text-gray-700">{availabilityTotals.planned}</div>
                  <div className="text-sm text-gray-700">Planned only</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {integrationsCatalog.map((integration) => {
                  const Icon = integration.icon;
                  return (
                    <div key={integration.id} className="card-lg border border-gray-200">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-lg p-2 ${integration.bgColor}`}>
                            <Icon className={`h-6 w-6 ${integration.color}`} />
                          </div>
                          <div>
                            <h2 className="font-bold text-gray-900">{integration.name}</h2>
                            <p className="text-sm text-gray-600">{integration.category}</p>
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClassByAvailability[integration.availability]}`}>
                          {integration.availability}
                        </span>
                      </div>

                      <p className="mb-4 text-sm text-gray-600">{integration.description}</p>

                      <div className="mb-4 flex flex-wrap gap-2">
                        {integration.features.map((feature) => (
                          <span key={feature} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                            {feature}
                          </span>
                        ))}
                      </div>

                      <p className="mb-4 text-sm text-gray-700">{integration.setupSummary}</p>

                      <Button onClick={() => navigate(`/admin/integrations/${integration.id}`)} variant="outline" size="sm">
                        Review Setup
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab !== 'catalog' && (
            <div className="grid gap-6 lg:grid-cols-2">
              {integrationSupportItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-lg bg-gray-100 p-2">
                        <Icon className="h-5 w-5 text-gray-700" />
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900">{item.title}</h2>
                    </div>
                    <p className="mb-5 text-sm text-gray-600">{item.description}</p>
                    <a
                      href={item.href}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      {item.actionLabel}
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminIntegrations;
