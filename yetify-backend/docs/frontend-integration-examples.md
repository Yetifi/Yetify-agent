# Frontend Integration Examples

## Overview
This document provides comprehensive examples for integrating frontend applications with the Yetify Backend API.

## Environment Setup

```javascript
// .env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:3001/graphql
```

## 1. API Client Setup

### Basic HTTP Client
```typescript
// lib/api-client.ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

class YetifyApiClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.token = token;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Health Check
  async healthCheck() {
    return this.makeRequest('/health');
  }

  // Test OpenRouter Connection
  async testOpenRouter() {
    return this.makeRequest('/api/v1/test/openrouter');
  }

  // Generate Strategy
  async generateStrategy(prompt: string) {
    return this.makeRequest('/api/v1/test/strategy', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }
}

export const apiClient = new YetifyApiClient(
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
);
```

## 2. GraphQL Client Setup

### Apollo Client Configuration
```typescript
// lib/apollo-client.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:3001/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('auth_token');
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  };
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});
```

### GraphQL Queries
```typescript
// lib/graphql/queries.ts
import { gql } from '@apollo/client';

export const GET_USER_STRATEGIES = gql`
  query GetUserStrategies($userId: ID!) {
    user(id: $userId) {
      id
      walletAddress
      strategies {
        id
        goal
        status
        estimatedApy
        riskLevel
        createdAt
      }
    }
  }
`;

export const GET_STRATEGY_DETAILS = gql`
  query GetStrategyDetails($strategyId: ID!) {
    strategy(id: $strategyId) {
      id
      goal
      prompt
      chains
      protocols
      steps {
        action
        protocol
        asset
        amount
        expectedApy
        riskScore
      }
      status
      estimatedApy
      confidence
      reasoning
      warnings
    }
  }
`;
```

## 3. React Hook Examples

### Strategy Management Hook
```typescript
// hooks/useStrategy.ts
import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

export const useStrategy = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateStrategy = useCallback(async (prompt: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.generateStrategy(prompt);
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Strategy generation failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generateStrategy,
    loading,
    error,
  };
};
```

### Health Check Hook
```typescript
// hooks/useHealthCheck.ts
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';

interface HealthStatus {
  backend: boolean;
  openRouter: boolean;
  database: boolean;
}

export const useHealthCheck = (interval = 30000) => {
  const [status, setStatus] = useState<HealthStatus>({
    backend: false,
    openRouter: false,
    database: false,
  });
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    
    try {
      const [healthResponse, openRouterResponse] = await Promise.allSettled([
        apiClient.healthCheck(),
        apiClient.testOpenRouter(),
      ]);

      setStatus({
        backend: healthResponse.status === 'fulfilled',
        openRouter: openRouterResponse.status === 'fulfilled' && 
                   openRouterResponse.value.connection,
        database: healthResponse.status === 'fulfilled' && 
                 healthResponse.value.status === 'healthy',
      });
    } catch (error) {
      console.error('Health check failed:', error);
      setStatus({ backend: false, openRouter: false, database: false });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, interval);
    return () => clearInterval(timer);
  }, [checkHealth, interval]);

  return { status, checking, checkHealth };
};
```

## 4. Error Handling

### Error Boundary Component
```typescript
// components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Retry Logic
```typescript
// utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxAttempts) {
        throw lastError;
      }

      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
}

// Usage
const strategyWithRetry = await withRetry(
  () => apiClient.generateStrategy(prompt),
  3,
  1000
);
```

## 5. Authentication Implementation

### Auth Context
```typescript
// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

interface User {
  id: string;
  walletAddress: string;
  walletType: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (walletAddress: string, walletType: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('auth_token')
  );

  const login = useCallback(async (walletAddress: string, walletType: string) => {
    try {
      // Simulate wallet authentication
      const mockToken = `mock_token_${Date.now()}`;
      const mockUser = {
        id: `user_${Date.now()}`,
        walletAddress,
        walletType,
      };

      localStorage.setItem('auth_token', mockToken);
      setToken(mockToken);
      setUser(mockUser);
      
      apiClient.setAuthToken(mockToken);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## 6. Component Examples

### Strategy Generator Component
```typescript
// components/StrategyGenerator.tsx
import React, { useState } from 'react';
import { useStrategy } from '../hooks/useStrategy';

export const StrategyGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [strategy, setStrategy] = useState(null);
  const { generateStrategy, loading, error } = useStrategy();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) return;

    try {
      const result = await generateStrategy(prompt);
      setStrategy(result);
    } catch (err) {
      console.error('Failed to generate strategy:', err);
    }
  };

  return (
    <div className="strategy-generator">
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your DeFi investment strategy..."
          rows={4}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !prompt.trim()}>
          {loading ? 'Generating...' : 'Generate Strategy'}
        </button>
      </form>

      {error && (
        <div className="error">
          <p>Error: {error}</p>
        </div>
      )}

      {strategy && (
        <div className="strategy-result">
          <h3>Generated Strategy</h3>
          <pre>{JSON.stringify(strategy, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
```

## 7. Real-time Updates

### WebSocket Connection
```typescript
// lib/websocket.ts
export class YetifyWebSocket {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit(data.type, data.payload);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.emit('disconnected');
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  subscribe(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

## Usage Examples

### Complete Integration Example
```typescript
// pages/dashboard.tsx
import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { StrategyGenerator } from '../components/StrategyGenerator';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function Dashboard() {
  const { isAuthenticated, user } = useAuth();
  const { status, checking } = useHealthCheck();

  if (!isAuthenticated) {
    return <div>Please connect your wallet</div>;
  }

  return (
    <ErrorBoundary>
      <div className="dashboard">
        <header>
          <h1>Welcome, {user?.walletAddress}</h1>
          <div className="status">
            Backend: {status.backend ? '✅' : '❌'}
            AI: {status.openRouter ? '✅' : '❌'}
            DB: {status.database ? '✅' : '❌'}
          </div>
        </header>

        <main>
          <StrategyGenerator />
        </main>
      </div>
    </ErrorBoundary>
  );
}
```

This documentation provides comprehensive examples for integrating any frontend application with the Yetify Backend API, including error handling, authentication, and real-time features.