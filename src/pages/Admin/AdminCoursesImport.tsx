import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import type { Course } from '../../store/courseStore';

const AdminCoursesImport: React.FC = () => {
  const [fileContent, setFileContent] = useState<string>('');
  const [parsed, setParsed] = useState<Partial<Course>[]>([]);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const parseJSON = (txt: string) => {
    try {
      const v = JSON.parse(txt);
      if (Array.isArray(v)) return v as Partial<Course>[];
      if (typeof v === 'object') return [v as Partial<Course>];
      throw new Error('JSON must be an object or array');
    } catch (err: any) {
      setError('Invalid JSON: ' + (err.message || err));
      return [];
    }
  };

  const parseCSV = (txt: string): any[] => {
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      // naive CSV parse (no quoted commas)
      const cols = line.split(',').map(c => c.trim());
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
      return obj;
    });
    return rows;
  };

  // CSV mapping state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{ [header: string]: string }>({});

  const detectCsvHeaders = (txt: string) => {
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    return lines[0].split(',').map(h => h.trim());
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const txt = String(reader.result || '');
      setFileContent(txt);
      setError('');
      // try JSON first
      let out = parseJSON(txt);
      if ((out || []).length === 0) {
        const rows = parseCSV(txt);
        const headers = detectCsvHeaders(txt);
        setCsvHeaders(headers);
        if (Object.keys(mapping).length === 0 && headers.length > 0) {
          const defaultMap: any = {};
          headers.forEach(h => {
            const lower = h.toLowerCase();
            if (/(title|name)/.test(lower)) defaultMap[h] = 'title';
            else if (/(desc|description)/.test(lower)) defaultMap[h] = 'description';
            else if (/(status)/.test(lower)) defaultMap[h] = 'status';
            else if (/(difficulty|level)/.test(lower)) defaultMap[h] = 'difficulty';
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

  const applyMapping = () => {
    if (!fileContent) return;
    const rows = parseCSV(fileContent);
    const out: Partial<Course>[] = rows.map(row => {
      const obj: any = {};
      Object.keys(row).forEach(header => {
        const mapTo = mapping[header];
        if (!mapTo) return;
        try {
          if (mapTo === 'modules') {
            obj[mapTo] = row[header] ? JSON.parse(row[header]) : [];
          } else if (mapTo === 'tags' || mapTo === 'prerequisites' || mapTo === 'learningObjectives') {
            obj[mapTo] = row[header] ? row[header].split('|').map((s:any) => s.trim()) : [];
          } else {
            obj[mapTo] = row[header];
          }
        } catch (e) {
          obj[mapTo] = row[header];
        }
      });
      return obj;
    });
    setParsed(out);
  };

  const handlePasteJSON = () => {
    setError('');
    const out = parseJSON(fileContent);
    setParsed(out);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    try {
      for (const item of parsed) {
        const course = item as Course;
        const id = course.id || `course-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const toSave: Course = {
          id,
          title: course.title || 'Untitled Course',
          description: course.description || '',
          status: (course.status as any) || 'draft',
          thumbnail: course.thumbnail || '',
          duration: course.duration || '0 min',
          difficulty: course.difficulty || 'Beginner',
          enrollments: course.enrollments || 0,
          completions: course.completions || 0,
          completionRate: course.completionRate || 0,
          avgRating: course.avgRating || 0,
          totalRatings: course.totalRatings || 0,
          createdBy: course.createdBy || 'admin',
          createdDate: course.createdDate || new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          publishedDate: course.publishedDate,
          dueDate: course.dueDate,
          estimatedTime: course.estimatedTime || '0 minutes',
          prerequisites: course.prerequisites || [],
          learningObjectives: course.learningObjectives || [],
          certification: course.certification,
          tags: course.tags || [],
          modules: course.modules || [],
          keyTakeaways: course.keyTakeaways || [],
          type: course.type || 'Mixed',
          lessons: course.lessons || 0,
          rating: course.rating || 0,
          progress: course.progress || 0
        } as Course;

        // use createCourse to ensure defaults and storage
        const created = courseStore.createCourse(toSave);
        // also save to ensure sync path
        courseStore.saveCourse(created);
      }

      setParsed([]);
      setFileContent('');
      setError('Courses imported successfully');
    } catch (err: any) {
      setError('Failed to save courses: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Import Courses</h1>
      <p className="text-gray-600 mb-6">Upload JSON (course objects) to bulk create or update courses. Preview parsed entries below before saving.</p>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload file (JSON)</label>
            <input type="file" accept=".json,application/json" onChange={(e) => handleFile(e.target.files ? e.target.files[0] : null)} />
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
            <p className="text-sm text-gray-600 mb-3">Map CSV columns to course fields. Use 'modules' column to pass JSON array, and 'tags' or 'prerequisites' separated by |</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {csvHeaders.map((h) => (
                <div key={h} className="flex items-center space-x-2">
                  <div className="w-40 text-sm text-gray-700">{h}</div>
                  <select value={mapping[h] || ''} onChange={(e) => setMapping(prev => ({ ...prev, [h]: e.target.value }))} className="flex-1 p-2 border rounded">
                    <option value="">(ignore)</option>
                    <option value="title">title</option>
                    <option value="description">description</option>
                    <option value="status">status</option>
                    <option value="difficulty">difficulty</option>
                    <option value="modules">modules (JSON)</option>
                    <option value="tags">tags (pipe-separated)</option>
                    <option value="prerequisites">prerequisites (pipe-separated)</option>
                    <option value="learningObjectives">learningObjectives (pipe-separated)</option>
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
            <div className="text-sm text-gray-500">No parsed courses yet. Upload or paste JSON to preview.</div>
          ) : (
            <div className="space-y-3">
              {parsed.map((p, i) => (
                <div key={i} className="border rounded p-3 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <label className="block text-xs text-gray-600">Title</label>
                      <input
                        value={p.title || ''}
                        onChange={(e) => {
                          const next = [...parsed];
                          next[i] = { ...next[i], title: e.target.value };
                          setParsed(next);
                        }}
                        className={`w-full p-2 border rounded ${!p.title ? 'border-red-300' : 'border-gray-300'}`}
                      />

                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600">Status</label>
                          <select
                            value={(p.status as any) || 'draft'}
                            onChange={(e) => {
                              const next = [...parsed];
                              next[i] = { ...next[i], status: e.target.value as any };
                              setParsed(next);
                            }}
                            className="w-full p-2 border border-gray-300 rounded"
                          >
                            <option value="draft">draft</option>
                            <option value="published">published</option>
                            <option value="archived">archived</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600">Difficulty</label>
                          <select
                            value={(p.difficulty as any) || 'Beginner'}
                            onChange={(e) => {
                              const next = [...parsed];
                              next[i] = { ...next[i], difficulty: e.target.value as any };
                              setParsed(next);
                            }}
                            className="w-full p-2 border border-gray-300 rounded"
                          >
                            <option value="Beginner">Beginner</option>
                            <option value="Intermediate">Intermediate</option>
                            <option value="Advanced">Advanced</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-2">
                        <label className="block text-xs text-gray-600">Description (optional)</label>
                        <textarea
                          value={p.description || ''}
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
                      <pre className="mt-2 text-xs bg-white p-2 rounded max-h-40 overflow-auto">{JSON.stringify(p, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {parsed.length > 0 && (
          <div className="mt-6 flex justify-end space-x-2">
            <Link to="/admin/courses" className="px-3 py-2 bg-gray-100 rounded">Cancel</Link>
            <button onClick={handleSaveAll} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded">{saving ? 'Saving…' : 'Save All'}</button>
          </div>
        )}
      </div>

      <div className="mt-6 text-right">
        <Link to="/admin/courses" className="text-sm text-orange-500">← Back to Courses</Link>
      </div>
    </div>
  );
};

export default AdminCoursesImport;
