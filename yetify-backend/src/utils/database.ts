import mongoose from 'mongoose';
import logger from './logger';

export interface DatabaseConfig {
  uri: string;
  options: mongoose.ConnectOptions;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private connection: mongoose.Connection | null = null;

  private constructor() {}

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async connect(uri?: string): Promise<void> {
    try {
      const connectionUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/yetify';

      const options: mongoose.ConnectOptions = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        retryWrites: true,
        retryReads: true
      };

      logger.info('Connecting to MongoDB...', { uri: this.maskUri(connectionUri) });

      await mongoose.connect(connectionUri, options);
      this.connection = mongoose.connection;

      this.setupEventHandlers();

      logger.info('Successfully connected to MongoDB');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw new Error(`Database connection failed: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        this.connection = null;
        logger.info('Disconnected from MongoDB');
      }
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  getConnection(): mongoose.Connection | null {
    return this.connection;
  }

  async healthCheck(): Promise<{ status: string; latency: number; details: any }> {
    const startTime = Date.now();

    try {
      if (!this.isConnected()) {
        return {
          status: 'disconnected',
          latency: 0,
          details: { state: mongoose.connection.readyState }
        };
      }

      // Perform a simple ping operation
      await mongoose.connection.db?.admin().ping();

      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        latency,
        details: {
          state: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name
        }
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        status: 'error',
        latency,
        details: { error: (error as Error).message }
      };
    }
  }

  private setupEventHandlers(): void {
    if (!this.connection) {
      return;
    }

    this.connection.on('connected', () => {
      logger.info('MongoDB connected event');
    });

    this.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected event');
    });

    this.connection.on('error', error => {
      logger.error('MongoDB error event:', error);
    });

    this.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected event');
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await this.gracefulShutdown('SIGINT');
    });

    process.on('SIGTERM', async () => {
      await this.gracefulShutdown('SIGTERM');
    });
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`${signal} received, closing MongoDB connection...`);

    try {
      await this.disconnect();
      logger.info('MongoDB connection closed gracefully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  private maskUri(uri: string): string {
    // Mask sensitive information in URI for logging
    return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  }
}

// Create a singleton instance
const dbConnection = DatabaseConnection.getInstance();

// Export convenient functions
export const connectDatabase = async (uri?: string): Promise<void> => {
  return dbConnection.connect(uri);
};

export const disconnectDatabase = async (): Promise<void> => {
  return dbConnection.disconnect();
};

export const isDatabaseConnected = (): boolean => {
  return dbConnection.isConnected();
};

export const getDatabaseConnection = (): mongoose.Connection | null => {
  return dbConnection.getConnection();
};

export const checkDatabaseHealth = async () => {
  return dbConnection.healthCheck();
};

// Schema definitions for Yetify collections
export const UserSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true
    },
    walletType: {
      type: String,
      enum: ['metamask', 'near', 'walletconnect'],
      required: true
    },
    apiKeys: {
      openRouter: { type: String, default: undefined },
      groq: { type: String, default: undefined },
      gemini: { type: String, default: undefined }
    },
    preferences: {
      riskTolerance: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      },
      preferredChains: [
        {
          type: String,
          enum: ['ethereum', 'near', 'arbitrum', 'polygon', 'optimism']
        }
      ],
      notificationsEnabled: { type: Boolean, default: true },
      autoRebalancing: { type: Boolean, default: false }
    },
    strategies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Strategy'
      }
    ],
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    totalInvested: { type: Number, default: 0 },
    totalReturns: { type: Number, default: 0 }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

export const StrategySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    version: { type: Number, default: 1 },
    goal: { type: String, required: true, maxlength: 500 },
    prompt: { type: String, required: true, maxlength: 2000 },
    metadata: {
      investmentAmount: { type: Number, min: 0 },
      currency: { type: String, enum: ['USDC', 'USDT', 'ETH', 'NEAR', 'BTC'] },
      timeHorizon: { type: String, enum: ['short', 'medium', 'long'] },
      riskTolerance: { type: String, enum: ['low', 'medium', 'high'] },
      userExperience: { type: String, enum: ['beginner', 'intermediate', 'advanced'] }
    },
    chains: [{ 
      type: String, 
      required: true,
      enum: ['Ethereum', 'NEAR', 'Arbitrum', 'Polygon', 'Optimism', 'Base']
    }],
    protocols: [{ type: String, required: true }],
    steps: [
      {
        stepId: { type: String, required: true },
        order: { type: Number, required: true },
        action: { 
          type: String, 
          required: true,
          enum: ['deposit', 'stake', 'yield_farm', 'provide_liquidity', 'leverage', 'bridge', 'swap', 'withdraw']
        },
        protocol: { type: String, required: true },
        asset: { type: String, required: true },
        amount: String,
        expectedApy: { type: Number, min: 0, max: 1000 },
        riskScore: { type: Number, min: 1, max: 10 },
        gasEstimate: String,
        dependencies: [String],
        conditions: {
          minAmount: { type: Number },
          maxSlippage: { type: Number, min: 0, max: 100 },
          maxGasPrice: { type: String }
        }
      }
    ],
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      required: true
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed', 'failed', 'cancelled'],
      default: 'draft',
      index: true
    },
    estimatedApy: { type: Number, required: true, min: 0, max: 1000 },
    estimatedTvl: { type: String, required: true },
    actualApy: { type: Number, min: 0, max: 1000 },
    actualTvl: { type: Number, min: 0 },
    executionTime: String,
    gasEstimate: {
      ethereum: String,
      near: String,
      arbitrum: String,
      polygon: String,
      optimism: String
    },
    confidence: { type: Number, min: 0, max: 100 },
    reasoning: { type: String, maxlength: 1000 },
    warnings: [String],
    executionHistory: [
      {
        timestamp: { type: Date, default: Date.now },
        action: String,
        status: { type: String, enum: ['pending', 'success', 'failed', 'cancelled'] },
        transactionHash: String,
        gasUsed: String,
        error: String,
        blockNumber: Number,
        stepId: String
      }
    ],
    // On-chain data from NEAR blockchain
    onChain: {
      isStored: { type: Boolean, default: false },
      contractAccount: { type: String },
      transactionHash: { type: String },
      blockHeight: { type: Number },
      storedAt: { type: Date },
      nearExplorerUrl: { type: String },
      storedData: {
        creator: { type: String },
        created_at: { type: Number },
        // Complete strategy data as stored on blockchain
        completeStrategyJson: { type: String }
      },
      updateHistory: [
        {
          transactionHash: { type: String },
          updatedAt: { type: Date },
          changes: { type: String }, // JSON string of what was changed
          blockHeight: { type: Number }
        }
      ]
    },
    performance: {
      totalInvested: { type: Number, default: 0 },
      currentValue: { type: Number, default: 0 },
      totalReturns: { type: Number, default: 0 },
      roi: { type: Number, default: 0 },
      lastUpdated: { type: Date, index: true },
      dailyReturns: [{
        date: { type: String },
        value: { type: Number },
        returns: { type: Number }
      }]
    },
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: 'strategies'
  }
);

// Create indexes for better query performance
StrategySchema.index({ userId: 1, status: 1, createdAt: -1 });
StrategySchema.index({ protocols: 1, status: 1 });
StrategySchema.index({ chains: 1, status: 1 });
StrategySchema.index({ 'performance.lastUpdated': -1 });
StrategySchema.index({ isPublic: 1, createdAt: -1 });
StrategySchema.index({ goal: 'text', prompt: 'text', tags: 'text' });

export const ProtocolSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    chain: { type: String, required: true },
    category: {
      type: String,
      enum: ['lending', 'dex', 'yield_farming', 'staking', 'derivatives'],
      required: true
    },
    tvl: { type: Number, required: true },
    apy: { type: Number, required: true },
    riskScore: { type: Number, min: 1, max: 10, required: true },
    url: String,
    description: String,
    tokens: [String],
    auditStatus: {
      type: String,
      enum: ['audited', 'unaudited', 'partially_audited'],
      required: true
    },
    isActive: { type: Boolean, default: true },
    lastUpdated: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
    collection: 'protocols'
  }
);

// Create indexes for better performance (walletAddress already has unique index)
UserSchema.index({ lastActive: -1 });
StrategySchema.index({ userId: 1, status: 1 });
StrategySchema.index({ createdAt: -1 });
ProtocolSchema.index({ chain: 1, category: 1 });
ProtocolSchema.index({ tvl: -1 });

// Export models
export const User = mongoose.model('User', UserSchema);
export const Strategy = mongoose.model('Strategy', StrategySchema);
export const Protocol = mongoose.model('Protocol', ProtocolSchema);

export default {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
  getDatabaseConnection,
  checkDatabaseHealth,
  User,
  Strategy,
  Protocol
};
