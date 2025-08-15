import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { RedisMemoryServer } from 'redis-memory-server';
import { createClient } from 'redis';

// Global test setup
let mongoServer: MongoMemoryServer;
let redisServer: RedisMemoryServer;
let redisClient: any;

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create({
    instance: {
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
  redisServer = new RedisMemoryServer();
  
  await redisServer.start();
  const redisHost = await redisServer.getHost();
  const redisPort = await redisServer.getPort();
  
  // Connect to Redis
  redisClient = createClient({
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
  if (redisClient && redisClient.isOpen) {
    await redisClient.flushAll();
  }
  
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
        action: 'deposit' as const,
        protocol: 'Lido',
        asset: 'ETH',
        amount: '1000',
        expectedApy: 4.2
      },
      {
        action: 'stake' as const,
        protocol: 'Aave',
        asset: 'stETH',
        expectedApy: 8.5
      }
    ],
    riskLevel: 'Low' as const,
    status: 'draft' as const,
    estimatedApy: 6.35,
    estimatedTvl: '1000',
    confidence: 85,
    reasoning: 'Test strategy reasoning',
    executionTime: '2-3 minutes',
    gasEstimate: {
      ethereum: '0.02 ETH',
      near: '0.001 NEAR',
      arbitrum: '0.005 ETH'
    },
    warnings: ['High gas fees on Ethereum', 'Market volatility risk']
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

// Mock external services for testing
jest.mock('../src/services/MarketDataService', () => ({
  MarketDataService: jest.fn().mockImplementation(() => ({
    getTopProtocols: jest.fn().mockResolvedValue([
      { name: 'Aave', chain: 'Ethereum', apy: 4.2 },
      { name: 'Lido', chain: 'Ethereum', apy: 5.1 }
    ]),
    getCurrentAPYs: jest.fn().mockResolvedValue({ averageAPY: 5.5 }),
    getTVLData: jest.fn().mockResolvedValue({ total: 1000000000 }),
    getGasPrices: jest.fn().mockResolvedValue({ ethereum: '20', near: '10' }),
    getTokenPrices: jest.fn().mockResolvedValue(new Map([
      ['ETH', { price: 2000 }],
      ['NEAR', { price: 5 }]
    ])),
    getProtocolAPY: jest.fn().mockResolvedValue(5.0)
  }))
}));

jest.mock('../src/services/ProtocolDataService', () => ({
  ProtocolDataService: jest.fn().mockImplementation(() => ({
    getTopProtocols: jest.fn().mockResolvedValue([
      { name: 'Aave', chain: 'Ethereum', apy: 4.2 },
      { name: 'Lido', chain: 'Ethereum', apy: 5.1 }
    ]),
    getRiskScores: jest.fn().mockResolvedValue(new Map([
      ['Aave', { score: 3, warnings: [] }],
      ['Lido', { score: 2, warnings: [] }]
    ]))
  }))
}));

// Mock Gemini AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockImplementation((prompt) => {
        const promptText = typeof prompt === 'string' ? prompt : '';
        
        // High risk strategy
        if (promptText.includes('Maximum yield strategy') || promptText.includes('high') || promptText.includes('aggressive')) {
          return Promise.resolve({
            response: {
              text: () => JSON.stringify({
                goal: 'Aggressive high-yield strategy',
                chains: ['Ethereum'],
                protocols: ['Yearn', 'Compound'],
                steps: [{ action: 'leverage', protocol: 'Yearn', asset: 'ETH', expectedApy: 15.5 }],
                riskLevel: 'High',
                estimatedApy: 15.5,
                confidence: 70,
                reasoning: 'High-risk leveraged strategy for maximum returns',
                warnings: ['High liquidation risk', 'Extreme volatility']
              })
            }
          });
        }
        
        // Stablecoin strategy
        if (promptText.includes('stablecoin') || promptText.includes('USDC') || promptText.includes('USDT')) {
          return Promise.resolve({
            response: {
              text: () => JSON.stringify({
                goal: 'Stable yield with stablecoins',
                chains: ['Ethereum'],
                protocols: ['Aave'],
                steps: [{ action: 'yield_farm', protocol: 'Aave', asset: 'USDC', expectedApy: 8.2 }],
                riskLevel: 'Low',
                estimatedApy: 8.2,
                confidence: 90,
                reasoning: 'Stable income with minimal volatility',
                warnings: ['Smart contract risks']
              })
            }
          });
        }
        
        // Error case for invalid prompts
        if (promptText.includes('invalid') || promptText.includes('test strategy that should fail')) {
          return Promise.reject(new Error('AI service error'));
        }
        
        // Default low risk strategy
        return Promise.resolve({
          response: {
            text: () => JSON.stringify({
              goal: 'Maximize my ETH yield with low risk',
              chains: ['Ethereum'],
              protocols: ['Aave'],
              steps: [{ action: 'deposit', protocol: 'Aave', asset: 'ETH', expectedApy: 4.2 }],
              riskLevel: 'Low',
              estimatedApy: 4.2,
              confidence: 85,
              reasoning: 'This strategy focuses on low-risk ETH yield generation',
              warnings: ['Smart contract risks apply']
            })
          }
        });
      })
    })
  }))
}));

// Mock OpenAI/LangChain
jest.mock('@langchain/openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockImplementation(() => {
      return Promise.resolve({
        content: JSON.stringify({
          goal: 'Maximize my ETH yield with low risk',
          chains: ['Ethereum'],
          protocols: ['Aave'],
          steps: [{ action: 'deposit', protocol: 'Aave', asset: 'ETH', expectedApy: 4.2 }],
          riskLevel: 'Low',
          estimatedApy: 4.2,
          confidence: 85,
          reasoning: 'This strategy focuses on low-risk ETH yield generation',
          warnings: ['Smart contract risks apply']
        })
      });
    })
  })),
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        goal: 'Maximize my ETH yield with low risk',
        chains: ['Ethereum'],
        protocols: ['Aave'],
        steps: [{ action: 'deposit', protocol: 'Aave', asset: 'ETH', expectedApy: 4.2 }],
        riskLevel: 'Low',
        estimatedApy: 4.2,
        confidence: 85,
        reasoning: 'This strategy focuses on low-risk ETH yield generation',
        warnings: ['Smart contract risks apply']
      })
    })
  }))
}));

// Mock LangChain components
jest.mock('langchain/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            goal: 'Test strategy',
            chains: ['Ethereum'],
            protocols: ['Aave'],
            steps: [{ action: 'deposit', protocol: 'Aave', asset: 'ETH', expectedApy: 4.2 }],
            riskLevel: 'Low',
            estimatedApy: 4.2,
            confidence: 85,
            reasoning: 'Test strategy reasoning',
            warnings: ['Test warning']
          })
        })
      })
    })
  }
}));

// Mock Pinecone
jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('langchain/vectorstores/pinecone', () => ({
  PineconeStore: {
    fromExistingIndex: jest.fn().mockResolvedValue({
      similaritySearch: jest.fn().mockResolvedValue([
        { pageContent: 'Mock knowledge base content' }
      ])
    })
  }
}));

jest.mock('langchain/embeddings/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({}))
}));

// Mock logger for testing
jest.mock('../src/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    strategy: jest.fn(),
    ai: jest.fn(),
    execution: jest.fn(),
    monitoring: jest.fn(),
    blockchain: jest.fn(),
    performance: jest.fn(),
    security: jest.fn(),
    request: jest.fn(),
  }),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    strategy: jest.fn(),
    ai: jest.fn(),
    execution: jest.fn(),
    monitoring: jest.fn(),
    blockchain: jest.fn(),
    performance: jest.fn(),
    security: jest.fn(),
    request: jest.fn(),
  },
}));

export default testUtils;
