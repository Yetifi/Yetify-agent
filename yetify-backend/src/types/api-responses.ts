// API Response Type Definitions for Yetify Backend

// Base response interface
export interface BaseApiResponse {
  success: boolean;
  timestamp: string;
}

// Success response interface
export interface SuccessResponse<T = any> extends BaseApiResponse {
  success: true;
  data?: T;
  message?: string;
}

// Error response interface
export interface ErrorResponse extends BaseApiResponse {
  success: false;
  error: string;
  message?: string;
  details?: any;
}

// Health check response
export interface HealthCheckResponse extends SuccessResponse {
  status: 'healthy';
  version: string;
  environment: string;
}

// OpenRouter test response
export interface OpenRouterTestResponse extends SuccessResponse {
  message: 'OpenRouter test completed';
  connection: boolean;
  model: {
    model: string;
    provider: string;
    cost: string;
    features: string[];
  };
}

// Strategy generation response
export interface StrategyGenerationResponse extends SuccessResponse {
  message: 'Strategy generated successfully';
  strategy: Strategy;
}

// Strategy list response
export interface StrategyListResponse extends SuccessResponse {
  strategies: StrategyListItem[];
  pagination: PaginationInfo;
}

// Strategy details response
export interface StrategyDetailsResponse extends SuccessResponse {
  strategy: StrategyDetails;
}

// Execution response
export interface ExecutionResponse extends SuccessResponse {
  execution: ExecutionStatus;
}

// Execution status response
export interface ExecutionStatusResponse extends SuccessResponse {
  execution: ExecutionDetails;
}

// Portfolio response
export interface PortfolioResponse extends SuccessResponse {
  portfolio: Portfolio;
}

// Performance response
export interface PerformanceResponse extends SuccessResponse {
  performance: PerformanceMetrics;
}

// Service health response
export interface ServiceHealthResponse extends SuccessResponse {
  services: {
    openRouter: {
      status: 'connected' | 'disconnected';
      model: {
        model: string;
        provider: string;
        cost: string;
        features: string[];
      };
    };
    strategyEngine: {
      status: 'initialized' | 'error';
    };
  };
}

// Data type interfaces
export interface Strategy {
  id: string;
  userId: string;
  goal: string;
  prompt: string;
  chains: string[];
  protocols: string[];
  steps: StrategyStep[];
  riskLevel: 'Low' | 'Medium' | 'High';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  estimatedApy: number;
  estimatedTvl: string;
  actualApy?: number;
  actualTvl?: number;
  confidence: number;
  reasoning: string;
  warnings: string[];
  gasEstimate: {
    ethereum?: string;
    near?: string;
    arbitrum?: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface StrategyStep {
  action: 'deposit' | 'stake' | 'yield_farm' | 'provide_liquidity' | 'leverage' | 'bridge';
  protocol: string;
  asset: string;
  amount: string;
  expectedApy: number;
  riskScore: number;
  gasEstimate: string;
  dependencies: string[];
}

export interface StrategyListItem {
  id: string;
  goal: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  estimatedApy: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  createdAt: string;
  performance?: {
    totalInvested: number;
    currentValue: number;
    totalReturns: number;
    roi: number;
    lastUpdated: string;
  };
}

export interface StrategyDetails extends Strategy {
  executionHistory: ExecutionHistoryItem[];
  performance: {
    totalInvested: number;
    currentValue: number;
    totalReturns: number;
    roi: number;
    lastUpdated: string;
  };
}

export interface ExecutionHistoryItem {
  timestamp: string;
  action: string;
  status: 'pending' | 'success' | 'failed';
  transactionHash?: string;
  gasUsed?: string;
  error?: string;
}

export interface ExecutionStatus {
  id: string;
  strategyId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  steps: ExecutionStepStatus[];
  startedAt: string;
  completedAt?: string;
}

export interface ExecutionStepStatus {
  stepId: number;
  action: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  estimatedGas: string;
  transactionHash?: string;
  gasUsed?: string;
  completedAt?: string;
}

export interface ExecutionDetails extends ExecutionStatus {
  totalGasUsed?: string;
  totalCost?: string;
  errorDetails?: string;
}

export interface Portfolio {
  totalValue: number;
  totalInvested: number;
  totalReturns: number;
  roi: number;
  strategies: PortfolioStrategy[];
  lastUpdated: string;
}

export interface PortfolioStrategy {
  id: string;
  value: number;
  invested: number;
  returns: number;
  roi: number;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
}

export interface PerformanceMetrics {
  strategyId: string;
  period: '1d' | '7d' | '30d' | '90d' | '1y';
  metrics: {
    currentValue: number;
    invested: number;
    returns: number;
    roi: number;
    apy: number;
    volatility: number;
    sharpeRatio: number;
  };
  timeSeries: PerformanceDataPoint[];
}

export interface PerformanceDataPoint {
  timestamp: string;
  value: number;
  returns: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Error type definitions
export interface ValidationErrorResponse extends ErrorResponse {
  error: 'Validation Error';
  details: string;
}

export interface UnauthorizedErrorResponse extends ErrorResponse {
  error: 'Unauthorized';
  message: 'Invalid authentication credentials' | 'No authentication token provided';
}

export interface NotFoundErrorResponse extends ErrorResponse {
  error: 'Not Found';
  message: string; // Dynamic message like "Route /api/invalid not found"
}

export interface RateLimitErrorResponse extends ErrorResponse {
  error: 'Too Many Requests';
  message: 'Too many requests from this IP, please try again later.';
}

export interface InternalServerErrorResponse extends ErrorResponse {
  error: 'Internal Server Error';
  message: string; // Environment-dependent message
}

// GraphQL response types
export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: string[];
  extensions?: {
    code: string;
    exception?: {
      stacktrace?: string[];
    };
  };
}

// User query response types
export interface UserQueryResponse {
  user: {
    id: string;
    walletAddress: string;
    strategies: StrategyListItem[];
  };
}

export interface StrategyQueryResponse {
  strategy: StrategyDetails;
}

// Request body types
export interface StrategyGenerationRequest {
  prompt: string;
  riskTolerance?: 'low' | 'medium' | 'high';
  investmentAmount?: number;
  preferredChains?: string[];
  timeHorizon?: 'short' | 'medium' | 'long';
}

export interface ExecutionRequest {
  strategyId: string;
  dryRun?: boolean;
}

// HTTP status code mappings
export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Response headers
export interface ResponseHeaders {
  'Content-Type': 'application/json';
  'X-RateLimit-Limit'?: string;
  'X-RateLimit-Remaining'?: string;
  'X-RateLimit-Reset'?: string;
  'Authorization'?: string;
}

// Type guards for response validation
export function isSuccessResponse<T>(response: BaseApiResponse): response is SuccessResponse<T> {
  return response.success === true;
}

export function isErrorResponse(response: BaseApiResponse): response is ErrorResponse {
  return response.success === false;
}

export function isValidationError(response: ErrorResponse): response is ValidationErrorResponse {
  return response.error === 'Validation Error';
}

export function isUnauthorizedError(response: ErrorResponse): response is UnauthorizedErrorResponse {
  return response.error === 'Unauthorized';
}

export function isNotFoundError(response: ErrorResponse): response is NotFoundErrorResponse {
  return response.error === 'Not Found';
}

// API endpoint path constants
export const API_ENDPOINTS = {
  HEALTH: '/health',
  TEST: {
    OPENROUTER: '/api/v1/test/openrouter',
    STRATEGY: '/api/v1/test/strategy',
    HEALTH: '/api/v1/test/health',
  },
  STRATEGIES: {
    BASE: '/api/v1/strategies',
    GENERATE: '/api/v1/strategies/generate',
    BY_ID: (id: string) => `/api/v1/strategies/${id}`,
  },
  EXECUTION: {
    BASE: '/api/v1/execution',
    EXECUTE: '/api/v1/execution/execute',
    STATUS: (id: string) => `/api/v1/execution/status/${id}`,
  },
  MONITORING: {
    PORTFOLIO: '/api/v1/monitoring/portfolio',
    PERFORMANCE: (id: string) => `/api/v1/monitoring/performance/${id}`,
  },
  GRAPHQL: '/graphql',
} as const;

// Common response factory functions
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): SuccessResponse<T> {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    data,
    message,
  };
}

export function createErrorResponse(
  error: string,
  message?: string,
  details?: any
): ErrorResponse {
  return {
    success: false,
    timestamp: new Date().toISOString(),
    error,
    message,
    details,
  };
}

export function createValidationError(details: string): ValidationErrorResponse {
  return {
    success: false,
    timestamp: new Date().toISOString(),
    error: 'Validation Error',
    details,
  };
}

export function createUnauthorizedError(
  message: 'Invalid authentication credentials' | 'No authentication token provided'
): UnauthorizedErrorResponse {
  return {
    success: false,
    timestamp: new Date().toISOString(),
    error: 'Unauthorized',
    message,
  };
}

export function createNotFoundError(route: string): NotFoundErrorResponse {
  return {
    success: false,
    timestamp: new Date().toISOString(),
    error: 'Not Found',
    message: `Route ${route} not found`,
  };
}