import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const AdminQueueMonitor: React.FC = () => {
  const [queue, setQueue] = useState<any[]>([]);
  const [lastFlush, setLastFlush] = useState<string | null>(null);

  const refresh = async () => {
    const mod = await import('../../services/surveyService');
    setQueue(mod.getQueueSnapshot());
    setLastFlush(mod.getLastFlushTime());
  };

  useEffect(() => {
    refresh();
    let mounted = true;
    import('../../services/surveyService').then(mod => {
      const handler = () => { if (mounted) refresh(); };
      mod.surveyQueueEvents.addEventListener('queuechange', handler);
      mod.surveyQueueEvents.addEventListener('flush', handler);
      return () => { mounted = false; mod.surveyQueueEvents.removeEventListener('queuechange', handler); mod.surveyQueueEvents.removeEventListener('flush', handler); };
    });
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Queue Monitor</h1>
        <div>
          <Link to="/admin/surveys" className="text-sm text-orange-500 mr-4">← Back to Surveys</Link>
          <button onClick={async () => { const mod = await import('../../services/surveyService'); await mod.flushNow(); refresh(); }} className="px-3 py-2 bg-blue-600 text-white rounded">Flush Now</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow-sm border">
        <div className="mb-4 text-sm text-gray-600">Pending items: <strong>{queue.length}</strong></div>
        {lastFlush && <div className="mb-4 text-xs text-gray-500">Last flush: {new Date(lastFlush).toLocaleString()}</div>}
        {queue.length === 0 ? (
          <div className="text-sm text-gray-500">Queue is empty.</div>
        ) : (
          <div className="space-y-3">
            {queue.map((item, idx) => (
              <div key={idx} className="p-3 border rounded">
                <div className="font-medium">{item.title || item.id}</div>
                <div className="text-xs text-gray-600">Status: {item.status || 'draft'}</div>
                <pre className="text-xs mt-2 bg-gray-50 p-2 rounded max-h-40 overflow-auto">{JSON.stringify(item, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminQueueMonitor;
