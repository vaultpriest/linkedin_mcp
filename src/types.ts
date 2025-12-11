// LinkedIn MCP Server - Type Definitions

// ============================================
// Response Types
// ============================================

export type ResponseStatus = 'success' | 'needs_human' | 'error';

export type ProblemReason =
  | 'captcha_detected'
  | 'rate_limited'
  | 'login_required'
  | 'unexpected_ui'
  | 'element_not_found'
  | 'timeout'
  | 'network_error';

export interface SuccessResponse<T> {
  status: 'success';
  data: T;
}

export interface NeedsHumanResponse {
  status: 'needs_human';
  reason: ProblemReason;
  screenshot?: string;  // base64 PNG
  hint: string;
  current_url?: string;
}

export interface ErrorResponse {
  status: 'error';
  message: string;
}

export type ToolResponse<T> = SuccessResponse<T> | NeedsHumanResponse | ErrorResponse;

// ============================================
// Search Types
// ============================================

export interface SearchResult {
  name: string;
  headline: string;
  location: string;
  profile_url: string;
  connection_degree: string;
  profile_image_url?: string;
}

export interface SearchInput {
  query: string;
  location?: string;
  limit?: number;
}

export interface SearchOutput {
  results: SearchResult[];
  total_results: number;
  has_more: boolean;
}

// ============================================
// Profile Types
// ============================================

export interface Experience {
  title: string;
  company: string;
  duration: string;
  is_current: boolean;
}

export interface ProfileData {
  first_name: string;
  last_name: string;
  full_name: string;
  headline: string;
  location: string;
  current_company: string;
  current_position: string;
  email?: string;
  phone?: string;
  about?: string;
  experience: Experience[];
  connection_degree: string;
  profile_url: string;
}

export interface ProfileInput {
  profile_url: string;
}

// ============================================
// Scroll Types
// ============================================

export interface ScrollInput {
  direction: 'down' | 'up';
  amount?: number;
}

export interface ScrollOutput {
  new_results: SearchResult[];
  total_loaded: number;
}

// ============================================
// Connection Types
// ============================================

export interface ConnectionInput {
  profile_url: string;
  message?: string;
}

export type ConnectionStatus = 'success' | 'needs_human' | 'already_connected' | 'pending' | 'limit_reached';

export interface ConnectionOutput {
  status: ConnectionStatus;
  message?: string;
}

// ============================================
// Screenshot Types
// ============================================

export interface ScreenshotInput {
  full_page?: boolean;
  element?: string;
}

export interface ScreenshotOutput {
  screenshot: string;  // base64 PNG
  current_url: string;
}

// ============================================
// Navigation Types
// ============================================

export interface NavigateInput {
  url: string;
}

export interface NavigateOutput {
  current_url: string;
}

// ============================================
// Click Types
// ============================================

export interface ClickInput {
  selector?: string;
  text?: string;
}

// ============================================
// Type Input Types
// ============================================

export interface TypeInput {
  selector: string;
  text: string;
  clear_first?: boolean;
}

// ============================================
// Browser State
// ============================================

export interface BrowserState {
  isInitialized: boolean;
  currentUrl: string | null;
  lastActionTime: number;
  actionsCount: number;
  sessionStartTime: number;
}

// ============================================
// Config Types
// ============================================

export interface DelayConfig {
  min: number;
  max: number;
}

export interface Config {
  userDataDir: string;
  headless: boolean;
  delays: {
    betweenActions: DelayConfig;
    beforeClick: DelayConfig;
    typingSpeed: DelayConfig;
    readingProfile: DelayConfig;
    afterSearch: DelayConfig;
    betweenScrolls: DelayConfig;
  };
  session: {
    pauseInterval: number;
    pauseDuration: number;
  };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
