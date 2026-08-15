import { NextResponse } from 'next/server';

import { UnauthorizedError } from '@/lib/auth/guard';

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Wraps a route handler so no stack trace, SQL string or Supabase message can
 * ever reach the browser. Real details go to the server log.
 */
export async function handle(
  name: string,
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    return toResponse(error, name);
  }
}

/** Body parsing that fails as a 400, not a 500. */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new BadRequest('Invalid request body.');
  }
}

export class BadRequest extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequest';
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new BadRequest(message);
}

/** Turns a BadRequest into a 400 and anything else into a generic 500. */
export function toResponse(error: unknown, name: string): NextResponse {
  if (error instanceof UnauthorizedError) return fail('Not signed in.', 401);
  if (error instanceof BadRequest) return fail(error.message, error.status);
  console.error(`[api:${name}]`, error);
  return fail(GENERIC_ERROR, 500);
}
