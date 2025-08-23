# Yetify Backend API Documentation

## Base URL
```
http://localhost:3001
```

## Authentication

All protected endpoints require authentication via Bearer token:
```bash
Authorization: Bearer <your_jwt_token>
```

## Health Check Endpoints

### GET /health
Check server health status.

**cURL Example:**
```bash
curl -X GET http://localhost:3001/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "version": "v1",
  "environment": "development"
}
```

## Test Endpoints

### GET /api/v1/test/openrouter
Test OpenRouter AI service connection.

**cURL Example:**
```bash
curl -X GET http://localhost:3001/api/v1/test/openrouter
```

**Response:**
```json
{
  "success": true,
  "message": "OpenRouter test completed",
  "connection": true,
  "model": {
    "model": "deepseek/deepseek-r1:free",
    "provider": "DeepSeek",
    "cost": "Free tier",
    "features": ["JSON output", "Multi-turn chat", "Fast inference"]
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### POST /api/v1/test/strategy
Test strategy generation with AI.

**cURL Example:**
```bash
curl -X POST http://localhost:3001/api/v1/test/strategy \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "I want to earn 15% APY on $10,000 with medium risk tolerance on NEAR and Ethereum"
  }'
```

**Request Body:**
```json
{
  "prompt": "I want to earn 15% APY on $10,000 with medium risk tolerance on NEAR and Ethereum"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Strategy generated successfully",
  "strategy": {
    "id": "strategy_1642680600000",
    "goal": "Earn 15% APY with medium risk",
    "chains": ["NEAR", "Ethereum"],
    "protocols": ["Ref Finance", "Aave", "Uniswap"],
    "steps": [
      {
        "action": "deposit",
        "protocol": "Ref Finance",
        "asset": "NEAR",
        "amount": "5000 USDC equivalent",
        "expectedApy": 16.5,
        "riskScore": 6,
        "gasEstimate": "0.003 NEAR"
      }
    ],
    "riskLevel": "Medium",
    "estimatedApy": 15.2,
    "estimatedTvl": "$10,000",
    "confidence": 85,
    "reasoning": "Diversified approach across DeFi blue chips"
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### GET /api/v1/test/health
Comprehensive service health check.

**cURL Example:**
```bash
curl -X GET http://localhost:3001/api/v1/test/health
```

**Response:**
```json
{
  "success": true,
  "services": {
    "openRouter": {
      "status": "connected",
      "model": {
        "model": "deepseek/deepseek-r1:free",
        "provider": "DeepSeek",
        "cost": "Free tier",
        "features": ["JSON output", "Multi-turn chat", "Fast inference"]
      }
    },
    "strategyEngine": {
      "status": "initialized"
    }
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

## Strategy Endpoints (Protected)

### POST /api/v1/strategies/generate
Generate a new DeFi strategy based on user input.

**Authentication:** Required

**cURL Example:**
```bash
curl -X POST http://localhost:3001/api/v1/strategies/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{
    "prompt": "I want to earn passive income on $50,000 with low risk on NEAR Protocol",
    "riskTolerance": "low",
    "investmentAmount": 50000,
    "preferredChains": ["NEAR"],
    "timeHorizon": "long"
  }'
```

**Request Body:**
```json
{
  "prompt": "I want to earn passive income on $50,000 with low risk on NEAR Protocol",
  "riskTolerance": "low",
  "investmentAmount": 50000,
  "preferredChains": ["NEAR"],
  "timeHorizon": "long"
}
```

**Response:**
```json
{
  "success": true,
  "strategy": {
    "id": "strat_1642680600000",
    "userId": "user_1642680500000",
    "goal": "Passive income generation with capital preservation",
    "prompt": "I want to earn passive income on $50,000 with low risk on NEAR Protocol",
    "chains": ["NEAR"],
    "protocols": ["Ref Finance", "Meta Pool", "Burrow"],
    "steps": [
      {
        "action": "stake",
        "protocol": "Meta Pool",
        "asset": "NEAR",
        "amount": "30000 USDC equivalent",
        "expectedApy": 10.2,
        "riskScore": 3,
        "gasEstimate": "0.001 NEAR",
        "dependencies": []
      },
      {
        "action": "provide_liquidity",
        "protocol": "Ref Finance",
        "asset": "USDC-USDT",
        "amount": "20000 USDC",
        "expectedApy": 8.5,
        "riskScore": 4,
        "gasEstimate": "0.002 NEAR",
        "dependencies": []
      }
    ],
    "riskLevel": "Low",
    "status": "draft",
    "estimatedApy": 9.5,
    "estimatedTvl": "$50,000",
    "confidence": 92,
    "reasoning": "Conservative approach focusing on established NEAR DeFi protocols with proven track records",
    "warnings": [
      "Monitor staked NEAR unlock periods",
      "Consider impermanent loss in LP positions"
    ],
    "gasEstimate": {
      "near": "0.005 NEAR",
      "ethereum": "N/A",
      "arbitrum": "N/A"
    },
    "createdAt": "2024-01-20T10:30:00.000Z"
  }
}
```

### GET /api/v1/strategies
Get user's strategy list.

**Authentication:** Required

**cURL Example:**
```bash
curl -X GET "http://localhost:3001/api/v1/strategies?page=1&limit=10&status=active" \
  -H "Authorization: Bearer <your_jwt_token>"
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `status` (optional): Filter by status (draft, active, paused, completed, failed)

**Response:**
```json
{
  "success": true,
  "strategies": [
    {
      "id": "strat_1642680600000",
      "goal": "Passive income generation",
      "status": "active",
      "estimatedApy": 9.5,
      "riskLevel": "Low",
      "createdAt": "2024-01-20T10:30:00.000Z",
      "performance": {
        "totalInvested": 50000,
        "currentValue": 52450,
        "totalReturns": 2450,
        "roi": 4.9,
        "lastUpdated": "2024-01-20T15:30:00.000Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

### GET /api/v1/strategies/:id
Get specific strategy details.

**Authentication:** Required

**cURL Example:**
```bash
curl -X GET http://localhost:3001/api/v1/strategies/strat_1642680600000 \
  -H "Authorization: Bearer <your_jwt_token>"
```

**Response:**
```json
{
  "success": true,
  "strategy": {
    "id": "strat_1642680600000",
    "userId": "user_1642680500000",
    "goal": "Passive income generation with capital preservation",
    "prompt": "I want to earn passive income on $50,000 with low risk on NEAR Protocol",
    "chains": ["NEAR"],
    "protocols": ["Ref Finance", "Meta Pool", "Burrow"],
    "steps": [
      {
        "action": "stake",
        "protocol": "Meta Pool",
        "asset": "NEAR",
        "amount": "30000 USDC equivalent",
        "expectedApy": 10.2,
        "riskScore": 3,
        "gasEstimate": "0.001 NEAR"
      }
    ],
    "riskLevel": "Low",
    "status": "active",
    "estimatedApy": 9.5,
    "actualApy": 9.8,
    "confidence": 92,
    "executionHistory": [
      {
        "timestamp": "2024-01-20T11:00:00.000Z",
        "action": "Stake NEAR tokens",
        "status": "success",
        "transactionHash": "0x123...abc",
        "gasUsed": "0.001 NEAR"
      }
    ],
    "performance": {
      "totalInvested": 50000,
      "currentValue": 52450,
      "totalReturns": 2450,
      "roi": 4.9,
      "lastUpdated": "2024-01-20T15:30:00.000Z"
    }
  }
}
```

## Execution Endpoints (Protected)

### POST /api/v1/execution/execute
Execute a strategy on-chain.

**Authentication:** Required

**cURL Example:**
```bash
curl -X POST http://localhost:3001/api/v1/execution/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{
    "strategyId": "strat_1642680600000",
    "dryRun": false
  }'
```

**Request Body:**
```json
{
  "strategyId": "strat_1642680600000",
  "dryRun": false
}
```

**Response:**
```json
{
  "success": true,
  "execution": {
    "id": "exec_1642680700000",
    "strategyId": "strat_1642680600000",
    "status": "pending",
    "steps": [
      {
        "stepId": 1,
        "action": "stake",
        "status": "pending",
        "estimatedGas": "0.001 NEAR"
      }
    ],
    "startedAt": "2024-01-20T11:00:00.000Z"
  }
}
```

### GET /api/v1/execution/status/:executionId
Get execution status.

**Authentication:** Required

**cURL Example:**
```bash
curl -X GET http://localhost:3001/api/v1/execution/status/exec_1642680700000 \
  -H "Authorization: Bearer <your_jwt_token>"
```

**Response:**
```json
{
  "success": true,
  "execution": {
    "id": "exec_1642680700000",
    "strategyId": "strat_1642680600000",
    "status": "completed",
    "steps": [
      {
        "stepId": 1,
        "action": "stake",
        "status": "success",
        "transactionHash": "0x123...abc",
        "gasUsed": "0.0008 NEAR",
        "completedAt": "2024-01-20T11:02:00.000Z"
      }
    ],
    "startedAt": "2024-01-20T11:00:00.000Z",
    "completedAt": "2024-01-20T11:02:00.000Z"
  }
}
```

## Monitoring Endpoints (Protected)

### GET /api/v1/monitoring/portfolio
Get portfolio overview.

**Authentication:** Required

**cURL Example:**
```bash
curl -X GET http://localhost:3001/api/v1/monitoring/portfolio \
  -H "Authorization: Bearer <your_jwt_token>"
```

**Response:**
```json
{
  "success": true,
  "portfolio": {
    "totalValue": 105250.75,
    "totalInvested": 100000,
    "totalReturns": 5250.75,
    "roi": 5.25,
    "strategies": [
      {
        "id": "strat_1642680600000",
        "value": 52450,
        "invested": 50000,
        "returns": 2450,
        "roi": 4.9,
        "status": "active"
      },
      {
        "id": "strat_1642680800000",
        "value": 52800.75,
        "invested": 50000,
        "returns": 2800.75,
        "roi": 5.6,
        "status": "active"
      }
    ],
    "lastUpdated": "2024-01-20T15:30:00.000Z"
  }
}
```

### GET /api/v1/monitoring/performance/:strategyId
Get strategy performance metrics.

**Authentication:** Required

**cURL Example:**
```bash
curl -X GET "http://localhost:3001/api/v1/monitoring/performance/strat_1642680600000?period=7d" \
  -H "Authorization: Bearer <your_jwt_token>"
```

**Query Parameters:**
- `period` (optional): Time period (1d, 7d, 30d, 90d, 1y) (default: 7d)

**Response:**
```json
{
  "success": true,
  "performance": {
    "strategyId": "strat_1642680600000",
    "period": "7d",
    "metrics": {
      "currentValue": 52450,
      "invested": 50000,
      "returns": 2450,
      "roi": 4.9,
      "apy": 9.8,
      "volatility": 2.1,
      "sharpeRatio": 1.85
    },
    "timeSeries": [
      {
        "timestamp": "2024-01-14T00:00:00.000Z",
        "value": 50000,
        "returns": 0
      },
      {
        "timestamp": "2024-01-15T00:00:00.000Z",
        "value": 50345,
        "returns": 345
      },
      {
        "timestamp": "2024-01-20T15:30:00.000Z",
        "value": 52450,
        "returns": 2450
      }
    ]
  }
}
```

## GraphQL Endpoint

### POST /graphql
GraphQL endpoint for complex queries.

**Authentication:** Required (for protected queries)

**cURL Example:**
```bash
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{
    "query": "query GetUserStrategies($userId: ID!) { user(id: $userId) { id walletAddress strategies { id goal status estimatedApy riskLevel createdAt } } }",
    "variables": {
      "userId": "user_1642680500000"
    }
  }'
```

**GraphQL Schema Highlights:**
```graphql
type User {
  id: ID!
  walletAddress: String!
  strategies: [Strategy!]!
  totalInvested: Float
  totalReturns: Float
}

type Strategy {
  id: ID!
  goal: String!
  status: StrategyStatus!
  estimatedApy: Float!
  riskLevel: RiskLevel!
  chains: [String!]!
  protocols: [String!]!
  createdAt: String!
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation Error",
  "details": "Required field 'prompt' is missing",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid authentication credentials",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Route /api/v1/invalid not found",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "OpenRouter API error: 503 - Service temporarily unavailable",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

## Rate Limiting

- **Window**: 15 minutes (900,000ms)
- **Max Requests**: 100 per IP
- **Headers**: Rate limit info included in response headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642681500
```

## Postman Collection

Import this collection URL into Postman:
```
https://api.postman.com/collections/yetify-backend-v1
```

Or use this environment setup:
```json
{
  "name": "Yetify Local",
  "values": [
    {
      "key": "base_url",
      "value": "http://localhost:3001"
    },
    {
      "key": "auth_token",
      "value": "{{your_jwt_token}}"
    }
  ]
}
```

## SDK Examples

### JavaScript/TypeScript SDK Usage
```typescript
import { YetifyApiClient } from '@yetify/api-client';

const client = new YetifyApiClient('http://localhost:3001');
client.setAuthToken('your_jwt_token');

// Generate strategy
const strategy = await client.strategies.generate({
  prompt: 'Earn 10% APY on $5000 with medium risk',
  riskTolerance: 'medium',
  investmentAmount: 5000
});

// Execute strategy
const execution = await client.execution.execute(strategy.id);

// Monitor performance
const performance = await client.monitoring.getPerformance(strategy.id, '7d');
```

This documentation provides complete API reference for integrating with the Yetify Backend services.