/*
  api.ts — Pure API service layer for Continew Frontend.
  Encapsulates all fetch calls with proper typing, credentials inclusion, and standardized error handling.
*/

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  createdAt?: string;
}

export interface EndpointItem {
  id: string;
  url: string;
  isActive: boolean;
  createdAt: string;
}

export interface EndpointDetailData {
  id: string;
  url: string;
  isActive: boolean;
  createdAt: string;
}

export interface EndpointDetailResponse {
  message: string;
  endpointData: EndpointDetailData;
  circuitBreaker: {
    status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' | string;
  };
}

export interface ApiKeyItem {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreatedApiKey {
  id: string;
  name: string;
  rawApiKey: string;
  isActive: boolean;
  createdAt: string;
}

export interface SendEventPayload {
  endpointId: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface SendEventResponse {
  eventId: string;
  status: string;
  message?: string;
}

export interface DeliveryAttempt {
  id: string;
  eventId: string;
  endpointId?: string;
  attemptNumber: number;
  responseCode?: number;
  responseBody?: string;
  error?: string;
  latencyMs?: number;
  status: string;
  createdAt: string;
  eventType?: string;
  url?: string;
}

/**
 * Standard fetch helper that unwraps JSON responses and catches network or HTTP errors.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      credentials: 'include', // Include HTTP-only cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // Body may be empty on some responses
      json = null;
    }

    if (!res.ok) {
      const errObj = json as Record<string, unknown> | null;
      const errorMessage =
        (typeof errObj?.message === 'string' ? errObj.message : undefined) ||
        (typeof errObj?.error === 'string' ? errObj.error : undefined) ||
        `Request failed with status ${res.status}`;
      return {
        ok: false,
        error: errorMessage,
        statusCode: res.status,
      };
    }

    return {
      ok: true,
      data: (json as T) ?? undefined,
      statusCode: res.status,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error:
        message === 'Failed to fetch'
          ? 'Network error. Could not connect to Continew server.'
          : message || 'An unexpected error occurred.',
      statusCode: 0,
    };
  }
}

export const api = {
  auth: {
    sendOtp: (email: string) =>
      request<{ message: string }>('/api/v1/users/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    verifyOtp: (email: string, otp: string) =>
      request<{ message: string }>('/api/v1/users/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      }),

    register: (email: string, password: string, username: string) =>
      request<{ message: string; user: UserProfile }>('/api/v1/users/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, username }),
      }),

    login: (email: string, password: string) =>
      request<{ message: string; user: UserProfile }>('/api/v1/users/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    refresh: () =>
      request<{ message: string }>('/api/v1/users/refresh', {
        method: 'POST',
      }),

    logout: () =>
      request<{ message: string }>('/api/v1/users/logout', {
        method: 'POST',
      }),

    getMe: () =>
      request<{ user: UserProfile }>('/api/v1/users/me', {
        method: 'GET',
      }),
  },

  endpoints: {
    getAll: () =>
      request<{ rows: EndpointItem[] }>('/api/v1/endpoints', {
        method: 'GET',
      }),

    getDetails: (id: string) =>
      request<EndpointDetailResponse>(`/api/v1/endpoints/${id}`, {
        method: 'GET',
      }),

    create: (url: string) =>
      request<{ message: string; endpoint: EndpointItem }>('/api/v1/endpoints', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),

    toggle: (id: string, isActive?: boolean) =>
      request<{ message: string; endpoint: EndpointItem }>(`/api/v1/endpoints/${id}/toggle`, {
        method: 'PATCH',
        body: typeof isActive === 'boolean' ? JSON.stringify({ isActive }) : undefined,
      }),
  },

  apiKeys: {
    getAll: () =>
      request<{ apiKeys: ApiKeyItem[] }>('/api/v1/api-keys', {
        method: 'GET',
      }),

    create: (name?: string) =>
      request<{ message: string; apiKey: CreatedApiKey }>('/api/v1/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: name || undefined }),
      }),

    toggle: (id: string, isActive?: boolean) =>
      request<{ message: string; apiKey: ApiKeyItem }>(`/api/v1/api-keys/${id}/toggle`, {
        method: 'PATCH',
        body: typeof isActive === 'boolean' ? JSON.stringify({ isActive }) : undefined,
      }),

    delete: (id: string) =>
      request<{ message: string }>(`/api/v1/api-keys/${id}`, {
        method: 'DELETE',
      }),
  },

  events: {
    send: (apiKey: string, payload: SendEventPayload) =>
      request<SendEventResponse>('/api/v1/events', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          endpointId: payload.endpointId,
          type: payload.type,
          payload: payload.payload,
        }),
      }),
  },

  audit: {
    getEndpointAttempts: (id: string, page = 1, limit = 20) =>
      request<{
        endpointData?: { id: string; url: string };
        attempts: DeliveryAttempt[];
        count: number;
        total?: number;
        page: number;
        limit: number;
      }>(
        `/api/v1/audit/endpoints/${id}/attempts?page=${page}&limit=${limit}`,
        { method: 'GET' }
      ),

    getEventAttempts: (id: string) =>
      request<{
        eventId: string;
        attempts: DeliveryAttempt[];
        event?: Record<string, unknown>;
      }>(
        `/api/v1/audit/events/${id}/attempts`,
        { method: 'GET' }
      ),
  },
};
