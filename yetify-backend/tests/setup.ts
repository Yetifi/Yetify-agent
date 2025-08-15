import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { RedisMemoryServer } from 'redis-memory-server';
import Redis from 'redis';

// Global test setup
let mongoServer: MongoMemoryServer;
let redisServer: RedisMemoryServer;
let redisClient: any;

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbName: 'yetify-test'
    }
  });
  
  const mongoUri = mongoServer.getUri();
  
  // Connect to MongoDB
  await mongoose.connect(mongoUri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  // Start in-memory Redis
  redisServer = new RedisMemoryServer({
    instance: {
      port: 6379
    }
  });
  
  await redisServer.start();
  const redisHost = await redisServer.getHost();
  const redisPort = await redisServer.getPort();
  
  // Connect to Redis
  redisClient = Redis.createClient({
    url: `redis://${redisHost}:${redisPort}`
  });
  
  await redisClient.connect();

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
  process.env.ENCRYPTION_KEY = 'test_encryption_key_32_characters';
  process.env.MONGODB_URI = mongoUri;
  process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`;
  
  // Mock external API keys for testing
  process.env.OPENAI_API_KEY = 'test_openai_key';
  process.env.GEMINI_API_KEY = 'test_gemini_key';
  process.env.PINECONE_API_KEY = 'test_pinecone_key';
  process.env.PINECONE_ENVIRONMENT = 'test';
  process.env.PINECONE_INDEX = 'test-index';
  
  // Mock blockchain RPC URLs
  process.env.ETHEREUM_RPC_URL = 'https://test-rpc.example.com';
  process.env.NEAR_NODE_URL = 'https://test-near-rpc.example.com';
  process.env.ARBITRUM_RPC_URL = 'https://test-arbitrum-rpc.example.com';
  
  console.log('🧪 Test environment setup complete');
});

// Cleanup after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  
  // Clear Redis
  await redisClient.flushAll();
  
  // Reset all mocks
  jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(async () => {
  // Close connections
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  
  if (redisClient) {
    await redisClient.quit();
  }
  
  // Stop servers
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  if (redisServer) {
    await redisServer.stop();
  }
  
  console.log('🧪 Test environment cleanup complete');
});

// Global test utilities
export const testUtils = {
  // Create a test user
  createTestUser: () => ({
    walletAddress: '0x742d35Cc6097C8f4f5b2E3894C5B6545AE2A1234',
    walletType: 'metamask',
    preferences: {
      riskTolerance: 'medium',
      preferredChains: ['ethereum'],
      notificationsEnabled: true,
      autoRebalancing: false
    }
  }),

  // Create a test strategy
  createTestStrategy: () => ({
    id: 'test_strategy_123',
    goal: 'Test strategy for maximum ETH yield',
    prompt: 'Maximize my ETH yield with low risk',
    chains: ['Ethereum'],
    protocols: ['Aave', 'Lido'],
    steps: [
      {
        action: 'deposit',
        protocol: 'Lido',
        asset: 'ETH',
        amount: '1000',
        expectedApy: 4.2
      },
      {
        action: 'stake',
        protocol: 'Aave',
        asset: 'stETH',
        expectedApy: 8.5
      }
    ],
    riskLevel: 'Low',
    status: 'draft',
    estimatedApy: 6.35,
    estimatedTvl: '1000',
    confidence: 85,
    reasoning: 'Test strategy reasoning'
  }),

  // Generate test JWT token
  generateTestToken: (payload: any) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  },

  // Wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock external API responses
  mockApiResponse: (data: any, status = 200) => ({
    data,
    status,
    headers: {},
    config: {},
    statusText: 'OK'
  })
};

// Global type definitions for tests
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidObjectId(): R;
      toBeValidStrategy(): R;
      toBeValidUser(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidObjectId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false,
      };
    }
  },

  toBeValidStrategy(received) {
    const requiredFields = ['id', 'goal', 'chains', 'protocols', 'steps', 'riskLevel'];
    const hasRequiredFields = requiredFields.every(field => received.hasOwnProperty(field));
    
    if (hasRequiredFields) {
      return {
        message: () => `expected strategy to be invalid`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected strategy to have required fields: ${requiredFields.join(', ')}`,
        pass: false,
      };
    }
  },

  toBeValidUser(received) {
    const requiredFields = ['walletAddress', 'walletType'];
    const hasRequiredFields = requiredFields.every(field => received.hasOwnProperty(field));
    
    if (hasRequiredFields) {
      return {
        message: () => `expected user to be invalid`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected user to have required fields: ${requiredFields.join(', ')}`,
        pass: false,
      };
    }
  }
});

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

export default testUtils;
