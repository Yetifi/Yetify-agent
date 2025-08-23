# Middleware Documentation

## Overview
Yetify Backend uses Express.js middleware for security, authentication, rate limiting, and request processing. This document describes all middleware components and their configuration.

## Security Middleware

### 1. Helmet - Security Headers
**File**: Built-in Express middleware
**Purpose**: Sets various HTTP headers to secure the app

```javascript
app.use(helmet());
```

**Headers Set**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HTTPS only)

### 2. CORS - Cross-Origin Resource Sharing
**File**: Built-in Express middleware
**Purpose**: Controls cross-origin requests

```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yetify.ai', 'https://app.yetify.ai']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
```

**Configuration**:
- **Development**: Allows `localhost:3000` and `localhost:3001`
- **Production**: Allows only `yetify.ai` and `app.yetify.ai` domains
- **Credentials**: Enabled for cookie/auth header support

## Rate Limiting Middleware

### Rate Limiter
**File**: Built-in Express middleware
**Purpose**: Prevents API abuse and DoS attacks

```javascript
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);
```

**Configuration**:
- **Window**: 15 minutes (900,000ms)
- **Max Requests**: 100 per IP per window
- **Scope**: Applied to `/api/*` routes only
- **Headers**: Includes rate limit info in response headers

**Response Headers**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642681500
```

## Body Parsing Middleware

### JSON Parser
```javascript
app.use(express.json({ limit: '10mb' }));
```

### URL-Encoded Parser  
```javascript
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

**Configuration**:
- **Limit**: 10MB for both JSON and form data
- **Extended**: Supports nested objects in URL-encoded data

## Authentication Middleware

### Auth Middleware
**File**: `src/middleware/auth.ts`
**Purpose**: JWT token validation and user authentication

```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { 
    id: string; 
    walletAddress: string; 
    walletType: string; 
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
      return;
    }

    // JWT verification
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      walletAddress: decoded.walletAddress,
      walletType: decoded.walletType
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication token'
    });
  }
};
```

**Usage**:
```javascript
// Protected routes
app.use('/api/v1/strategies', authMiddleware, strategyRoutes);
app.use('/api/v1/execution', authMiddleware, executionRoutes);
app.use('/api/v1/monitoring', authMiddleware, monitoringRoutes);

// Public routes (no auth required)
app.use('/api/v1/test', testRoutes);
```

**Token Format**:
```javascript
// JWT Payload
{
  id: "user_1642680500000",
  walletAddress: "0x123...abc",
  walletType: "metamask",
  iat: 1642680600,
  exp: 1642767000  // 24 hours
}
```

**Error Responses**:
```json
// Missing token
{
  "error": "Unauthorized",
  "message": "No authentication token provided"
}

// Invalid token
{
  "error": "Unauthorized", 
  "message": "Invalid authentication token"
}
```

## Error Handling Middleware

### Global Error Handler
**File**: `src/index.ts`
**Purpose**: Catches and formats all unhandled errors

```javascript
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  
  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }
  
  // Authentication errors
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication credentials'
    });
  }

  // Generic server errors
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message
  });
});
```

**Error Types Handled**:
- **ValidationError**: 400 Bad Request
- **UnauthorizedError**: 401 Unauthorized  
- **Generic Errors**: 500 Internal Server Error

**Development vs Production**:
- **Development**: Full error messages exposed
- **Production**: Generic error messages for security

### 404 Handler
**File**: `src/index.ts`
**Purpose**: Handles undefined routes

```javascript
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});
```

## GraphQL Context Middleware

### Apollo Server Context
**File**: `src/index.ts`
**Purpose**: Provides authentication context to GraphQL resolvers

```javascript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }: { req: AuthenticatedRequest }) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return { 
      token, 
      user: req.user 
    };
  },
  introspection: process.env.NODE_ENV !== 'production',
});
```

**Context Object**:
```typescript
interface GraphQLContext {
  token?: string;
  user?: {
    id: string;
    walletAddress: string;
    walletType: string;
  };
}
```

## Logging Middleware

### Request Logging
**File**: Custom implementation using Winston logger
**Purpose**: Logs all API requests for monitoring

```javascript
// Custom request logging (if implemented)
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.request(
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      req.user?.id
    );
  });
  
  next();
};
```

**Log Format**:
```
2024-01-20T10:30:00.000Z [REQUEST] GET /api/v1/strategies - 200 (245ms)
```

## Middleware Order

**Critical**: Middleware order matters in Express. Current order:

1. **Security** (Helmet)
2. **CORS**  
3. **Rate Limiting**
4. **Body Parsing** (JSON/URL-encoded)
5. **Custom Request Logging** (if implemented)
6. **Route-specific Authentication**
7. **Application Routes**
8. **404 Handler** 
9. **Error Handler** (must be last)

```javascript
// Correct middleware order
app.use(helmet());                    // 1. Security headers
app.use(cors(corsOptions));           // 2. CORS
app.use('/api/', limiter);            // 3. Rate limiting
app.use(express.json());              // 4. JSON parsing
app.use(express.urlencoded());        // 5. Form parsing

// Routes with auth middleware
app.use('/api/v1/strategies', authMiddleware, strategyRoutes);
app.use('/api/v1/execution', authMiddleware, executionRoutes);

// Public routes
app.use('/api/v1/test', testRoutes);

// Must be after all routes
app.use('*', notFoundHandler);        // 6. 404 handler
app.use(errorHandler);                // 7. Error handler (LAST)
```

## Environment Configuration

### Required Environment Variables
```env
# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100          # Max requests per window

# CORS Origins (production)
CORS_ORIGINS=https://yetify.ai,https://app.yetify.ai
```

### Security Best Practices

1. **JWT Secret**: Use strong, random secret (256-bit recommended)
2. **Rate Limiting**: Adjust limits based on expected traffic
3. **CORS**: Restrict origins to known domains in production
4. **Headers**: Helmet provides good defaults, customize if needed
5. **Error Handling**: Never expose sensitive information in error messages

## Testing Middleware

### Authentication Testing
```bash
# Test without token
curl -X GET http://localhost:3001/api/v1/strategies
# Expected: 401 Unauthorized

# Test with invalid token  
curl -X GET http://localhost:3001/api/v1/strategies \
  -H "Authorization: Bearer invalid-token"
# Expected: 401 Unauthorized

# Test with valid token
curl -X GET http://localhost:3001/api/v1/strategies \
  -H "Authorization: Bearer valid-jwt-token"
# Expected: 200 OK (if user has strategies)
```

### Rate Limiting Testing
```bash
# Test rate limiting (requires 101 rapid requests)
for i in {1..101}; do
  curl -X GET http://localhost:3001/api/v1/test/health
done
# Expected: First 100 succeed, 101st returns 429 Too Many Requests
```

This middleware stack provides comprehensive security, authentication, and error handling for the Yetify Backend API.