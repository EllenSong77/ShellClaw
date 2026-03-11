// User types
export type Plan = 'trial' | 'free' | 'paid_personal' | 'paid_pro';
export type SandboxStatus = 'creating' | 'running' | 'paused' | 'stopped' | 'archived';
export type TaskStatus = 'running' | 'completed' | 'timeout' | 'error' | 'cancelled' | 'pending';

export interface User {
  id: string;
  email: string;
  plan: Plan;
  trial_ends_at: string | null;
  paid_until: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface Usage {
  plan: Plan;
  trial_ends_at: string | null;
  paid_until: string | null;
  daily_used: number;
  daily_limit: number | null;
  daily_remaining: number | null;
}

export interface Sandbox {
  id: string;
  user_id: string;
  status: SandboxStatus;
  container_id: string | null;
  workspace_size_mb: number;
}

export interface Task {
  id: string;
  user_id: string;
  sandbox_id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  status: TaskStatus | null;
  model_name: string | null;
  llm_calls: number;
  input_tokens: number;
  output_tokens: number;
  stdout_text: string | null;
  stderr_text: string | null;
  error_text: string | null;
}

export interface CreateTaskRequest {
  message: string;
  command?: string | string[];
  timeout_sec?: number;
}

export interface CreateTaskResponse {
  ok: boolean;
  task_id: string;
  queue: string;
  sandbox_status: SandboxStatus;
  container_id: string | null;
}

export interface TaskListResponse {
  items: Task[];
}

export interface WorkspaceEntry {
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
}

export interface Workspace {
  base_path: string;
  entries: WorkspaceEntry[];
}

// WebSocket message types (matching backend)
export type WSEventType =
  | 'connected'
  | 'pong'
  | 'task_enqueued'
  | 'task_started'
  | 'task_delta'
  | 'task_completed'
  | 'task_error';

export interface WSEvent {
  type: WSEventType;
  task_id?: string;
  status?: TaskStatus;
  stdout_text?: string;
  stderr_text?: string;
  error_text?: string;
  duration_sec?: number;
  content?: string; // for task_delta
  stream?: 'stdout' | 'stderr';
}

export interface WSCreateTaskAction {
  action: 'create_task';
  message: string;
  timeout_sec?: number;
}

// ============ Billing Types ============

export type BillingProvider = 'mock' | 'stripe' | 'alipay' | 'wechat';
export type BillingOrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trialing';

export interface PlanFeatureResponse {
  plan: Plan;
  label: string;
  price_month_cny: number;
  task_limit_daily: number | null;
  max_concurrency: number;
  workspace_limit_mb: number;
  sandbox_timeout_minutes: number;
  highlighted: boolean;
}

export interface SubscriptionResponse {
  plan: Plan;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  paid_until: string | null;
  subscription_started_at: string | null;
  cancel_at_period_end: boolean;
  billing_provider: BillingProvider | null;
  billing_customer_id: string | null;
  current_period_ends_at: string | null;
  is_paid: boolean;
  trial_days_remaining: number | null;
  plans: PlanFeatureResponse[];
}

export interface BillingOrderResponse {
  id: string;
  plan: Plan;
  provider: BillingProvider;
  status: BillingOrderStatus;
  amount_cny: number;
  currency: string;
  external_order_id: string | null;
  checkout_url: string | null;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
}

export interface BillingSummaryResponse {
  subscription: SubscriptionResponse;
  recent_orders: BillingOrderResponse[];
}

export interface BillingOrdersResponse {
  items: BillingOrderResponse[];
}

export interface CheckoutRequest {
  plan: Plan;
  provider?: BillingProvider;
  success_url?: string;
  cancel_url?: string;
}

export interface CheckoutResponse {
  ok: boolean;
  order: BillingOrderResponse;
  checkout_url: string | null;
  provider: BillingProvider;
  mock: boolean;
}

export interface BillingPortalResponse {
  ok: boolean;
  url: string;
  provider: BillingProvider;
}

// ============ Error Types ============

export interface ApiErrorDetail {
  code?: string;
  message?: string;
  upgrade_required?: boolean;
  current_plan?: Plan;
  suggested_plan?: Plan;
  [key: string]: unknown;
}
