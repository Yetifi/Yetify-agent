import { AuthenticationError, UserInputError } from 'apollo-server-express';
import { StrategyEngine } from '../../ai-engine/StrategyEngine';
import { ExecutionEngine } from '../../execution-layer/ExecutionEngine';
import { MonitoringEngine } from '../../monitoring/MonitoringEngine';
import { MarketDataService } from '../../services/MarketDataService';
import { ProtocolDataService } from '../../services/ProtocolDataService';
import { User, Strategy, Protocol } from '../../utils/database';
import { logger } from '../../utils/logger';

// Initialize services
const strategyEngine = new StrategyEngine();
const executionEngine = new ExecutionEngine();
const monitoringEngine = new MonitoringEngine();
const marketDataService = MarketDataService.getInstance();
const protocolDataService = new ProtocolDataService();

export const resolvers = {
  Query: {
    // Strategy queries
    async getStrategy(_: unknown, { id }: { id: string }, context: { user?: { id: string } }) {
      try {
        const strategy = await Strategy.findOne({ id }).populate('userId');
        if (!strategy) {
          throw new UserInputError('Strategy not found');
        }
        
        // Check if user owns this strategy
        if (context.user && strategy.userId.toString() !== context.user.id) {
          throw new AuthenticationError('Access denied');
        }
        
        return strategy;
      } catch (error) {
        logger.error('Failed to get strategy:', error);
        throw error;
      }
    },

    async getUserStrategies(_: unknown, { userId }: { userId: string }, context: { user?: { id: string } }) {
      try {
        // Verify user access
        if (!context.user || context.user.id !== userId) {
          throw new AuthenticationError('Access denied');
        }
        
        const strategies = await Strategy.find({ userId }).sort({ createdAt: -1 });
        return strategies;
      } catch (error) {
        logger.error('Failed to get user strategies:', error);
        throw error;
      }
    },

    async getActiveStrategies(_: unknown, __: unknown, context: { user?: { id: string; isAdmin?: boolean } }) {
      try {
        if (!context.user?.isAdmin) {
          throw new AuthenticationError('Admin access required');
        }
        
        const strategies = await Strategy.find({ status: 'active' })
          .populate('userId')
          .sort({ createdAt: -1 });
        return strategies;
      } catch (error) {
        logger.error('Failed to get active strategies:', error);
        throw error;
      }
    },

    // Market data queries
    async getMarketSummary() {
      try {
        const summary = await marketDataService.getCurrentAPYs();
        return summary;
      } catch (error) {
        logger.error('Failed to get market summary:', error);
        throw new Error('Market data unavailable');
      }
    },

    async getTokenPrices(_: unknown, { symbols }: { symbols: string[] }) {
      try {
        const pricesMap = await marketDataService.getTokenPrices(symbols);
        return Array.from(pricesMap.values());
      } catch (error) {
        logger.error('Failed to get token prices:', error);
        throw new Error('Price data unavailable');
      }
    },

    async getProtocols(_: unknown, { chain, category }: { chain?: string; category?: string }) {
      try {
        let protocols = await protocolDataService.getTopProtocols();
        
        if (chain) {
          protocols = protocols.filter(p => p.chain.toLowerCase() === chain.toLowerCase());
        }
        
        if (category) {
          protocols = protocols.filter(p => p.category === category);
        }
        
        return protocols;
      } catch (error) {
        logger.error('Failed to get protocols:', error);
        throw new Error('Protocol data unavailable');
      }
    },

    async getGasPrices() {
      try {
        return await marketDataService.getGasPrices();
      } catch (error) {
        logger.error('Failed to get gas prices:', error);
        throw new Error('Gas price data unavailable');
      }
    },

    // Monitoring queries
    async getStrategyPerformance(_: unknown, { strategyId }: { strategyId: string }, context: { user?: { id: string } }) {
      try {
        const strategy = await Strategy.findOne({ id: strategyId });
        if (!strategy) {
          throw new UserInputError('Strategy not found');
        }
        
        // Check access
        if (context.user && strategy.userId.toString() !== context.user.id) {
          throw new AuthenticationError('Access denied');
        }
        
        return await monitoringEngine.getStrategyPerformance(strategyId);
      } catch (error) {
        logger.error('Failed to get strategy performance:', error);
        throw error;
      }
    },

    async getActiveAlerts(_: unknown, { userId }: { userId: string }, context: { user?: { id: string } }) {
      try {
        if (!context.user || context.user.id !== userId) {
          throw new AuthenticationError('Access denied');
        }
        
        return await monitoringEngine.getActiveAlerts(userId);
      } catch (error) {
        logger.error('Failed to get active alerts:', error);
        throw error;
      }
    },

    async getRebalanceRecommendations(_: unknown, { userId }: { userId: string }, context: { user?: { id: string } }) {
      try {
        if (!context.user || context.user.id !== userId) {
          throw new AuthenticationError('Access denied');
        }
        
        return await monitoringEngine.getRebalanceRecommendations(userId);
      } catch (error) {
        logger.error('Failed to get rebalance recommendations:', error);
        throw error;
      }
    },

    // User queries
    async getUser(_: unknown, { walletAddress }: { walletAddress: string }) {
      try {
        const user = await User.findOne({ walletAddress }).populate('strategies');
        return user;
      } catch (error) {
        logger.error('Failed to get user:', error);
        throw error;
      }
    },

    async getUserProfile(_: unknown, { id }: { id: string }, context: { user?: { id: string } }) {
      try {
        if (!context.user || context.user.id !== id) {
          throw new AuthenticationError('Access denied');
        }
        
        const user = await User.findById(id).populate('strategies');
        return user;
      } catch (error) {
        logger.error('Failed to get user profile:', error);
        throw error;
      }
    }
  },

  Mutation: {
    // Strategy mutations
    async generateStrategy(_: unknown, { input }: { input: any }, context: { user?: { id: string } }) {
      try {
        logger.ai('Generating strategy via GraphQL', { prompt: input.prompt });
        
        const strategy = await strategyEngine.generateStrategy(input);
        
        // Save strategy to database
        const savedStrategy = await Strategy.create({
          ...strategy,
          userId: context.user?.id,
          prompt: input.prompt,
          status: 'draft'
        });

        // Estimate gas costs
        const gasEstimate = await executionEngine.estimateGasForStrategy({
          userAddress: input.userAddress,
          strategy,
          walletType: 'metamask', // Default
          investmentAmount: input.investmentAmount || 1000,
          slippageTolerance: 2,
          gasPreference: 'standard'
        });

        return {
          strategy: savedStrategy,
          confidence: strategy.confidence,
          alternatives: [], // Could generate alternative strategies
          estimatedGas: gasEstimate
        };
      } catch (error) {
        logger.error('Strategy generation failed:', error);
        throw new Error(`Strategy generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    async executeStrategy(_: unknown, { input }: { input: any }, context: { user?: { id: string } }) {
      try {
        const strategy = await Strategy.findOne({ id: input.strategyId });
        if (!strategy) {
          throw new UserInputError('Strategy not found');
        }

        // Check ownership
        if (context.user && strategy.userId.toString() !== context.user.id) {
          throw new AuthenticationError('Access denied');
        }

        const executionContext = {
          userAddress: input.userAddress,
          strategy: {
            id: strategy.id,
            goal: strategy.goal,
            chains: strategy.chains,
            protocols: strategy.protocols,
            steps: strategy.steps.map((step: any) => ({
              action: step.action,
              protocol: step.protocol,
              asset: step.asset,
              amount: step.amount || undefined,
              expectedApy: step.expectedApy || undefined,
              riskScore: step.riskScore || undefined,
              gasEstimate: step.gasEstimate || undefined,
              dependencies: step.dependencies || []
            })),
            riskLevel: strategy.riskLevel,
            estimatedApy: strategy.estimatedApy,
            estimatedTvl: strategy.estimatedTvl,
            executionTime: strategy.executionTime || '~5 minutes',
            gasEstimate: {
              ethereum: strategy.gasEstimate?.ethereum || '0.02 ETH',
              near: strategy.gasEstimate?.near || '0.1 NEAR',
              arbitrum: strategy.gasEstimate?.arbitrum || '0.005 ETH'
            },
            confidence: strategy.confidence || 85,
            reasoning: strategy.reasoning || 'Strategy generated based on market conditions',
            warnings: strategy.warnings || []
          },
          walletType: input.walletType || 'metamask',
          investmentAmount: input.investmentAmount,
          slippageTolerance: input.slippageTolerance,
          gasPreference: input.gasPreference
        };

        const results = await executionEngine.executeStrategy(executionContext);
        
        // Update strategy status
        await Strategy.findByIdAndUpdate(strategy._id, {
          status: results.every(r => r.status === 'success') ? 'active' : 'failed',
          executionHistory: results
        });

        const totalGasUsed = results.reduce((sum, r) => {
          const gas = parseFloat(r.gasUsed?.replace(/[^\d.]/g, '') || '0');
          return sum + gas;
        }, 0);

        return {
          success: results.every(r => r.status === 'success'),
          strategyId: input.strategyId,
          executedSteps: results,
          totalGasUsed: totalGasUsed.toString(),
          totalCost: `$${(totalGasUsed * 0.001).toFixed(2)}`, // Rough estimate
          estimatedCompletionTime: '5-10 minutes'
        };
      } catch (error) {
        logger.error('Strategy execution failed:', error);
        throw new Error(`Execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    async updateStrategy(_: unknown, { id, input }: { id: string; input: any }, context: { user?: { id: string } }) {
      try {
        const strategy = await Strategy.findOne({ id });
        if (!strategy) {
          throw new UserInputError('Strategy not found');
        }

        // Check ownership
        if (context.user && strategy.userId.toString() !== context.user.id) {
          throw new AuthenticationError('Access denied');
        }

        const updatedStrategy = await Strategy.findByIdAndUpdate(
          strategy._id,
          { ...input, updatedAt: new Date() },
          { new: true }
        );

        return updatedStrategy;
      } catch (error) {
        logger.error('Strategy update failed:', error);
        throw error;
      }
    },

    async pauseStrategy(_: unknown, { id }: { id: string }, context: { user?: { id: string } }) {
      try {
        const strategy = await Strategy.findOne({ id });
        if (!strategy) {
          throw new UserInputError('Strategy not found');
        }

        // Check ownership
        if (context.user && strategy.userId.toString() !== context.user.id) {
          throw new AuthenticationError('Access denied');
        }

        const updatedStrategy = await Strategy.findByIdAndUpdate(
          strategy._id,
          { status: 'paused', updatedAt: new Date() },
          { new: true }
        );

        return updatedStrategy;
      } catch (error) {
        logger.error('Strategy pause failed:', error);
        throw error;
      }
    },

    async resumeStrategy(_: unknown, { id }: { id: string }, context: { user?: { id: string } }) {
      try {
        const strategy = await Strategy.findOne({ id });
        if (!strategy) {
          throw new UserInputError('Strategy not found');
        }

        // Check ownership
        if (context.user && strategy.userId.toString() !== context.user.id) {
          throw new AuthenticationError('Access denied');
        }

        const updatedStrategy = await Strategy.findByIdAndUpdate(
          strategy._id,
          { status: 'active', updatedAt: new Date() },
          { new: true }
        );

        return updatedStrategy;
      } catch (error) {
        logger.error('Strategy resume failed:', error);
        throw error;
      }
    },

    async deleteStrategy(_: unknown, { id }: { id: string }, context: { user?: { id: string } }) {
      try {
        const strategy = await Strategy.findOne({ id });
        if (!strategy) {
          throw new UserInputError('Strategy not found');
        }

        // Check ownership
        if (context.user && strategy.userId.toString() !== context.user.id) {
          throw new AuthenticationError('Access denied');
        }

        await Strategy.findByIdAndDelete(strategy._id);
        return true;
      } catch (error) {
        logger.error('Strategy deletion failed:', error);
        throw error;
      }
    },

    // User mutations
    async createUser(_: unknown, { input }: { input: any }) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ walletAddress: input.walletAddress });
        if (existingUser) {
          throw new UserInputError('User already exists');
        }

        const user = await User.create({
          ...input,
          preferences: input.preferences || {
            riskTolerance: 'medium',
            preferredChains: ['ethereum'],
            notificationsEnabled: true,
            autoRebalancing: false
          }
        });

        return user;
      } catch (error) {
        logger.error('User creation failed:', error);
        throw error;
      }
    },

    async updateUserPreferences(_: unknown, { userId, preferences }: { userId: string; preferences: any }, context: { user?: { id: string } }) {
      try {
        if (!context.user || context.user.id !== userId) {
          throw new AuthenticationError('Access denied');
        }

        const user = await User.findByIdAndUpdate(
          userId,
          { preferences, lastActive: new Date() },
          { new: true }
        );

        return user;
      } catch (error) {
        logger.error('User preferences update failed:', error);
        throw error;
      }
    },

    // Alert mutations
    async acknowledgeAlert(_: unknown, { alertId }: { alertId: string }, context: { user?: { id: string } }) {
      try {
        // In production, find and update alert in database
        // For now, return mock acknowledged alert
        return {
          id: alertId,
          strategyId: 'mock_strategy',
          type: 'PRICE_DROP',
          severity: 'MEDIUM',
          message: 'Alert acknowledged',
          recommendations: [],
          timestamp: new Date().toISOString(),
          acknowledged: true
        };
      } catch (error) {
        logger.error('Alert acknowledgment failed:', error);
        throw error;
      }
    },

    async executeRebalance(_: unknown, { recommendationId }: { recommendationId: string }, context: { user?: { id: string } }) {
      try {
        // Mock rebalance execution
        logger.execution('Rebalance executed', { recommendationId });
        
        return {
          success: true,
          strategyId: 'mock_strategy',
          executedSteps: [],
          totalGasUsed: '0.02',
          totalCost: '$5.00',
          estimatedCompletionTime: '3-5 minutes'
        };
      } catch (error) {
        logger.error('Rebalance execution failed:', error);
        throw error;
      }
    }
  },

  Subscription: {
    strategyUpdated: {
      // WebSocket subscription for real-time strategy updates
      subscribe: () => {
        // Implementation would use pubsub system like Redis
        // For now, return mock subscription
      }
    },

    newAlert: {
      // WebSocket subscription for new alerts
      subscribe: () => {
        // Implementation would use pubsub system
      }
    },

    priceUpdated: {
      // WebSocket subscription for price updates
      subscribe: () => {
        // Implementation would use pubsub system
      }
    },

    executionProgress: {
      // WebSocket subscription for execution progress
      subscribe: () => {
        // Implementation would use pubsub system
      }
    }
  },

  // Custom scalar resolvers
  Date: {
    serialize: (date: Date) => date.toISOString(),
    parseValue: (value: string) => new Date(value),
    parseLiteral: (ast: any) => new Date(ast.value)
  },

  JSON: {
    serialize: (value: any) => value,
    parseValue: (value: any) => value,
    parseLiteral: (ast: any) => ast.value
  }
};
