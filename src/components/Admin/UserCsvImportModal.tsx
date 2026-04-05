import React, { useEffect, useMemo, useState } from 'react';
import { UploadCloud, AlertTriangle, CheckCircle, Download, X } from 'lucide-react';
import LoadingButton from '../LoadingButton';
import Modal from '../Modal';
import { useToast } from '../../context/ToastContext';
import apiRequest from '../../utils/apiClient';
import { resolveUserFacingError } from '../../utils/userFacingError';
import {
  buildFailedRowsCsv,
  buildResultsCsv,
  normalizeUserImportRows,
  parseUserImportCsv,
  validateUserImportRows,
  type ParsedUserImportRow,
  type UserImportIssue,
  type UserImportResult,
} from '../../utils/userImportCsv';

interface UserCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizations: Array<{ id: string; name: string }>;
  onImportComplete?: () => void;
}

const ROLE_OPTIONS = new Set(['owner', 'admin', 'member', 'learner']);

const UserCsvImportModal: React.FC<UserCsvImportModalProps> = ({
  isOpen,
  onClose,
  organizations,
  onImportComplete,
}) => {
  const { showToast } = useToast();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [rows, setRows] = useState<ParsedUserImportRow[]>([]);
  const [issues, setIssues] = useState<UserImportIssue[]>([]);
  const [results, setResults] = useState<UserImportResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [courseMap, setCourseMap] = useState<Map<string, Set<string>>>(new Map());
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFileName(null);
    setRawRows([]);
    setRows([]);
    setIssues([]);
    setResults(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingCourses(true);
    apiRequest<{ data: Array<{ id: string; organization_id?: string }> }>(
      '/api/admin/courses',
      { noTransform: true },
    )
      .then((response) => {
        if (cancelled) return;
        const map = new Map<string, Set<string>>();
        (response.data || []).forEach((course) => {
          const orgId = course.organization_id || 'unknown';
          if (!map.has(orgId)) {
            map.set(orgId, new Set());
          }
          map.get(orgId)?.add(course.id);
        });
        setCourseMap(map);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[UserCsvImportModal] failed to load courses', error);
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const orgIdSet = useMemo(() => new Set(organizations.map((org) => org.id)), [organizations]);

  const issueMap = useMemo(() => new Map(issues.map((issue) => [issue.index, issue.message])), [issues]);
  const hasIssues = issues.length > 0;

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsedRaw = parseUserImportCsv(text);
      const normalized = normalizeUserImportRows(parsedRaw);
      const newIssues = validateUserImportRows(normalized, {
        validOrgIds: orgIdSet,
        validRoles: ROLE_OPTIONS,
        validCourseIdsByOrg: courseMap,
      });
      setRawRows(parsedRaw);
      setRows(normalized);
      setIssues(newIssues);
      setResults(null);
    } catch (error: any) {
      showToast(
        resolveUserFacingError(error, {
          fallback: 'Unable to read CSV file.',
          action: 'Upload a valid CSV and retry.',
        }),
        'error',
      );
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleImport = async () => {
    if (!rawRows.length) {
      showToast('Please choose a CSV file first.', 'error');
      return;
    }
    if (hasIssues) {
      showToast('Fix validation errors before importing.', 'error');
      return;
    }
    setImporting(true);
    try {
      const response = await apiRequest<{ results: UserImportResult[] }>(
        '/api/admin/users/import',
        { method: 'POST', body: { rows: rawRows } },
      );
      setResults(response.results || []);
      onImportComplete?.();
    } catch (error: any) {
      showToast(
        resolveUserFacingError(error, {
          fallback: 'Import failed.',
          action: 'Fix invalid rows and try again.',
        }),
        'error',
      );
    } finally {
      setImporting(false);
    }
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadResults = () => {
    if (!results) return;
    downloadCsv(buildResultsCsv(results), 'user-import-results.csv');
  };

  const handleDownloadFailures = () => {
    if (!issues.length) return;
    downloadCsv(buildFailedRowsCsv(rows, issues), 'user-import-failures.csv');
  };

  const previewRows = rows.slice(0, 5);
  const importStatus = importing ? `Importing ${rows.length} row${rows.length === 1 ? '' : 's'}…` : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Import users via CSV" maxWidth="2xl" closeOnOverlayClick={!importing}>
      <div className="relative z-50 w-full rounded-2xl border border-cloud bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-cloud px-6 py-4">
              <div>
                <h2 className="text-xl font-heading font-semibold text-charcoal">Import users via CSV</h2>
                <p className="text-sm text-gray-500">Upload a CSV file to create or update users in bulk.</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 hover:text-charcoal focus:outline-none focus:ring-2 focus:ring-sunrise"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <a
                  href="/templates/user-import-template.csv"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  download
                >
                  <Download className="h-4 w-4" />
                  Download CSV template
                </a>
                {loadingCourses && (
                  <span className="text-xs text-gray-500">Loading course catalog for validation…</span>
                )}
              </div>

              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">Drag & drop a CSV file here, or click to browse.</p>
                <input
                  type="file"
                  accept=".csv"
                  className="mt-3 text-sm"
                  onChange={handleFileSelect}
                />
                {fileName && (
                  <p className="mt-2 text-xs text-gray-500">Selected file: {fileName}</p>
                )}
              </div>

              {rows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Preview ({rows.length} rows)</p>
                      <p className="text-xs text-gray-500">Showing first {previewRows.length} rows.</p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {hasIssues ? (
                        <span className="inline-flex items-center gap-2 text-deepred">
                          <AlertTriangle className="h-4 w-4" />
                          {issues.length} validation issue(s)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-emerald-600">
                          <CheckCircle className="h-4 w-4" />
                          Ready to import
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="overflow-auto rounded-xl border border-gray-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Organization</th>
                          <th className="px-3 py-2">Role</th>
                          <th className="px-3 py-2">Course IDs</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewRows.map((row) => {
                          const issue = issueMap.get(row.index);
                          return (
                            <tr key={row.index} className="text-gray-700">
                              <td className="px-3 py-2">{row.email || '—'}</td>
                              <td className="px-3 py-2">{row.organizationId || '—'}</td>
                              <td className="px-3 py-2">{row.role || '—'}</td>
                              <td className="px-3 py-2">{row.courseIds.join(' | ') || '—'}</td>
                              <td className="px-3 py-2">
                                {issue ? <span className="text-deepred">{issue}</span> : 'OK'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {hasIssues && (
                    <div className="rounded-lg border border-deepred/30 bg-deepred/5 p-4 text-xs text-deepred">
                      <p className="font-semibold">Fix these issues before importing:</p>
                      <ul className="mt-2 space-y-1">
                        {issues.slice(0, 8).map((issue) => (
                          <li key={issue.index}>
                            Row {issue.index + 1}: {issue.message}
                          </li>
                        ))}
                        {issues.length > 8 && <li>…and {issues.length - 8} more</li>}
                      </ul>
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-2 text-xs text-deepred underline"
                        onClick={handleDownloadFailures}
                      >
                        <Download className="h-3 w-3" />
                        Download failed rows
                      </button>
                    </div>
                  )}
                </div>
              )}

              {results && (
                <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">Import results</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span>Created: {results.filter((r) => r.status === 'created').length}</span>
                    <span>Updated: {results.filter((r) => r.status === 'updated').length}</span>
                    <span>Skipped: {results.filter((r) => r.status === 'skipped').length}</span>
                    <span>Failed: {results.filter((r) => r.status === 'failed').length}</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadResults}
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-800"
                    >
                      <Download className="h-3 w-3" />
                      Download results CSV
                    </button>
                  </div>
                </div>
              )}

              {importStatus && (
                <div className="rounded-lg border border-skyblue/30 bg-skyblue/10 px-4 py-3 text-xs text-skyblue">
                  {importStatus}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-cloud px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                disabled={importing}
              >
                Close
              </button>
              <LoadingButton
                onClick={handleImport}
                loading={importing}
                disabled={importing || !rows.length || hasIssues}
                variant="primary"
              >
                {importing ? 'Importing…' : 'Import users'}
              </LoadingButton>
            </div>
      </div>
    </Modal>
  );
};

export default UserCsvImportModal;
