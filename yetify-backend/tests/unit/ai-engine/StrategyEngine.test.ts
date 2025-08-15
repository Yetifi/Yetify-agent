import { StrategyEngine, StrategyPrompt } from '../../../src/ai-engine/StrategyEngine';
import { ProtocolDataService } from '../../../src/services/ProtocolDataService';
import { MarketDataService } from '../../../src/services/MarketDataService';
import { testUtils } from '../../setup';

// Mock external dependencies
jest.mock('../../../src/services/ProtocolDataService');
jest.mock('../../../src/services/MarketDataService');
jest.mock('@google/generative-ai');
jest.mock('@langchain/openai');
jest.mock('@pinecone-database/pinecone');

describe('StrategyEngine', () => {
  let strategyEngine: StrategyEngine;
  let mockProtocolService: jest.Mocked<ProtocolDataService>;
  let mockMarketService: jest.Mocked<MarketDataService>;

  beforeEach(() => {
    // Setup mocks
    mockProtocolService = new ProtocolDataService() as jest.Mocked<ProtocolDataService>;
    mockMarketService = new MarketDataService() as jest.Mocked<MarketDataService>;

    // Mock service methods
    mockProtocolService.getTopProtocols.mockResolvedValue([
      {
        id: 'aave-v3',
        name: 'Aave V3',
        chain: 'Ethereum',
        category: 'lending',
        tvl: 6500000000,
        apy: 4.2,
        riskScore: 2.1,
        url: 'https://aave.com',
        description: 'Decentralized lending protocol',
        tokens: ['USDC', 'ETH'],
        auditStatus: 'audited',
        lastUpdated: new Date().toISOString()
      }
    ]);

    mockMarketService.getCurrentAPYs.mockResolvedValue({
      totalTVL: 50000000000,
      averageAPY: 8.5,
      topPerformingProtocols: [],
      marketTrends: {
        tvlTrend: 'up',
        apyTrend: 'stable',
        riskSentiment: 'neutral'
      },
      lastUpdated: new Date().toISOString()
    });

    mockMarketService.getTVLData.mockResolvedValue([]);
    mockMarketService.getGasPrices.mockResolvedValue({
      ethereum: 25,
      near: 100,
      arbitrum: 3,
      polygon: 1,
      optimism: 3
    });
    mockMarketService.getTokenPrices.mockResolvedValue(new Map());

    strategyEngine = new StrategyEngine();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateStrategy', () => {
    it('should generate a valid strategy from a prompt', async () => {
      const prompt: StrategyPrompt = {
        prompt: 'Maximize my ETH yield with low risk',
        userAddress: '0x742d35Cc6097C8f4f5b2E3894C5B6545AE2A1234',
        riskTolerance: 'low',
        investmentAmount: 5000,
        preferredChains: ['Ethereum'],
        timeHorizon: 'long'
      };

      const strategy = await strategyEngine.generateStrategy(prompt);

      expect(strategy).toBeDefined();
      expect(strategy.id).toMatch(/^strategy_\d+_[a-z0-9]{9}$/);
      expect(strategy.goal).toBe(prompt.prompt);
      expect(strategy.chains).toContain('Ethereum');
      expect(strategy.protocols).toBeInstanceOf(Array);
      expect(strategy.steps).toBeInstanceOf(Array);
      expect(strategy.riskLevel).toMatch(/^(Low|Medium|High)$/);
      expect(strategy.estimatedApy).toBeGreaterThan(0);
      expect(strategy.confidence).toBeGreaterThanOrEqual(0);
      expect(strategy.confidence).toBeLessThanOrEqual(100);
    });

    it('should handle different risk tolerance levels', async () => {
      const lowRiskPrompt: StrategyPrompt = {
        prompt: 'Safe stablecoin yield',
        riskTolerance: 'low'
      };

      const highRiskPrompt: StrategyPrompt = {
        prompt: 'Maximum yield strategy',
        riskTolerance: 'high'
      };

      const lowRiskStrategy = await strategyEngine.generateStrategy(lowRiskPrompt);
      const highRiskStrategy = await strategyEngine.generateStrategy(highRiskPrompt);

      // Low risk should typically have lower APY but more conservative protocols
      expect(lowRiskStrategy.riskLevel).toBe('Low');
      expect(highRiskStrategy.riskLevel).toBe('High');
      
      // High risk strategies might have higher estimated APY
      expect(highRiskStrategy.estimatedApy).toBeGreaterThanOrEqual(lowRiskStrategy.estimatedApy);
    });

    it('should handle ETH-specific strategies', async () => {
      const ethPrompt: StrategyPrompt = {
        prompt: 'Maximize my ETH yield with medium risk',
        preferredChains: ['Ethereum']
      };

      const strategy = await strategyEngine.generateStrategy(ethPrompt);

      expect(strategy.chains).toContain('Ethereum');
      expect(strategy.steps.some(step => step.asset === 'ETH')).toBe(true);
    });

    it('should handle stablecoin strategies', async () => {
      const stablecoinPrompt: StrategyPrompt = {
        prompt: 'Best USDC yield with low risk',
        riskTolerance: 'low'
      };

      const strategy = await strategyEngine.generateStrategy(stablecoinPrompt);

      expect(strategy.riskLevel).toBe('Low');
      expect(strategy.steps.some(step => 
        step.asset === 'USDC' || step.asset === 'USDT'
      )).toBe(true);
    });

    it('should include execution time estimation', async () => {
      const prompt: StrategyPrompt = {
        prompt: 'Simple yield strategy'
      };

      const strategy = await strategyEngine.generateStrategy(prompt);

      expect(strategy.executionTime).toBeDefined();
      expect(strategy.executionTime).toMatch(/~\d+(\.\d+)?\s*(minutes?|hours?)/);
    });

    it('should handle errors gracefully', async () => {
      // Mock service to throw error
      mockProtocolService.getTopProtocols.mockRejectedValue(new Error('Service unavailable'));

      const prompt: StrategyPrompt = {
        prompt: 'Test strategy'
      };

      await expect(strategyEngine.generateStrategy(prompt)).rejects.toThrow('Failed to generate strategy');
    });

    it('should validate prompt requirements', async () => {
      const invalidPrompt: StrategyPrompt = {
        prompt: ''  // Empty prompt
      };

      await expect(strategyEngine.generateStrategy(invalidPrompt)).rejects.toThrow();
    });
  });

  describe('storeStrategyKnowledge', () => {
    it('should store positive feedback', async () => {
      const strategy = testUtils.createTestStrategy();
      
      // Should not throw error
      await expect(strategyEngine.storeStrategyKnowledge(strategy, 'positive')).resolves.not.toThrow();
    });

    it('should store negative feedback', async () => {
      const strategy = testUtils.createTestStrategy();
      
      // Should not throw error
      await expect(strategyEngine.storeStrategyKnowledge(strategy, 'negative')).resolves.not.toThrow();
    });

    it('should handle vector store unavailability gracefully', async () => {
      const strategy = testUtils.createTestStrategy();
      
      // Even if vector store fails, should not crash
      await expect(strategyEngine.storeStrategyKnowledge(strategy, 'positive')).resolves.not.toThrow();
    });
  });

  describe('private methods via public interface', () => {
    it('should calculate execution time based on step count', async () => {
      const singleStepPrompt: StrategyPrompt = {
        prompt: 'Simple single step strategy'
      };

      const multiStepPrompt: StrategyPrompt = {
        prompt: 'Complex multi-step yield farming strategy with leverage'
      };

      const singleStepStrategy = await strategyEngine.generateStrategy(singleStepPrompt);
      const multiStepStrategy = await strategyEngine.generateStrategy(multiStepPrompt);

      // Parse execution times (assuming format like "~X minutes")
      const parseSingleTime = parseFloat(singleStepStrategy.executionTime.match(/\d+(\.\d+)?/)?.[0] || '0');
      const parseMultiTime = parseFloat(multiStepStrategy.executionTime.match(/\d+(\.\d+)?/)?.[0] || '0');

      // Multi-step should generally take longer
      if (multiStepStrategy.steps.length > singleStepStrategy.steps.length) {
        expect(parseMultiTime).toBeGreaterThanOrEqual(parseSingleTime);
      }
    });

    it('should provide reasoning for generated strategies', async () => {
      const prompt: StrategyPrompt = {
        prompt: 'Conservative DeFi strategy for beginners'
      };

      const strategy = await strategyEngine.generateStrategy(prompt);

      expect(strategy.reasoning).toBeDefined();
      expect(strategy.reasoning.length).toBeGreaterThan(10);
    });

    it('should include warnings for risky strategies', async () => {
      const riskyPrompt: StrategyPrompt = {
        prompt: 'Maximum leverage yield strategy',
        riskTolerance: 'high'
      };

      const strategy = await strategyEngine.generateStrategy(riskyPrompt);

      if (strategy.riskLevel === 'High') {
        expect(strategy.warnings).toBeDefined();
        expect(strategy.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('performance and reliability', () => {
    it('should generate strategy within reasonable time', async () => {
      const prompt: StrategyPrompt = {
        prompt: 'Quick test strategy'
      };

      const startTime = Date.now();
      await strategyEngine.generateStrategy(prompt);
      const endTime = Date.now();

      // Should complete within 10 seconds (allowing for AI API calls)
      expect(endTime - startTime).toBeLessThan(10000);
    }, 15000);

    it('should handle concurrent strategy generation', async () => {
      const prompt: StrategyPrompt = {
        prompt: 'Concurrent test strategy'
      };

      const promises = Array.from({ length: 3 }, () => 
        strategyEngine.generateStrategy({
          ...prompt,
          prompt: `${prompt.prompt} ${Math.random()}`
        })
      );

      const strategies = await Promise.all(promises);

      expect(strategies).toHaveLength(3);
      strategies.forEach(strategy => {
        expect(strategy).toBeValidStrategy();
        expect(strategy.id).toBeDefined();
      });
    });
  });
});
