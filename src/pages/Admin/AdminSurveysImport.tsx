import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import Button from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import apiRequest from '../../utils/apiClient';

interface SurveyImportRow {
  title: string;
  description?: string;
  questions?: Array<{ text: string; type?: string }>;
}

function parseCsvToSurveys(text: string): SurveyImportRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const titleIdx = headers.findIndex((h) => h.toLowerCase() === 'title');
  if (titleIdx === -1) throw new Error('CSV must have a "title" column.');
  const descIdx = headers.findIndex((h) => h.toLowerCase() === 'description');
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    return {
      title: cols[titleIdx] ?? '',
      description: descIdx >= 0 ? cols[descIdx] : undefined,
    };
  }).filter((r) => r.title);
}

function parseJsonToSurveys(text: string): SurveyImportRow[] {
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.filter((s) => typeof s?.title === 'string' && s.title);
}

const AdminSurveysImport: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<SurveyImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ ok: number; failed: number } | null>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setPreview([]);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const rows = file.name.endsWith('.csv') ? parseCsvToSurveys(text) : parseJsonToSurveys(text);
        if (rows.length === 0) throw new Error('No valid surveys found in the file.');
        setPreview(rows.slice(0, 5));
        showToast(`Parsed ${rows.length} survey${rows.length !== 1 ? 's' : ''} — review and import.`, 'info');
        // Store full list for import
        (window as any).__surveyImportRows = rows;
      } catch (err: any) {
        setParseError(err?.message ?? 'Failed to parse file.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const rows: SurveyImportRow[] = (window as any).__surveyImportRows ?? preview;
    if (rows.length === 0) return;
    setImporting(true);
    let ok = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await apiRequest('/api/admin/surveys', {
          method: 'POST',
          body: JSON.stringify({ title: row.title, description: row.description ?? '', questions: row.questions ?? [] }),
        });
        ok++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    setResults({ ok, failed });
    (window as any).__surveyImportRows = undefined;
    if (failed === 0) {
      showToast(`${ok} survey${ok !== 1 ? 's' : ''} imported successfully!`, 'success');
      setTimeout(() => navigate('/admin/surveys'), 1500);
    } else {
      showToast(`${ok} imported, ${failed} failed. Check the console for details.`, 'error');
    }
  };

  return (
    <>
      <SEO title="Import Surveys" description="Bulk import surveys from CSV or JSON." />
      <div className="p-6 max-w-3xl mx-auto">
        <Link
          to="/admin/surveys"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Surveys
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Import Surveys</h1>
        <p className="text-gray-500 text-sm mb-6">
          Upload a <strong>.csv</strong> or <strong>.json</strong> file to bulk-create survey templates.
          CSV must have a <code>title</code> column; JSON must be an array of objects with a <code>title</code> field.
        </p>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          {/* File picker */}
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-lg w-full p-6 text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors"
            >
              <Upload className="h-6 w-6 flex-shrink-0" />
              <span className="text-sm font-medium">
                {fileName ? fileName : 'Click to choose a .csv or .json file'}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Preview (first {preview.length} rows)
              </h2>
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                {preview.map((row, i) => (
                  <li key={i} className="px-4 py-3 text-sm text-gray-800">
                    <span className="font-medium">{row.title}</span>
                    {row.description && <span className="text-gray-500 ml-2">— {row.description}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Import result */}
          {results && (
            <div className={`flex items-start gap-3 rounded-lg p-4 text-sm ${results.failed === 0 ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>{results.ok} imported{results.failed > 0 ? `, ${results.failed} failed` : ''}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/surveys">Cancel</Link>
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={preview.length === 0 || importing || results !== null}
              onClick={() => void handleImport()}
              aria-label="Import surveys"
            >
              {importing ? 'Importing…' : `Import${preview.length > 0 ? ` (${(window as any).__surveyImportRows?.length ?? preview.length})` : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSurveysImport;

