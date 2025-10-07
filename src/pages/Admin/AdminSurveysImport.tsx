import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { queueSaveSurvey } from '../../services/surveyService';
import type { Survey } from '../../types/survey';

type ParsedSurvey = Partial<Survey> & { __raw?: any };

const AdminSurveysImport: React.FC = () => {
  const [fileContent, setFileContent] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedSurvey[]>([]);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const parseJSON = (txt: string) => {
    try {
      const v = JSON.parse(txt);
      if (Array.isArray(v)) return v as ParsedSurvey[];
      if (typeof v === 'object') return [v as ParsedSurvey];
      throw new Error('JSON must be an object or array');
    } catch (err: any) {
      setError('Invalid JSON: ' + (err.message || err));
      return [];
    }
  };

  const parseCSV = (txt: string): any[] => {
    // Very small CSV parser: expects header line and comma-separated values.
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim());
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
      return obj;
    });
    return rows as ParsedSurvey[];
  };

  // CSV mapping state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{ [header: string]: string }>({});

  const detectCsvHeaders = (txt: string) => {
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return headers;
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const txt = String(reader.result || '');
      setFileContent(txt);
      setError('');
      // Try JSON first, then CSV
      let out: ParsedSurvey[] = [];
      try {
        out = parseJSON(txt);
      } catch {
        out = [];
      }
      if (out.length === 0) {
        const rows = parseCSV(txt);
        const headers = detectCsvHeaders(txt);
        setCsvHeaders(headers);
        // initialize mapping if empty
        if (Object.keys(mapping).length === 0 && headers.length > 0) {
          const defaultMap: any = {};
          headers.forEach(h => {
            const lower = h.toLowerCase();
            if (/(title|name)/.test(lower)) defaultMap[h] = 'title';
            else if (/(desc|description)/.test(lower)) defaultMap[h] = 'description';
            else if (/(type|template)/.test(lower)) defaultMap[h] = 'type';
            else if (/(status)/.test(lower)) defaultMap[h] = 'status';
            else defaultMap[h] = '';
          });
          setMapping(defaultMap);
        }
        out = rows.map(r => ({ ...r, __raw: r }));
      } else {
        setCsvHeaders([]);
        setMapping({});
      }
      setParsed(out);
    };
    reader.onerror = () => setError('Failed reading file');
    reader.readAsText(f);
  };

  const handlePasteJSON = () => {
    setError('');
    const out = parseJSON(fileContent);
    setParsed(out.map(o => ({ ...o, __raw: o })));
  };

  const applyMapping = () => {
    if (!fileContent) return;
    const rows = parseCSV(fileContent);
    const out: ParsedSurvey[] = rows.map(row => {
      const obj: any = {};
      Object.keys(row).forEach((header) => {
        const mapTo = mapping[header];
        if (!mapTo) return;
        try {
          if (mapTo === 'sections' || mapTo === 'settings' || mapTo === 'branding') {
            // expect JSON string in cell
            (obj as any)[mapTo] = row[header] ? JSON.parse(row[header]) : undefined;
          } else {
            (obj as any)[mapTo] = row[header];
          }
        } catch (err) {
          (obj as any)[mapTo] = row[header];
        }
      });
      return { ...obj, __raw: row } as ParsedSurvey;
    });

    setParsed(out);
  };


  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    try {
      for (const item of parsed) {
        const id = (item as any).id || `survey-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const now = new Date().toISOString();
        const survey: Survey = {
          id,
          title: (item.title as string) || ((item as any).name) || 'Untitled Survey',
          description: (item.description as string) || '',
          type: (item.type as any) || 'custom',
          status: (item.status as any) || 'draft',
          createdBy: (item.createdBy as string) || 'admin',
          createdAt: (item.createdAt as string) || now,
          updatedAt: now,
          sections: (item.sections as any) || [],
          branding: (item.branding as any) || {
            primaryColor: '#FF7A59',
            secondaryColor: '#1E293B',
            accentColor: '#0EA5A4',
            fontFamily: { heading: 'Inter', body: 'Inter', highlight: 'Inter' }
          },
          settings: (item.settings as any) || {
            allowAnonymous: false,
            allowSaveAndContinue: true,
            showProgressBar: true,
            randomizeQuestions: false,
            randomizeOptions: false,
            requireCompletion: false,
            accessControl: { requireLogin: false },
            notifications: { sendReminders: false, reminderSchedule: [], completionNotification: false }
          },
          assignedTo: (item.assignedTo as any) || { organizationIds: [], userIds: [], cohortIds: [] },
          totalInvites: 0,
          totalResponses: 0,
          completionRate: 0,
          avgCompletionTime: 0,
          reflectionPrompts: (item.reflectionPrompts as any) || [],
          followUpSurveys: (item.followUpSurveys as any) || [],
          generateHuddleReport: !!item.generateHuddleReport,
          actionStepsEnabled: !!item.actionStepsEnabled,
          benchmarkingEnabled: !!item.benchmarkingEnabled
        };

  // prefer queued save which writes localStorage immediately and batches backend flushes
  // eslint-disable-next-line no-await-in-loop
  await queueSaveSurvey(survey);
      }

      setParsed([]);
      setFileContent('');
      setError('Surveys imported successfully');
    } catch (err: any) {
      setError('Failed to save surveys: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Import Surveys</h1>
      <p className="text-gray-600 mb-6">Upload JSON (full survey objects) or CSV (simple rows) to bulk create or update surveys. Preview parsed entries below before saving.</p>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload file (JSON or CSV)</label>
            <input type="file" accept=".json,.csv,text/csv,application/json" onChange={(e) => handleFile(e.target.files ? e.target.files[0] : null)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Or paste JSON here</label>
            <textarea value={fileContent} onChange={(e) => setFileContent(e.target.value)} className="w-full h-24 border rounded p-2" />
            <div className="mt-2 flex space-x-2">
              <button onClick={handlePasteJSON} className="px-3 py-2 bg-blue-500 text-white rounded">Parse JSON</button>
              <button onClick={() => { setFileContent(''); setParsed([]); setError(''); }} className="px-3 py-2 bg-gray-100 rounded">Clear</button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
        )}

        {csvHeaders.length > 0 && (
          <div className="mt-6 bg-gray-50 p-4 rounded">
            <h4 className="font-medium text-gray-900 mb-2">CSV Column Mapping</h4>
            <p className="text-sm text-gray-600 mb-3">Map CSV columns to survey fields. JSON columns may contain nested objects (sections/settings) as JSON strings.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {csvHeaders.map((h) => (
                <div key={h} className="flex items-center space-x-2">
                  <div className="w-40 text-sm text-gray-700">{h}</div>
                  <select value={mapping[h] || ''} onChange={(e) => setMapping(prev => ({ ...prev, [h]: e.target.value }))} className="flex-1 p-2 border rounded">
                    <option value="">(ignore)</option>
                    <option value="title">title</option>
                    <option value="description">description</option>
                    <option value="type">type</option>
                    <option value="status">status</option>
                    <option value="sections">sections (JSON)</option>
                    <option value="settings">settings (JSON)</option>
                    <option value="branding">branding (JSON)</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={applyMapping} className="px-3 py-2 bg-blue-600 text-white rounded">Apply Mapping</button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <h3 className="font-medium text-gray-900 mb-2">Preview ({parsed.length})</h3>
          {parsed.length === 0 ? (
            <div className="text-sm text-gray-500">No parsed surveys yet. Upload or paste JSON/CSV to preview.</div>
          ) : (
            <div className="space-y-3">
              {parsed.map((p, i) => (
                <div key={i} className="border rounded p-3 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <label className="block text-xs text-gray-600">Title</label>
                      <input
                        value={(p.title as string) || (p as any).name || ''}
                        onChange={(e) => {
                          const next = [...parsed];
                          next[i] = { ...next[i], title: e.target.value };
                          setParsed(next);
                        }}
                        className={`w-full p-2 border rounded ${!((p.title as string) || (p as any).name) ? 'border-red-300' : 'border-gray-300'}`}
                      />

                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600">Type</label>
                          <select
                            value={(p.type as string) || 'custom'}
                            onChange={(e) => {
                                const next = [...parsed];
                                next[i] = { ...next[i], type: e.target.value as any };
                                setParsed(next);
                              }}
                            className="w-full p-2 border border-gray-300 rounded"
                          >
                            <option value="custom">custom</option>
                            <option value="climate-assessment">climate-assessment</option>
                            <option value="inclusion-index">inclusion-index</option>
                            <option value="equity-lens">equity-lens</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600">Status</label>
                          <select
                            value={(p.status as string) || 'draft'}
                            onChange={(e) => {
                                const next = [...parsed];
                                next[i] = { ...next[i], status: e.target.value as any };
                                setParsed(next);
                              }}
                            className="w-full p-2 border border-gray-300 rounded"
                          >
                            <option value="draft">draft</option>
                            <option value="active">active</option>
                            <option value="paused">paused</option>
                            <option value="archived">archived</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-2">
                        <label className="block text-xs text-gray-600">Description (optional)</label>
                        <textarea
                          value={(p.description as string) || ''}
                          onChange={(e) => {
                            const next = [...parsed];
                            next[i] = { ...next[i], description: e.target.value };
                            setParsed(next);
                          }}
                          className="w-full p-2 border border-gray-300 rounded"
                        />
                      </div>
                    </div>

                    <div className="w-40 flex-shrink-0 text-right">
                      <button
                        onClick={() => {
                          const next = parsed.filter((_, idx) => idx !== i);
                          setParsed(next);
                        }}
                        className="text-sm text-red-600 mb-2"
                      >
                        Remove
                      </button>
                      <div className="text-xs text-gray-500 mt-4">Raw preview</div>
                      <pre className="mt-2 text-xs bg-white p-2 rounded max-h-40 overflow-auto">{JSON.stringify(p.__raw || p, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {parsed.length > 0 && (
          <div className="mt-6 flex justify-end space-x-2">
            <Link to="/admin/surveys" className="px-3 py-2 bg-gray-100 rounded">Cancel</Link>
            <button onClick={handleSaveAll} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded">{saving ? 'Saving…' : 'Save All'}</button>
          </div>
        )}
      </div>

      <div className="mt-6 text-right">
        <Link to="/admin/surveys" className="text-sm text-orange-500">← Back to Surveys</Link>
      </div>
    </div>
  );
};

export default AdminSurveysImport;
