// MongoDB initialization script for development environment
// This script runs when the MongoDB container starts for the first time

print('🚀 Initializing Yetify Development Database...');

// Switch to the development database
db = db.getSiblingDB('yetify_dev');

print('📊 Creating collections...');

// Create users collection
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['walletAddress', 'walletType'],
      properties: {
        walletAddress: {
          bsonType: 'string',
          description: 'Wallet address must be a string'
        },
        walletType: {
          bsonType: 'string',
          enum: ['metamask', 'near', 'walletconnect'],
          description: 'Wallet type must be one of: metamask, near, walletconnect'
        },
        preferences: {
          bsonType: 'object',
          properties: {
            riskTolerance: {
              bsonType: 'string',
              enum: ['low', 'medium', 'high']
            },
            preferredChains: {
              bsonType: 'array',
              items: {
                bsonType: 'string'
              }
            },
            notificationsEnabled: {
              bsonType: 'bool'
            },
            autoRebalancing: {
              bsonType: 'bool'
            }
          }
        }
      }
    }
  }
});

// Create strategies collection
db.createCollection('strategies', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'userId', 'goal', 'prompt', 'chains', 'protocols', 'steps', 'riskLevel', 'status'],
      properties: {
        id: {
          bsonType: 'string',
          pattern: '^strategy_\\d+_[a-zA-Z0-9]+$',
          description: 'Strategy ID must follow pattern: strategy_timestamp_randomstring'
        },
        userId: {
          bsonType: 'objectId',
          description: 'User ID must be a valid ObjectId'
        },
        goal: {
          bsonType: 'string',
          minLength: 5,
          maxLength: 500,
          description: 'Goal must be between 5 and 500 characters'
        },
        prompt: {
          bsonType: 'string',
          minLength: 10,
          maxLength: 2000,
          description: 'Prompt must be between 10 and 2000 characters'
        },
        chains: {
          bsonType: 'array',
          items: {
            bsonType: 'string',
            enum: ['Ethereum', 'NEAR', 'Arbitrum', 'Polygon', 'Optimism', 'Base']
          },
          minItems: 1,
          description: 'Must include at least one supported chain'
        },
        protocols: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          minItems: 1,
          description: 'Must include at least one protocol'
        },
        steps: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['stepId', 'order', 'action', 'protocol', 'asset'],
            properties: {
              stepId: { bsonType: 'string' },
              order: { bsonType: 'int', minimum: 1 },
              action: {
                bsonType: 'string',
                enum: ['deposit', 'stake', 'yield_farm', 'provide_liquidity', 'leverage', 'bridge', 'swap', 'withdraw']
              },
              protocol: { bsonType: 'string' },
              asset: { bsonType: 'string' },
              amount: { bsonType: 'string' },
              expectedApy: { bsonType: 'double', minimum: 0, maximum: 1000 },
              riskScore: { bsonType: 'int', minimum: 1, maximum: 10 },
              gasEstimate: { bsonType: 'string' },
              dependencies: {
                bsonType: 'array',
                items: { bsonType: 'string' }
              }
            }
          },
          minItems: 1,
          description: 'Must include at least one step'
        },
        riskLevel: {
          bsonType: 'string',
          enum: ['Low', 'Medium', 'High'],
          description: 'Risk level must be Low, Medium, or High'
        },
        status: {
          bsonType: 'string',
          enum: ['draft', 'active', 'paused', 'completed', 'failed', 'cancelled'],
          description: 'Status must be one of the allowed values'
        },
        estimatedApy: {
          bsonType: 'double',
          minimum: 0,
          maximum: 1000,
          description: 'Estimated APY must be between 0 and 1000'
        },
        confidence: {
          bsonType: 'int',
          minimum: 0,
          maximum: 100,
          description: 'Confidence must be between 0 and 100'
        }
      }
    }
  }
});

// Create protocols collection for market data
db.createCollection('protocols', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'name', 'chain', 'category', 'tvl', 'apy', 'riskScore'],
      properties: {
        id: { bsonType: 'string' },
        name: { bsonType: 'string' },
        chain: { bsonType: 'string' },
        category: {
          bsonType: 'string',
          enum: ['lending', 'dex', 'yield_farming', 'staking', 'derivatives']
        },
        tvl: { bsonType: 'double', minimum: 0 },
        apy: { bsonType: 'double', minimum: 0 },
        riskScore: { bsonType: 'int', minimum: 1, maximum: 10 }
      }
    }
  }
});

print('🔍 Creating indexes...');

// Users collection indexes
db.users.createIndex({ walletAddress: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });
db.users.createIndex({ lastActive: -1 });

// Strategies collection indexes
db.strategies.createIndex({ id: 1 }, { unique: true });
db.strategies.createIndex({ userId: 1, status: 1, createdAt: -1 });
db.strategies.createIndex({ protocols: 1, status: 1 });
db.strategies.createIndex({ chains: 1, status: 1 });
db.strategies.createIndex({ 'performance.lastUpdated': -1 });
db.strategies.createIndex({ isPublic: 1, createdAt: -1 });
db.strategies.createIndex({ goal: 'text', prompt: 'text', tags: 'text' });
db.strategies.createIndex({ deletedAt: 1 });

// Protocols collection indexes
db.protocols.createIndex({ id: 1 }, { unique: true });
db.protocols.createIndex({ name: 1, chain: 1 });
db.protocols.createIndex({ category: 1, chain: 1 });
db.protocols.createIndex({ apy: -1 });
db.protocols.createIndex({ tvl: -1 });
db.protocols.createIndex({ riskScore: 1 });

print('📝 Inserting sample data...');

// Insert sample protocols
db.protocols.insertMany([
  {
    id: 'aave-v3-ethereum',
    name: 'Aave V3',
    chain: 'Ethereum',
    category: 'lending',
    tvl: 5000000000,
    apy: 8.5,
    riskScore: 3,
    url: 'https://aave.com',
    description: 'Decentralized lending protocol',
    tokens: ['USDC', 'USDT', 'ETH', 'DAI'],
    auditStatus: 'audited',
    isActive: true,
    lastUpdated: new Date()
  },
  {
    id: 'lido-ethereum',
    name: 'Lido',
    chain: 'Ethereum',
    category: 'staking',
    tvl: 15000000000,
    apy: 4.2,
    riskScore: 2,
    url: 'https://lido.fi',
    description: 'Liquid staking for Ethereum',
    tokens: ['ETH'],
    auditStatus: 'audited',
    isActive: true,
    lastUpdated: new Date()
  },
  {
    id: 'ref-finance-near',
    name: 'Ref Finance',
    chain: 'NEAR',
    category: 'dex',
    tvl: 50000000,
    apy: 15.8,
    riskScore: 6,
    url: 'https://ref.finance',
    description: 'NEAR Protocol DEX and yield farming',
    tokens: ['NEAR', 'USDC', 'USDT'],
    auditStatus: 'audited',
    isActive: true,
    lastUpdated: new Date()
  }
]);

print('✅ Development database initialized successfully!');
print('📊 Collections created: users, strategies, protocols');
print('🔍 Indexes created for optimal query performance');
print('📝 Sample protocol data inserted');
print('');
print('🔗 Connection string: mongodb://localhost:27017/yetify_dev');
print('📖 You can now connect using: mongosh mongodb://localhost:27017/yetify_dev');
