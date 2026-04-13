import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createDocumentsController = ({ logger, service }) => ({
  clientList: async (req, res) => {
    try {
      const result = await service.listClientDocuments({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('client_documents_list_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return sendError(res, 500, 'documents_fetch_failed', 'Unable to fetch documents');
    }
  },
  adminList: async (req, res) => {
    try {
      const result = await service.listAdminDocuments({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_documents_list_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return sendError(res, 500, 'documents_fetch_failed', 'Unable to fetch documents');
    }
  },
  adminCreate: async (req, res) => {
    try {
      const result = await service.createAdminDocument({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_documents_create_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return sendError(res, 500, 'document_create_failed', 'Unable to create document');
    }
  },
  adminUpdate: async (req, res) => {
    try {
      const result = await service.updateAdminDocument({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      return sendError(res, 500, 'document_update_failed', 'Unable to update document');
    }
  },
  adminDownload: async (req, res) => {
    try {
      const result = await service.adminDownloadDocument({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      return sendError(res, 500, 'document_download_failed', 'Unable to record download');
    }
  },
  clientDownload: async (req, res) => {
    try {
      const result = await service.clientDownloadDocument({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      return sendError(res, 500, 'document_download_failed', 'Unable to record download');
    }
  },
  adminDelete: async (req, res) => {
    try {
      const result = await service.deleteAdminDocument({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      if (result.status === 204) return res.status(204).end();
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      return sendError(res, 500, 'document_delete_failed', 'Unable to delete document');
    }
  },
});

export default createDocumentsController;
