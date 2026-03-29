import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Download,
  Globe,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { getSurveyById, updateSurvey, deleteSurvey } from '../../dal/surveys';
import type { Survey } from '../../types/survey';

interface SurveyRow {
  id: string;
  survey: Survey | null;
  error: string | null;
}

const StatusBadge: React.FC<{ status: Survey['status'] }> = ({ status }) => {
  const map: Record<Survey['status'], string> = {
    draft: 'bg-gray-100 text-gray-700',
    published: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status]}`}>
      {status}
    </span>
  );
};

const AdminSurveysBulk: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawIds = searchParams.get('ids') || '';
  const ids = rawIds.split(',').map((s) => s.trim()).filter(Boolean);

  const [rows, setRows] = useState<SurveyRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const showToast = (text: string, ok = true) => {
    setToastMessage({ text, ok });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadSurveys = useCallback(async () => {
    if (ids.length === 0) return;
    setIsLoading(true);
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const survey = await getSurveyById(id);
          return { id, survey: survey ?? null, error: survey ? null : 'Survey not found' };
        } catch (err) {
          return { id, survey: null, error: err instanceof Error ? err.message : 'Failed to load' };
        }
      }),
    );
    setRows(results);
    setIsLoading(false);
  }, [rawIds]);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  const validRows = rows.filter((r) => r.survey !== null);
  const errorRows = rows.filter((r) => r.survey === null);

  const handlePublish = async () => {
    setActionLoading('publish');
    let ok = 0;
    let fail = 0;
    for (const row of validRows) {
      try {
        await updateSurvey(row.id, { status: 'published' });
        ok++;
      } catch {
        fail++;
      }
    }
    setActionLoading(null);
    showToast(`Published ${ok} survey${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}.`, fail === 0);
    await loadSurveys();
  };

  const handleArchive = async () => {
    setActionLoading('archive');
    let ok = 0;
    let fail = 0;
    for (const row of validRows) {
      try {
        await updateSurvey(row.id, { status: 'archived' });
        ok++;
      } catch {
        fail++;
      }
    }
    setActionLoading(null);
    showToast(`Archived ${ok} survey${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}.`, fail === 0);
    await loadSurveys();
  };

  const handleExport = () => {
    try {
      const data = validRows.map((r) => r.survey);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `surveys-bulk-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`Exported ${validRows.length} survey${validRows.length !== 1 ? 's' : ''}.`);
    } catch {
      showToast('Export failed.', false);
    }
  };

  const handleDelete = async () => {
    setActionLoading('delete');
    let ok = 0;
    let fail = 0;
    for (const row of validRows) {
      try {
        await deleteSurvey(row.id);
        ok++;
      } catch {
        fail++;
      }
    }
    setActionLoading(null);
    setConfirmDelete(false);
    showToast(`Deleted ${ok} survey${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}.`, fail === 0);
    if (ok > 0) {
      setTimeout(() => navigate('/admin/surveys'), 1500);
    } else {
      await loadSurveys();
    }
  };

  // Guard: no IDs provided
  if (!rawIds) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle className="h-12 w-12 text-orange-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Surveys Selected</h2>
          <p className="text-gray-600 mb-6">Return to the surveys list and select surveys to act on in bulk.</p>
          <button
            onClick={() => navigate('/admin/surveys')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Surveys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${
            toastMessage.ok ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toastMessage.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/admin/surveys')}
          className="inline-flex items-center text-orange-500 hover:text-orange-600 mb-4 font-medium"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Surveys
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Survey Actions</h1>
        <p className="text-gray-600 mt-1">
          {ids.length} survey{ids.length !== 1 ? 's' : ''} selected for bulk action.
        </p>
      </div>

      {/* Action Bar */}
      {!isLoading && validRows.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={handlePublish}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-medium text-sm"
          >
            {actionLoading === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            Publish All
          </button>
          <button
            onClick={handleArchive}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium text-sm"
          >
            {actionLoading === 'archive' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Archive All
          </button>
          <button
            onClick={handleExport}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium text-sm"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 font-medium text-sm ml-auto"
          >
            <Trash2 className="h-4 w-4" />
            Delete All
          </button>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-700 font-semibold">
            <AlertTriangle className="h-5 w-5" />
            Confirm Deletion
          </div>
          <p className="text-sm text-red-600">
            You are about to permanently delete <strong>{validRows.length}</strong> survey{validRows.length !== 1 ? 's' : ''}. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={actionLoading === 'delete'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm"
            >
              {actionLoading === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Yes, Delete All
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <span className="text-lg font-medium">Loading surveys…</span>
        </div>
      )}

      {/* Error rows */}
      {!isLoading && errorRows.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" />
            {errorRows.length} survey{errorRows.length !== 1 ? 's' : ''} could not be loaded
          </div>
          <ul className="space-y-1">
            {errorRows.map((r) => (
              <li key={r.id} className="text-xs text-amber-700 font-mono">
                {r.id.slice(0, 12)}… — {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Survey list */}
      {!isLoading && validRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {validRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between px-5 py-4 gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{row.survey!.title || 'Untitled Survey'}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{row.id.slice(0, 16)}…</p>
              </div>
              <StatusBadge status={row.survey!.status} />
              <span className="text-xs text-gray-400">
                Updated {new Date(row.survey!.updatedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state: all IDs failed */}
      {!isLoading && validRows.length === 0 && rows.length > 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <XCircle className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">None of the selected surveys could be loaded.</p>
          <button
            onClick={() => navigate('/admin/surveys')}
            className="mt-4 text-orange-500 hover:underline text-sm font-medium"
          >
            Back to Surveys
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminSurveysBulk;
