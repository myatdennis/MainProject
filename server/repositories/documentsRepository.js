export const createDocumentsRepository = ({ supabase }) => ({
  listDocuments: async (buildQuery) => {
    const { data, error } = await buildQuery(supabase.from('documents').select('*'));
    if (error) throw error;
    return data || [];
  },
  selectDocumentById: async (id, columns = '*') => {
    const { data, error } = await supabase.from('documents').select(columns).eq('id', id).maybeSingle();
    if (error) throw error;
    return data || null;
  },
  insertDocument: async (payload) => {
    const result = await supabase.from('documents').insert(payload).select('*');
    return result;
  },
  updateDocumentById: async (id, payload) => {
    const { data, error } = await supabase.from('documents').update(payload).eq('id', id).select('*');
    if (error) throw error;
    return data || [];
  },
  deleteDocumentById: async (id) => {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;
  },
  incrementDownload: async (id) => {
    const { data, error } = await supabase.rpc('increment_document_download', { doc_id: id });
    if (error) throw error;
    return data || null;
  },
});

export default createDocumentsRepository;
