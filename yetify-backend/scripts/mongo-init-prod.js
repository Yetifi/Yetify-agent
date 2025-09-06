// MongoDB initialization script for production environment
// This script runs when the MongoDB container starts for the first time

print('🚀 Initializing Yetify Production Database...');

// Switch to the production database
db = db.getSiblingDB('yetify');

print('👤 Creating application users...');

// Create application user with limited permissions
db.createUser({
  user: 'yetify_app',
  pwd: 'yetify_app_secure_password_2024',
  roles: [
    {
      role: 'readWrite',
      db: 'yetify'
    }
  ]
});

// Create monitoring user (read-only)
db.createUser({
  user: 'yetify_monitor',
  pwd: 'yetify_monitor_secure_password_2024',
  roles: [
    {
      role: 'read',
      db: 'yetify'
    }
  ]
});

print('📊 Creating collections with validation...');

// Create users collection with strict validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['walletAddress', 'walletType', 'createdAt'],
      properties: {
        walletAddress: {
          bsonType: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$',
          description: 'Wallet address must be valid Ethereum or NEAR format'
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
                bsonType: 'string',
                enum: ['Ethereum', 'NEAR', 'Arbitrum', 'Polygon', 'Optimism', 'Base']
              }
            },
            notificationsEnabled: {
              bsonType: 'bool'
            },
            autoRebalancing: {
              bsonType: 'bool'
            }
          }
        },
        totalInvested: {
          bsonType: 'double',
          minimum: 0,
          description: 'Total invested amount must be non-negative'
        },
        totalReturns: {
          bsonType: 'double',
          description: 'Total returns can be negative or positive'
        }
      }
    }
  }
});

// Create strategies collection with comprehensive validation
db.createCollection('strategies', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'userId', 'goal', 'prompt', 'chains', 'protocols', 'steps', 'riskLevel', 'status', 'estimatedApy', 'confidence'],
      properties: {
        id: {
          bsonType: 'string',
          pattern: '^strategy_\\d+_[a-zA-Z0-9]{9}$',
          description: 'Strategy ID must follow pattern: strategy_timestamp_randomstring'
        },
        userId: {
          bsonType: 'objectId',
          description: 'User ID must be a valid ObjectId'
        },
        version: {
          bsonType: 'int',
          minimum: 1,
          description: 'Version must be a positive integer'
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
        metadata: {
          bsonType: 'object',
          properties: {
            investmentAmount: {
              bsonType: 'double',
              minimum: 0,
              description: 'Investment amount must be non-negative'
            },
            currency: {
              bsonType: 'string',
              enum: ['USDC', 'USDT', 'ETH', 'NEAR', 'BTC']
            },
            timeHorizon: {
              bsonType: 'string',
              enum: ['short', 'medium', 'long']
            },
            riskTolerance: {
              bsonType: 'string',
              enum: ['low', 'medium', 'high']
            },
            userExperience: {
              bsonType: 'string',
              enum: ['beginner', 'intermediate', 'advanced']
            }
          }
        },
        chains: {
          bsonType: 'array',
          items: {
            bsonType: 'string',
            enum: ['Ethereum', 'NEAR', 'Arbitrum', 'Polygon', 'Optimism', 'Base']
          },
          minItems: 1,
          maxItems: 5,
          description: 'Must include 1-5 supported chains'
        },
        protocols: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          minItems: 1,
          maxItems: 10,
          description: 'Must include 1-10 protocols'
        },
        steps: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['stepId', 'order', 'action', 'protocol', 'asset'],
            properties: {
              stepId: { 
                bsonType: 'string',
                pattern: '^step_\\d+$'
              },
              order: { 
                bsonType: 'int', 
                minimum: 1,
                maximum: 20
              },
              action: {
                bsonType: 'string',
                enum: ['deposit', 'stake', 'yield_farm', 'provide_liquidity', 'leverage', 'bridge', 'swap', 'withdraw']
              },
              protocol: { 
                bsonType: 'string',
                minLength: 1,
                maxLength: 50
              },
              asset: { 
                bsonType: 'string',
                minLength: 1,
                maxLength: 20
              },
              amount: { 
                bsonType: 'string',
                maxLength: 50
              },
              expectedApy: { 
                bsonType: 'double', 
                minimum: 0, 
                maximum: 1000 
              },
              riskScore: { 
                bsonType: 'int', 
                minimum: 1, 
                maximum: 10 
              },
              gasEstimate: { 
                bsonType: 'string',
                maxLength: 50
              },
              dependencies: {
                bsonType: 'array',
                items: { 
                  bsonType: 'string',
                  pattern: '^step_\\d+$'
                }
              },
              conditions: {
                bsonType: 'object',
                properties: {
                  minAmount: { bsonType: 'double', minimum: 0 },
                  maxSlippage: { bsonType: 'double', minimum: 0, maximum: 100 },
                  maxGasPrice: { bsonType: 'string', maxLength: 50 }
                }
              }
            }
          },
          minItems: 1,
          maxItems: 20,
          description: 'Must include 1-20 steps'
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
        estimatedTvl: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 50,
          description: 'Estimated TVL must be a string'
        },
        actualApy: {
          bsonType: 'double',
          minimum: 0,
          maximum: 1000
        },
        actualTvl: {
          bsonType: 'double',
          minimum: 0
        },
        confidence: {
          bsonType: 'int',
          minimum: 0,
          maximum: 100,
          description: 'Confidence must be between 0 and 100'
        },
        reasoning: {
          bsonType: 'string',
          maxLength: 1000,
          description: 'Reasoning must not exceed 1000 characters'
        },
        warnings: {
          bsonType: 'array',
          items: {
            bsonType: 'string',
            maxLength: 200
          },
          maxItems: 10
        },
        performance: {
          bsonType: 'object',
          properties: {
            totalInvested: { bsonType: 'double', minimum: 0 },
            currentValue: { bsonType: 'double', minimum: 0 },
            totalReturns: { bsonType: 'double' },
            roi: { bsonType: 'double' },
            lastUpdated: { bsonType: 'date' },
            dailyReturns: {
              bsonType: 'array',
              items: {
                bsonType: 'object',
                required: ['date', 'value', 'returns'],
                properties: {
                  date: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                  value: { bsonType: 'double', minimum: 0 },
                  returns: { bsonType: 'double' }
                }
              }
            }
          }
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string',
            maxLength: 50
          },
          maxItems: 20
        },
        isPublic: {
          bsonType: 'bool'
        },
        deletedAt: {
          bsonType: 'date'
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
      required: ['id', 'name', 'chain', 'category', 'tvl', 'apy', 'riskScore', 'isActive', 'lastUpdated'],
      properties: {
        id: { 
          bsonType: 'string',
          pattern: '^[a-z0-9-]+$',
          description: 'Protocol ID must be lowercase with hyphens'
        },
        name: { 
          bsonType: 'string',
          minLength: 1,
          maxLength: 100
        },
        chain: { 
          bsonType: 'string',
          enum: ['Ethereum', 'NEAR', 'Arbitrum', 'Polygon', 'Optimism', 'Base']
        },
        category: {
          bsonType: 'string',
          enum: ['lending', 'dex', 'yield_farming', 'staking', 'derivatives']
        },
        tvl: { 
          bsonType: 'double', 
          minimum: 0 
        },
        apy: { 
          bsonType: 'double', 
          minimum: 0,
          maximum: 1000
        },
        riskScore: { 
          bsonType: 'int', 
          minimum: 1, 
          maximum: 10 
        },
        url: {
          bsonType: 'string',
          pattern: '^https?://.*',
          maxLength: 200
        },
        description: {
          bsonType: 'string',
          maxLength: 500
        },
        tokens: {
          bsonType: 'array',
          items: {
            bsonType: 'string',
            maxLength: 20
          },
          maxItems: 50
        },
        auditStatus: {
          bsonType: 'string',
          enum: ['audited', 'unaudited', 'partially_audited']
        },
        isActive: {
          bsonType: 'bool'
        },
        lastUpdated: {
          bsonType: 'date'
        }
      }
    }
  }
});

print('🔍 Creating indexes for optimal performance...');

// Users collection indexes
db.users.createIndex({ walletAddress: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });
db.users.createIndex({ lastActive: -1 });
db.users.createIndex({ 'preferences.riskTolerance': 1 });
db.users.createIndex({ 'preferences.preferredChains': 1 });

// Strategies collection indexes
db.strategies.createIndex({ id: 1 }, { unique: true });
db.strategies.createIndex({ userId: 1, status: 1, createdAt: -1 });
db.strategies.createIndex({ protocols: 1, status: 1 });
db.strategies.createIndex({ chains: 1, status: 1 });
db.strategies.createIndex({ 'performance.lastUpdated': -1 });
db.strategies.createIndex({ isPublic: 1, createdAt: -1 });
db.strategies.createIndex({ goal: 'text', prompt: 'text', tags: 'text' });
db.strategies.createIndex({ deletedAt: 1 });
db.strategies.createIndex({ 'metadata.investmentAmount': 1 });
db.strategies.createIndex({ 'metadata.riskTolerance': 1 });
db.strategies.createIndex({ riskLevel: 1, status: 1 });
db.strategies.createIndex({ estimatedApy: -1 });
db.strategies.createIndex({ 'performance.roi': -1 });

// Protocols collection indexes
db.protocols.createIndex({ id: 1 }, { unique: true });
db.protocols.createIndex({ name: 1, chain: 1 });
db.protocols.createIndex({ category: 1, chain: 1 });
db.protocols.createIndex({ apy: -1 });
db.protocols.createIndex({ tvl: -1 });
db.protocols.createIndex({ riskScore: 1 });
db.protocols.createIndex({ isActive: 1, lastUpdated: -1 });
db.protocols.createIndex({ name: 'text', description: 'text' });

print('📝 Inserting initial protocol data...');

// Insert initial protocol data
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
    description: 'Decentralized lending protocol with variable interest rates',
    tokens: ['USDC', 'USDT', 'ETH', 'DAI', 'WETH'],
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
    description: 'Liquid staking for Ethereum with stETH tokens',
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
    description: 'NEAR Protocol DEX and yield farming platform',
    tokens: ['NEAR', 'USDC', 'USDT', 'wNEAR'],
    auditStatus: 'audited',
    isActive: true,
    lastUpdated: new Date()
  },
  {
    id: 'uniswap-v3-ethereum',
    name: 'Uniswap V3',
    chain: 'Ethereum',
    category: 'dex',
    tvl: 3000000000,
    apy: 12.5,
    riskScore: 4,
    url: 'https://uniswap.org',
    description: 'Decentralized exchange with concentrated liquidity',
    tokens: ['ETH', 'USDC', 'USDT', 'DAI', 'WETH'],
    auditStatus: 'audited',
    isActive: true,
    lastUpdated: new Date()
  },
  {
    id: 'curve-finance-ethereum',
    name: 'Curve Finance',
    chain: 'Ethereum',
    category: 'dex',
    tvl: 2000000000,
    apy: 6.8,
    riskScore: 3,
    url: 'https://curve.fi',
    description: 'Stablecoin and like-asset trading with low slippage',
    tokens: ['USDC', 'USDT', 'DAI', 'FRAX'],
    auditStatus: 'audited',
    isActive: true,
    lastUpdated: new Date()
  }
]);

print('🔒 Setting up security policies...');

// Create a read-only view for monitoring
db.createView('strategy_summary', 'strategies', [
  {
    $project: {
      id: 1,
      userId: 1,
      goal: 1,
      status: 1,
      riskLevel: 1,
      estimatedApy: 1,
      'performance.roi': 1,
      'performance.totalInvested': 1,
      'performance.currentValue': 1,
      createdAt: 1,
      updatedAt: 1
    }
  }
]);

print('📊 Creating database statistics...');

// Create a function to get database statistics
db.system.js.save({
  _id: 'getDatabaseStats',
  value: function() {
    return {
      users: db.users.countDocuments(),
      strategies: db.strategies.countDocuments(),
      protocols: db.protocols.countDocuments(),
      activeStrategies: db.strategies.countDocuments({ status: 'active' }),
      totalTVL: db.strategies.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$performance.totalInvested' } } }
      ]).toArray()[0]?.total || 0
    };
  }
});

print('✅ Production database initialized successfully!');
print('📊 Collections created: users, strategies, protocols');
print('🔍 Indexes created for optimal query performance');
print('👤 Application users created: yetify_app, yetify_monitor');
print('📝 Initial protocol data inserted');
print('🔒 Security policies configured');
print('📊 Database statistics function created');
print('');
print('🔗 Application connection: mongodb://yetify_app:password@localhost:27017/yetify');
print('📖 Monitoring connection: mongodb://yetify_monitor:password@localhost:27017/yetify');
print('⚠️  Remember to change default passwords in production!');
