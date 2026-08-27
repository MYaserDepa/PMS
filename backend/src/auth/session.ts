import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { CurrentUser } from './service.js';

const cookieName = 'pms_session';

export class SessionStore {
  private readonly sessions = new Map<string, CurrentUser>();

  create(user: CurrentUser): string {
    const id = randomUUID();
    this.sessions.set(id, user);
    return id;
  }

  currentUser(id: string | undefined): CurrentUser | null {
    return id ? this.sessions.get(id) ?? null : null;
  }

  delete(id: string | undefined): void {
    if (id) this.sessions.delete(id);
  }
}

export function readSessionId(request: Request): string | undefined {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return cookie ? decodeURIComponent(cookie.slice(cookieName.length + 1)) : undefined;
}

export function setSessionCookie(response: Response, id: string, secure: boolean): void {
  response.cookie(cookieName, id, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
}

export function clearSessionCookie(response: Response, secure: boolean): void {
  response.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
}
