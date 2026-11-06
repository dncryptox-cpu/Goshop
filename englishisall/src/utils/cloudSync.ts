import type { UserSession, CloudDataPayload, AppsScriptResponse } from '../types';

const KEYS = {
  SESSION: 'en_terminal_session',
  APPS_SCRIPT_URL: 'en_terminal_apps_script_url',
};

// Default Google Apps Script Web App URL if not provided by user
export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzQ7p9-V81g5jL52402123456789/exec';

export function getStoredSession(): UserSession | null {
  const raw = localStorage.getItem(KEYS.SESSION);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s && s.username && s.password) return s;
    return null;
  } catch {
    return null;
  }
}

export function saveSession(session: UserSession): void {
  localStorage.setItem(KEYS.SESSION, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(KEYS.SESSION);
}

export function getStoredAppsScriptUrl(): string {
  return localStorage.getItem(KEYS.APPS_SCRIPT_URL) || DEFAULT_APPS_SCRIPT_URL;
}

export function saveAppsScriptUrl(url: string): void {
  localStorage.setItem(KEYS.APPS_SCRIPT_URL, url.trim());
}

/**
 * Execute HTTP POST call to Google Apps Script Web App.
 * Uses text/plain contentType to avoid CORS preflight issues with GAS.
 */
async function callAppsScript(url: string, bodyObj: any): Promise<AppsScriptResponse> {
  const endpoint = url.trim() || DEFAULT_APPS_SCRIPT_URL;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(bodyObj),
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script HTTP error (${response.status})`);
    }

    const resText = await response.text();
    let data: AppsScriptResponse;
    try {
      data = JSON.parse(resText);
    } catch {
      throw new Error('Google Apps Script trả về phản hồi không hợp lệ.');
    }

    return data;
  } catch (err: any) {
    console.error('Apps Script Network Error:', err);
    throw new Error(err.message || 'Không thể kết nối tới Google Apps Script Web App.');
  }
}

export async function cloudLogin(session: UserSession, url?: string): Promise<AppsScriptResponse> {
  const endpoint = url || getStoredAppsScriptUrl();
  return callAppsScript(endpoint, {
    action: 'login',
    username: session.username,
    password: session.password,
  });
}

export async function cloudRegister(session: UserSession, url?: string): Promise<AppsScriptResponse> {
  const endpoint = url || getStoredAppsScriptUrl();
  return callAppsScript(endpoint, {
    action: 'register',
    username: session.username,
    password: session.password,
  });
}

export async function cloudGetData(session: UserSession, url?: string): Promise<AppsScriptResponse> {
  const endpoint = url || getStoredAppsScriptUrl();
  return callAppsScript(endpoint, {
    action: 'getData',
    username: session.username,
    password: session.password,
  });
}

export async function cloudSaveData(
  session: UserSession,
  payload: CloudDataPayload,
  url?: string
): Promise<AppsScriptResponse> {
  const endpoint = url || getStoredAppsScriptUrl();
  return callAppsScript(endpoint, {
    action: 'saveData',
    username: session.username,
    password: session.password,
    data: payload,
  });
}

// Debouncing mechanism for saveData
let saveDebounceTimer: any = null;

export function debouncedCloudSave(
  session: UserSession,
  payload: CloudDataPayload,
  onStatusChange: (status: 'syncing' | 'synced' | 'error') => void,
  url?: string,
  delayMs: number = 500
) {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  onStatusChange('syncing');

  saveDebounceTimer = setTimeout(async () => {
    try {
      const res = await cloudSaveData(session, payload, url);
      if (res.status === 'success') {
        onStatusChange('synced');
      } else {
        // Retry once after 2 seconds on failure
        console.warn('Save failed, retrying once in 2s...', res.message);
        setTimeout(async () => {
          try {
            const retryRes = await cloudSaveData(session, payload, url);
            if (retryRes.status === 'success') {
              onStatusChange('synced');
            } else {
              onStatusChange('error');
            }
          } catch {
            onStatusChange('error');
          }
        }, 2000);
      }
    } catch (e) {
      console.warn('Save network error, retrying once in 2s...', e);
      setTimeout(async () => {
        try {
          const retryRes = await cloudSaveData(session, payload, url);
          if (retryRes.status === 'success') {
            onStatusChange('synced');
          } else {
            onStatusChange('error');
          }
        } catch {
          onStatusChange('error');
        }
      }, 2000);
    }
  }, delayMs);
}
