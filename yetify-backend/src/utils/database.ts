import mongoose from 'mongoose';
import { logger } from './logger';

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
        bufferMaxEntries: 0,
        retryWrites: true,
        retryReads: true,
      };

      logger.info('Connecting to MongoDB...', { uri: this.maskUri(connectionUri) });

      await mongoose.connect(connectionUri, options);
      this.connection = mongoose.connection;

      this.setupEventHandlers();
      
      logger.info('Successfully connected to MongoDB');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw new Error(`Database connection failed: ${error.message}`);
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
      await mongoose.connection.db.admin().ping();
      
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
        details: { error: error.message }
      };
    }
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    this.connection.on('connected', () => {
      logger.info('MongoDB connected event');
    });

    this.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected event');
    });

    this.connection.on('error', (error) => {
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
export const UserSchema = new mongoose.Schema({
  walletAddress: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  walletType: { 
    type: String, 
    enum: ['metamask', 'near', 'walletconnect'], 
    required: true 
  },
  preferences: {
    riskTolerance: { 
      type: String, 
      enum: ['low', 'medium', 'high'], 
      default: 'medium' 
    },
    preferredChains: [{ 
      type: String, 
      enum: ['ethereum', 'near', 'arbitrum', 'polygon', 'optimism'] 
    }],
    notificationsEnabled: { type: Boolean, default: true },
    autoRebalancing: { type: Boolean, default: false }
  },
  strategies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Strategy'
  }],
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  totalInvested: { type: Number, default: 0 },
  totalReturns: { type: Number, default: 0 }
}, {
  timestamps: true,
  collection: 'users'
});

export const StrategySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  goal: { type: String, required: true },
  prompt: { type: String, required: true },
  chains: [{ type: String, required: true }],
  protocols: [{ type: String, required: true }],
  steps: [{
    action: { type: String, required: true },
    protocol: { type: String, required: true },
    asset: { type: String, required: true },
    amount: String,
    expectedApy: Number,
    riskScore: Number,
    gasEstimate: String,
    dependencies: [String]
  }],
  riskLevel: { 
    type: String, 
    enum: ['Low', 'Medium', 'High'], 
    required: true 
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'failed'],
    default: 'draft'
  },
  estimatedApy: { type: Number, required: true },
  estimatedTvl: { type: String, required: true },
  actualApy: Number,
  actualTvl: Number,
  executionTime: String,
  gasEstimate: {
    ethereum: String,
    near: String,
    arbitrum: String
  },
  confidence: { type: Number, min: 0, max: 100 },
  reasoning: String,
  warnings: [String],
  executionHistory: [{
    timestamp: { type: Date, default: Date.now },
    action: String,
    status: { type: String, enum: ['pending', 'success', 'failed'] },
    transactionHash: String,
    gasUsed: String,
    error: String
  }],
  performance: {
    totalInvested: { type: Number, default: 0 },
    currentValue: { type: Number, default: 0 },
    totalReturns: { type: Number, default: 0 },
    roi: { type: Number, default: 0 },
    lastUpdated: Date
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'strategies'
});

export const ProtocolSchema = new mongoose.Schema({
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
}, {
  timestamps: true,
  collection: 'protocols'
});

// Create indexes for better performance
UserSchema.index({ walletAddress: 1 });
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
