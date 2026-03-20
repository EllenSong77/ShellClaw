import type {
  User,
  Sandbox,
  Task,
  TaskListResponse,
  Usage,
  LoginResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  Workspace,
  SubscriptionResponse,
  BillingOrdersResponse,
  BillingSummaryResponse,
  CheckoutRequest,
  CheckoutResponse,
  BillingPortalResponse,
  ApiErrorDetail,
  AccessConfig,
} from '../types';

const API_BASE = '/api';

// Token management
let accessToken: string | null = localStorage.getItem('access_token');

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string | null): void {
  accessToken = token;
  if (token) {
    localStorage.setItem('access_token', token);
  } else {
    localStorage.removeItem('access_token');
  }
}

export function clearToken(): void {
  accessToken = null;
  localStorage.removeItem('access_token');
}

export class ApiError extends Error {
  status: number;
  detail: ApiErrorDetail | string;

  constructor(status: number, detail: ApiErrorDetail | string) {
    const message = typeof detail === 'string' ? detail : detail.message || 'Request failed';
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };

  // Add Bearer token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 - token expired or invalid
    if (response.status === 401) {
      throw new ApiError(401, 'Unauthorized - please login again');
    }
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(response.status, errorData.detail || 'Request failed');
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // ============ Auth ============

  async getAccessConfig(): Promise<AccessConfig> {
    return request('/auth/access-config');
  },

  async register(email: string, password: string, activationCode?: string): Promise<User> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, activation_code: activationCode }),
    });
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    // Store the token
    setToken(response.access_token);
    return response;
  },

  async logout(): Promise<void> {
    clearToken();
  },

  // ============ User / Me ============

  async getMe(): Promise<User> {
    return request('/me');
  },

  async getUsage(): Promise<Usage> {
    return request('/me/usage');
  },

  // ============ Sandbox ============

  async getSandbox(): Promise<Sandbox> {
    return request('/me/sandbox');
  },

  async startSandbox(): Promise<Sandbox> {
    return request('/me/sandbox/start', { method: 'POST' });
  },

  async pauseSandbox(): Promise<Sandbox> {
    return request('/me/sandbox/pause', { method: 'POST' });
  },

  async stopSandbox(): Promise<Sandbox> {
    return request('/me/sandbox/stop', { method: 'POST' });
  },

  // ============ Tasks ============

  async getTasks(limit = 20): Promise<TaskListResponse> {
    return request(`/me/tasks?limit=${limit}`);
  },

  async createTask(payload: CreateTaskRequest): Promise<CreateTaskResponse> {
    return request('/me/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getTask(taskId: string): Promise<Task> {
    return request(`/tasks/${taskId}`);
  },

  // ============ Workspace ============

  async getWorkspace(path = ''): Promise<Workspace> {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return request(`/me/workspace${query}`);
  },

  async uploadFile(file: File, dirPath = ''): Promise<{ ok: boolean; path: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = getToken();
    const query = dirPath ? `?dir_path=${encodeURIComponent(dirPath)}` : '';

    const response = await fetch(`${API_BASE}/me/workspace/upload${query}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new ApiError(response.status, error.detail || 'Upload failed');
    }

    return response.json();
  },

  getFileDownloadUrl(path: string): string {
    return `${API_BASE}/me/workspace/download?path=${encodeURIComponent(path)}`;
  },

  // ============ Billing ============

  async getSubscription(): Promise<SubscriptionResponse> {
    return request('/me/subscription');
  },

  async getBillingSummary(): Promise<BillingSummaryResponse> {
    return request('/me/billing');
  },

  async getOrders(): Promise<BillingOrdersResponse> {
    return request('/me/orders');
  },

  async createCheckout(payload: CheckoutRequest): Promise<CheckoutResponse> {
    return request('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createPortal(): Promise<BillingPortalResponse> {
    return request('/billing/portal', {
      method: 'POST',
    });
  },

  async mockCompleteOrder(orderId: string): Promise<{ ok: boolean }> {
    return request(`/billing/orders/${orderId}/mock/complete`, {
      method: 'POST',
    });
  },

  async mockFailOrder(orderId: string): Promise<{ ok: boolean }> {
    return request(`/billing/orders/${orderId}/mock/fail`, {
      method: 'POST',
    });
  },

  async mockCancelOrder(orderId: string): Promise<{ ok: boolean }> {
    return request(`/billing/orders/${orderId}/mock/cancel`, {
      method: 'POST',
    });
  },

  async redeemCode(code: string): Promise<{ ok: boolean; message: string }> {
    return request('/me/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },
};
