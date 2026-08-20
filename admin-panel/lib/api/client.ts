'use client';

/**
 * Browser -> panel API helper.
 *
 * Client components never touch Supabase for business data; they call these
 * routes, which re-check the admin session and use the secret key server-side.
 */

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, headers, ...rest } = init;

  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    throw new ApiError(
      payload?.error || 'Something went wrong. Please try again.',
      response.status
    );
  }

  return payload.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, json?: unknown) => request<T>(path, { method: 'POST', json }),
  put: <T>(path: string, json?: unknown) => request<T>(path, { method: 'PUT', json }),
  patch: <T>(path: string, json?: unknown) => request<T>(path, { method: 'PATCH', json }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /**
   * A file, not JSON. The content-type header is deliberately NOT set: the
   * browser has to add its own multipart boundary, and setting it by hand is
   * the classic way to make the server unable to parse the body.
   */
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>(path, { method: 'POST', body: form });
  },
};
