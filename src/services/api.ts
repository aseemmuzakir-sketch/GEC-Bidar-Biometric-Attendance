/**
 * Central API Client for GEC Bidar Attendance Management System
 * Handles GET, POST, PUT, DELETE, JWT token management, and detailed error mapping.
 */

const TOKEN_KEY = 'gec_attendance_token';
const USER_KEY = 'gec_attendance_user';

// Allows pointing to standalone backend (e.g., http://localhost:5000/api) or relative /api
let apiBaseUrl = (import.meta.env.VITE_API_URL as string) || '/api';

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function setApiBaseUrl(url: string): void {
  apiBaseUrl = url.replace(/\/+$/, '');
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): any | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeUser(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function request<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, params, headers: customHeaders, ...restOptions } = options;

  let url = `${apiBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        query.append(key, String(val));
      }
    }
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  let serializedBody: string | undefined = undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    serializedBody = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        ...headers,
        ...(customHeaders as Record<string, string>),
      },
      body: serializedBody,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json().catch(() => ({})) : await response.text();

    if (!response.ok) {
      let errorMessage = 'An unexpected server error occurred.';

      if (typeof data === 'object' && data !== null && data.message) {
        errorMessage = data.message;
      } else if (typeof data === 'string' && data.length > 0 && data.length < 200) {
        errorMessage = data;
      } else if (response.status === 400) {
        errorMessage = 'Invalid request parameters or cryptographic verification rejected.';
      } else if (response.status === 401) {
        errorMessage = 'Session expired or invalid credentials. Please log in again.';
        removeToken();
        window.dispatchEvent(new CustomEvent('gec:auth_expired'));
      } else if (response.status === 403) {
        errorMessage = 'Access denied: You do not have permission to perform this attendance action.';
      } else if (response.status === 404) {
        errorMessage = 'Requested attendance resource or session was not found.';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment before trying again.';
      } else if (response.status >= 500) {
        errorMessage = 'Backend attendance server or database unavailable (HTTP ' + response.status + ').';
      }

      console.error(`[Attendance API Error ${response.status}] ${options.method || 'GET'} ${url}:`, {
        status: response.status,
        error: errorMessage,
      });
      throw new ApiError(errorMessage, response.status, data);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }

    console.error(`[Attendance Network Failure] ${options.method || 'GET'} ${url}:`, err);

    let customMsg = 'Attendance server is unavailable. Please verify the backend is running on http://localhost:5000.';
    if (err.name === 'TypeError' && String(err.message).includes('Failed to fetch')) {
      customMsg = 'Attendance server connection failed (Network/CORS). Please verify backend server is active and accessible.';
    }

    throw new ApiError(
      customMsg,
      0,
      { originalError: err.message }
    );
  }
}

export const api = {
  get: <T = any>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = any>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  delete: <T = any>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
