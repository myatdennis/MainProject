import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock3, Shield } from 'lucide-react';
import { integrationsCatalog } from '../../data/integrationsCatalog';

const availabilityBadgeClass: Record<string, string> = {
  supported: 'bg-green-100 text-green-800',
  beta: 'bg-yellow-100 text-yellow-800',
  planned: 'bg-gray-100 text-gray-800',
};

const AdminIntegrationConfig: React.FC = () => {
  const { integrationId } = useParams<{ integrationId: string }>();
  const navigate = useNavigate();

  const config = integrationsCatalog.find((entry) => entry.id === integrationId);

  if (!config) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Integration not found.
        </div>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/integrations')}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Integrations
        </button>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className={`rounded-xl p-3 ${config.bgColor}`}>
                <Icon className={`h-7 w-7 ${config.color}`} />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900">{config.name}</h1>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${availabilityBadgeClass[config.availability]}`}>
                    {config.availability}
                  </span>
                </div>
                <p className="max-w-2xl text-sm text-gray-600 sm:text-base">{config.description}</p>
              </div>
            </div>
            <a
              href={`mailto:support@thehuddleco.com?subject=${encodeURIComponent(`${config.name} integration setup`)}`}
              className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              Contact support
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Setup Summary</h2>
          <p className="mb-6 text-sm text-gray-700">{config.setupSummary}</p>

          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Supported capabilities</h3>
          <div className="mb-6 flex flex-wrap gap-2">
            {config.features.map((feature) => (
              <span key={feature} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {feature}
              </span>
            ))}
          </div>

          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Setup steps
          </h3>
          <ol className="space-y-3 text-sm text-gray-700">
            {config.setupSteps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Shield className="h-5 w-5 text-gray-500" />
              Security notes
            </h2>
            <ul className="space-y-3 text-sm text-gray-700">
              {config.securityNotes.map((note) => (
                <li key={note} className="rounded-lg bg-gray-50 px-4 py-3">
                  {note}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-amber-900">
              <Clock3 className="h-5 w-5" />
              Provisioning model
            </h2>
            <p className="text-sm text-amber-900">
              This portal exposes integration readiness and setup requirements only. Credential issuance, webhook
              rotation, and production activation are handled through audited backend workflows rather than editable
              browser forms.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AdminIntegrationConfig;
