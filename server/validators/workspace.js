const asTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeStringArray = (value) =>
  Array.isArray(value)
    ? value.map((entry) => asTrimmedString(entry)).filter(Boolean)
    : [];

const normalizeAttachments = (value) =>
  Array.isArray(value)
    ? value
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          const id = asTrimmedString(entry.id);
          const name = asTrimmedString(entry.name);
          const url = asTrimmedString(entry.url);
          if (!id || !name) {
            return null;
          }
          return {
            id,
            name,
            ...(url ? { url } : {}),
          };
        })
        .filter(Boolean)
    : [];

export const validateStrategicPlanCreate = (body = {}) => {
  const content = asTrimmedString(body.content);
  if (!content) {
    return {
      ok: false,
      code: 'content_required',
      message: 'content is required',
    };
  }

  return {
    ok: true,
    value: {
      content,
      createdBy: asTrimmedString(body.createdBy) || null,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    },
  };
};

export const validateSessionNoteCreate = (body = {}) => {
  const title = asTrimmedString(body.title);
  if (!title) {
    return {
      ok: false,
      code: 'title_required',
      message: 'title is required',
    };
  }

  return {
    ok: true,
    value: {
      title,
      body: asTrimmedString(body.body) || null,
      date: asTrimmedString(body.date) || new Date().toISOString(),
      tags: normalizeStringArray(body.tags),
      attachments: normalizeAttachments(body.attachments),
      createdBy: asTrimmedString(body.createdBy) || null,
    },
  };
};

export const validateActionItemCreate = (body = {}) => {
  const title = asTrimmedString(body.title);
  if (!title) {
    return {
      ok: false,
      code: 'title_required',
      message: 'title is required',
    };
  }

  return {
    ok: true,
    value: {
      title,
      description: asTrimmedString(body.description) || null,
      assignee: asTrimmedString(body.assignee) || null,
      dueDate: asTrimmedString(body.dueDate) || null,
      status: asTrimmedString(body.status) || 'Not Started',
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    },
  };
};

export const validateActionItemUpdate = (body = {}) => {
  const value = {};
  const fieldMap = {
    title: (input) => asTrimmedString(input) || null,
    description: (input) => asTrimmedString(input) || null,
    assignee: (input) => asTrimmedString(input) || null,
    dueDate: (input) => asTrimmedString(input) || null,
    status: (input) => asTrimmedString(input) || null,
    metadata: (input) => (input && typeof input === 'object' ? input : null),
  };

  for (const [key, normalizer] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      value[key] = normalizer(body[key]);
    }
  }

  return {
    ok: true,
    value,
  };
};
