export const HttpStatus = {
  OK: 200,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const HttpMethod = { POST: 'POST' } as const;
export const JSON_CONTENT_TYPE = 'application/json';
