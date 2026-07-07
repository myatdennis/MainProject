import { getSupabaseAdminClient } from '../lib/supabaseClient.js';

// Fetches a fresh admin client on every call instead of closing over a
// `supabase` reference captured once at router-construction time. The
// module-level `supabase` variable in index.js starts null and is only
// assigned after an async connection retry resolves; createDocumentsRouter
// runs synchronously at server startup, long before that resolves, so a
// repository built from that snapshot was permanently stuck with a null
// client for the lifetime of the process — every /api/admin/documents (and
// /api/client/documents) request 500'd forever, even though the connection
// had long since succeeded. getSupabaseAdminClient() builds directly from
// env vars on demand and isn't tied to that connection-retry timing.
export const createDocumentsRepository = () => ({
  listDocuments: async (buildQuery) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await buildQuery(supabase.from('documents').select('*'));
    if (error) throw error;
    return data || [];
  },
  selectDocumentById: async (id, columns = '*') => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('documents').select(columns).eq('id', id).maybeSingle();
    if (error) throw error;
    return data || null;
  },
  insertDocument: async (payload) => {
    const supabase = getSupabaseAdminClient();
    const result = await supabase.from('documents').insert(payload).select('*');
    return result;
  },
  updateDocumentById: async (id, payload) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('documents').update(payload).eq('id', id).select('*');
    if (error) throw error;
    return data || [];
  },
  deleteDocumentById: async (id) => {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;
  },
  incrementDownload: async (id) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc('increment_document_download', { doc_id: id });
    if (error) throw error;
    return data || null;
  },
});

export default createDocumentsRepository;
