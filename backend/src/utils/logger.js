function text(value, fallback, maxLength = 100) {
  if (value == null || value === '') return fallback;
  return String(value).replace(/[\r\n\t]/g, ' ').slice(0, maxLength);
}

export function log(level, event, fields = {}) {
  const record = {
    time: new Date().toISOString(),
    level,
    event,
    ...fields
  };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(record));
}

// Never include messages, headers, request bodies, SQL or stack traces: they can contain health data or secrets.
export function logError(event, error, fields = {}) {
  log('error', event, {
    ...fields,
    errorName: text(error?.name, 'Error'),
    errorCode: text(error?.code ?? error?.errno, 'UNEXPECTED')
  });
}
