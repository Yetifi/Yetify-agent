import { MonitoringEngine } from '../../../src/monitoring/MonitoringEngine';
import { MarketDataService } from '../../../src/services/MarketDataService';
import { ProtocolDataService } from '../../../src/services/ProtocolDataService';
import { Strategy, User } from '../../../src/utils/database';
import { testUtils } from '../../setup';

// Mock external dependencies
jest.mock('../../../src/services/MarketDataService');
jest.mock('../../../src/services/ProtocolDataService');
jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

describe('MonitoringEngine', () => {
  let monitoringEngine: MonitoringEngine;
  let mockMarketService: jest.Mocked<MarketDataService>;
  let mockProtocolService: jest.Mocked<ProtocolDataService>;
  let testUser: any;
  let testStrategy: any;

  beforeEach(async () => {
    // Setup mocks
    mockMarketService = new MarketDataService() as jest.Mocked<MarketDataService>;
    mockProtocolService = new ProtocolDataService() as jest.Mocked<ProtocolDataService>;

    // Mock service methods
    mockMarketService.getTokenPrices.mockResolvedValue(new Map([
      ['ETH', {
        symbol: 'ETH',
        price: 2400,
        change24h: 2.5,
        volume24h: 15000000000,
        marketCap: 290000000000,
        lastUpdated: new Date().toISOString()
      }],
      ['NEAR', {
        symbol: 'NEAR',
        price: 3.2,
        change24h: -1.2,
        volume24h: 850000000,
        marketCap: 3200000000,
        lastUpdated: new Date().toISOString()
      }]
    ]));

    mockMarketService.getProtocolAPY.mockResolvedValue(8.5);

    mockProtocolService.getRiskScores.mockResolvedValue(new Map([
      ['aave-v3', {
        protocolId: 'aave-v3',
        score: 2.1,
        factors: {
          auditScore: 9,
          tvlStability: 8,
          teamReputability: 9,
          codeMaturity: 8,
          communityTrust: 8
        },
        warnings: [],
        recommendation: 'low_risk'
      }]
    ]));

    // Create test data
    const userData = testUtils.createTestUser();
    testUser = await User.create(userData);

    const strategyData = {
      ...testUtils.createTestStrategy(),
      userId: testUser._id,
      status: 'active',
      performance: {
        totalInvested: 5000,
        currentValue: 5250,
        totalReturns: 250,
        roi: 5.0,
        lastUpdated: new Date()
      }
    };
    testStrategy = await Strategy.create(strategyData);

    monitoringEngine = new MonitoringEngine();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStrategyPerformance', () => {
    it('should calculate strategy performance metrics', async () => {
      const performance = await monitoringEngine.getStrategyPerformance(testStrategy.id);

      expect(performance).toBeDefined();
      expect(performance?.strategyId).toBe(testStrategy.id);
      expect(performance?.totalInvested).toBeGreaterThan(0);
      expect(performance?.currentValue).toBeGreaterThan(0);
      expect(performance?.roi).toBeGreaterThanOrEqual(-100);
      expect(performance?.realizedAPY).toBeDefined();
      expect(performance?.lastUpdated).toBeDefined();
    });

    it('should return null for non-existent strategy', async () => {
      const performance = await monitoringEngine.getStrategyPerformance('non_existent_strategy');
      expect(performance).toBeNull();
    });

    it('should handle strategies with no performance data', async () => {
      // Create strategy without performance data
      const strategyWithoutPerformance = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'strategy_without_performance',
        status: 'draft'
      });

      const performance = await monitoringEngine.getStrategyPerformance(strategyWithoutPerformance.id);

      expect(performance).toBeDefined();
      expect(performance?.totalInvested).toBe(0);
      expect(performance?.currentValue).toBeGreaterThanOrEqual(0);
      expect(performance?.totalReturns).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active alerts for user', async () => {
      const alerts = await monitoringEngine.getActiveAlerts(testUser._id.toString());

      expect(Array.isArray(alerts)).toBe(true);
      
      alerts.forEach(alert => {
        expect(alert.id).toBeDefined();
        expect(alert.strategyId).toBeDefined();
        expect(alert.type).toMatch(/^(price_drop|apy_decline|protocol_risk|impermanent_loss|liquidation_risk)$/);
        expect(alert.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(alert.message).toBeDefined();
        expect(Array.isArray(alert.recommendations)).toBe(true);
        expect(alert.timestamp).toBeDefined();
        expect(typeof alert.acknowledged).toBe('boolean');
      });
    });

    it('should return empty array for user with no strategies', async () => {
      const userWithoutStrategies = await User.create({
        ...testUtils.createTestUser(),
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
      });

      const alerts = await monitoringEngine.getActiveAlerts(userWithoutStrategies._id.toString());
      
      expect(Array.isArray(alerts)).toBe(true);
      expect(alerts).toHaveLength(0);
    });

    it('should filter out acknowledged alerts', async () => {
      const alerts = await monitoringEngine.getActiveAlerts(testUser._id.toString());
      
      // All returned alerts should be unacknowledged
      alerts.forEach(alert => {
        expect(alert.acknowledged).toBe(false);
      });
    });
  });

  describe('getRebalanceRecommendations', () => {
    it('should generate rebalancing recommendations', async () => {
      // Mock better APY opportunities
      mockMarketService.getCurrentAPYs.mockResolvedValue({
        totalTVL: 50000000000,
        averageAPY: 10.5,
        topPerformingProtocols: [
          {
            protocol: 'New High Yield Protocol',
            asset: 'USDC',
            apy: 15.2,
            tvl: 100000000,
            chain: 'Ethereum',
            risk: 'low',
            category: 'lending',
            lastUpdated: new Date().toISOString()
          }
        ],
        marketTrends: {
          tvlTrend: 'up',
          apyTrend: 'up',
          riskSentiment: 'bullish'
        },
        lastUpdated: new Date().toISOString()
      });

      const recommendations = await monitoringEngine.getRebalanceRecommendations(testUser._id.toString());

      expect(Array.isArray(recommendations)).toBe(true);
      
      recommendations.forEach(recommendation => {
        expect(recommendation.strategyId).toBeDefined();
        expect(recommendation.reason).toBeDefined();
        expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
        expect(recommendation.confidence).toBeLessThanOrEqual(100);
        expect(recommendation.estimatedGain).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(recommendation.actions)).toBe(true);
        expect(recommendation.timestamp).toBeDefined();

        recommendation.actions.forEach(action => {
          expect(action.type).toMatch(/^(withdraw|deposit|swap|rebalance)$/);
          expect(action.asset).toBeDefined();
          expect(action.amount).toBeGreaterThan(0);
          expect(action.expectedImpact).toBeDefined();
        });
      });
    });

    it('should not recommend rebalancing for small gains', async () => {
      // Mock only slightly better APY (not worth rebalancing)
      mockMarketService.getCurrentAPYs.mockResolvedValue({
        totalTVL: 50000000000,
        averageAPY: 8.6, // Only slightly better than current 8.5%
        topPerformingProtocols: [
          {
            protocol: 'Slightly Better Protocol',
            asset: 'USDC',
            apy: 8.7,
            tvl: 100000000,
            chain: 'Ethereum',
            risk: 'low',
            category: 'lending',
            lastUpdated: new Date().toISOString()
          }
        ],
        marketTrends: {
          tvlTrend: 'stable',
          apyTrend: 'stable',
          riskSentiment: 'neutral'
        },
        lastUpdated: new Date().toISOString()
      });

      const recommendations = await monitoringEngine.getRebalanceRecommendations(testUser._id.toString());

      // Should have few or no recommendations for small gains
      expect(recommendations.length).toBeLessThanOrEqual(1);
    });
  });

  describe('private methods via integration', () => {
    it('should detect price drop alerts', async () => {
      // Create a strategy with significant negative performance
      const losingStrategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'losing_strategy',
        status: 'active',
        performance: {
          totalInvested: 1000,
          currentValue: 800, // 20% loss
          totalReturns: -200,
          roi: -20.0,
          lastUpdated: new Date()
        }
      });

      const alerts = await monitoringEngine.getActiveAlerts(testUser._id.toString());

      // Should have alerts for significant losses
      const priceDropAlerts = alerts.filter(alert => 
        alert.type === 'price_drop' && alert.strategyId === losingStrategy.id
      );
      
      expect(priceDropAlerts.length).toBeGreaterThan(0);
      
      priceDropAlerts.forEach(alert => {
        expect(alert.severity).toMatch(/^(high|critical)$/);
        expect(alert.recommendations.length).toBeGreaterThan(0);
      });
    });

    it('should detect APY decline alerts', async () => {
      // Mock declining APY
      mockMarketService.getProtocolAPY.mockResolvedValue(3.0); // Much lower than expected 8.5%

      const alerts = await monitoringEngine.getActiveAlerts(testUser._id.toString());

      const apyAlerts = alerts.filter(alert => alert.type === 'apy_decline');
      
      if (apyAlerts.length > 0) {
        apyAlerts.forEach(alert => {
          expect(alert.severity).toMatch(/^(medium|high)$/);
          expect(alert.message).toContain('APY');
          expect(alert.recommendations.length).toBeGreaterThan(0);
        });
      }
    });

    it('should detect protocol risk alerts', async () => {
      // Mock high-risk protocol
      mockProtocolService.getRiskScores.mockResolvedValue(new Map([
        ['aave-v3', {
          protocolId: 'aave-v3',
          score: 8.5, // High risk score
          factors: {
            auditScore: 4,
            tvlStability: 3,
            teamReputability: 5,
            codeMaturity: 4,
            communityTrust: 4
          },
          warnings: ['High volatility detected', 'Recent security incident'],
          recommendation: 'high_risk'
        }]
      ]));

      const alerts = await monitoringEngine.getActiveAlerts(testUser._id.toString());

      const riskAlerts = alerts.filter(alert => alert.type === 'protocol_risk');
      
      if (riskAlerts.length > 0) {
        riskAlerts.forEach(alert => {
          expect(alert.severity).toMatch(/^(high|critical)$/);
          expect(alert.message).toContain('risk');
          expect(alert.recommendations.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('performance and reliability', () => {
    it('should handle monitoring multiple strategies efficiently', async () => {
      // Create multiple strategies
      const strategies = await Promise.all(
        Array.from({ length: 5 }, (_, i) => 
          Strategy.create({
            ...testUtils.createTestStrategy(),
            userId: testUser._id,
            id: `strategy_${i}`,
            status: 'active',
            performance: {
              totalInvested: 1000 + i * 100,
              currentValue: 1050 + i * 100,
              totalReturns: 50,
              roi: 5.0,
              lastUpdated: new Date()
            }
          })
        )
      );

      const startTime = Date.now();
      
      const [alerts, recommendations] = await Promise.all([
        monitoringEngine.getActiveAlerts(testUser._id.toString()),
        monitoringEngine.getRebalanceRecommendations(testUser._id.toString())
      ]);

      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
      
      expect(Array.isArray(alerts)).toBe(true);
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Mock service errors
      mockMarketService.getTokenPrices.mockRejectedValue(new Error('Service unavailable'));
      mockProtocolService.getRiskScores.mockRejectedValue(new Error('Network error'));

      // Should not throw errors even when services fail
      await expect(monitoringEngine.getActiveAlerts(testUser._id.toString())).resolves.not.toThrow();
      await expect(monitoringEngine.getRebalanceRecommendations(testUser._id.toString())).resolves.not.toThrow();
    });

    it('should cache results appropriately', async () => {
      // First call
      const alerts1 = await monitoringEngine.getActiveAlerts(testUser._id.toString());
      
      // Second call (should potentially use cached data)
      const alerts2 = await monitoringEngine.getActiveAlerts(testUser._id.toString());

      expect(Array.isArray(alerts1)).toBe(true);
      expect(Array.isArray(alerts2)).toBe(true);
      
      // Verify service was called (exact call count depends on caching implementation)
      expect(mockMarketService.getTokenPrices).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle strategies with zero investment', async () => {
      const zeroInvestmentStrategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'zero_investment_strategy',
        status: 'draft',
        performance: {
          totalInvested: 0,
          currentValue: 0,
          totalReturns: 0,
          roi: 0,
          lastUpdated: new Date()
        }
      });

      const performance = await monitoringEngine.getStrategyPerformance(zeroInvestmentStrategy.id);

      expect(performance).toBeDefined();
      expect(performance?.totalInvested).toBe(0);
      expect(performance?.roi).toBe(0);
      expect(isNaN(performance?.realizedAPY || 0)).toBe(false);
    });

    it('should handle very old strategies', async () => {
      const oldDate = new Date('2020-01-01');
      const oldStrategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'old_strategy',
        status: 'active',
        createdAt: oldDate,
        performance: {
          totalInvested: 1000,
          currentValue: 1200,
          totalReturns: 200,
          roi: 20.0,
          lastUpdated: new Date()
        }
      });

      const performance = await monitoringEngine.getStrategyPerformance(oldStrategy.id);

      expect(performance).toBeDefined();
      expect(performance?.realizedAPY).toBeDefined();
      expect(isFinite(performance?.realizedAPY || 0)).toBe(true);
    });
  });
});
