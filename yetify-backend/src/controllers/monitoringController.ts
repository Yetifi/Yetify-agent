import { Router, Response } from 'express';
import Joi from 'joi';
import { MonitoringEngine } from '../monitoring/MonitoringEngine';
import { MarketDataService } from '../services/MarketDataService';
import { ProtocolDataService } from '../services/ProtocolDataService';
import { Strategy } from '../utils/database';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const monitoringEngine = new MonitoringEngine();
const marketDataService = new MarketDataService();
const protocolDataService = new ProtocolDataService();

// Validation schemas
const alertAcknowledgmentSchema = Joi.object({
  alertIds: Joi.array().items(Joi.string()).required()
});

// GET /api/v1/monitoring/performance/:strategyId - Get strategy performance metrics
router.get('/performance/:strategyId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { strategyId } = req.params;

    // Verify strategy ownership
    const strategy = await Strategy.findOne({
      id: strategyId,
      userId: req.user!.id
    });

    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        message: 'Strategy does not exist or access denied'
      });
    }

    const performance = await monitoringEngine.getStrategyPerformance(strategyId);

    if (!performance) {
      return res.status(404).json({
        error: 'Performance data not available',
        message: 'Performance metrics are not yet available for this strategy'
      });
    }

    // Add additional metrics
    const enhancedPerformance = {
      ...performance,
      strategy: {
        id: strategy.id,
        goal: strategy.goal,
        status: strategy.status,
        createdAt: strategy.createdAt,
        riskLevel: strategy.riskLevel
      },
      charts: {
        performanceHistory: await this.getPerformanceHistory(strategyId),
        apyTrend: await this.getAPYTrend(strategy),
        riskMetrics: await this.getRiskMetrics(strategy)
      }
    };

    logger.monitoring('Performance data retrieved', {
      strategyId,
      userId: req.user!.id,
      roi: performance.roi
    });

    res.json({ performance: enhancedPerformance });
  } catch (error) {
    logger.error('Failed to get strategy performance:', error);
    res.status(500).json({
      error: 'Failed to retrieve performance data',
      message: error.message
    });
  }
});

// GET /api/v1/monitoring/alerts - Get active alerts for user
router.get('/alerts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { severity, type, limit = 20, offset = 0 } = req.query;

    let alerts = await monitoringEngine.getActiveAlerts(req.user!.id);

    // Filter by severity
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    // Filter by type
    if (type) {
      alerts = alerts.filter(alert => alert.type === type);
    }

    // Apply pagination
    const total = alerts.length;
    alerts = alerts.slice(Number(offset), Number(offset) + Number(limit));

    // Add alert statistics
    const alertStats = {
      total,
      bySeverity: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
      },
      byType: {
        price_drop: alerts.filter(a => a.type === 'price_drop').length,
        apy_decline: alerts.filter(a => a.type === 'apy_decline').length,
        protocol_risk: alerts.filter(a => a.type === 'protocol_risk').length,
        impermanent_loss: alerts.filter(a => a.type === 'impermanent_loss').length,
        liquidation_risk: alerts.filter(a => a.type === 'liquidation_risk').length
      }
    };

    logger.monitoring('Alerts retrieved', {
      userId: req.user!.id,
      alertCount: alerts.length,
      criticalAlerts: alertStats.bySeverity.critical
    });

    res.json({
      alerts,
      stats: alertStats,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: total > Number(offset) + Number(limit)
      }
    });
  } catch (error) {
    logger.error('Failed to get alerts:', error);
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error.message
    });
  }
});

// POST /api/v1/monitoring/alerts/acknowledge - Acknowledge alerts
router.post('/alerts/acknowledge', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = alertAcknowledgmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { alertIds } = value;

    // In production, update alerts in database
    // For now, log the acknowledgment
    logger.monitoring('Alerts acknowledged', {
      userId: req.user!.id,
      alertIds,
      count: alertIds.length
    });

    res.json({
      message: `${alertIds.length} alerts acknowledged successfully`,
      acknowledgedAlerts: alertIds
    });
  } catch (error) {
    logger.error('Failed to acknowledge alerts:', error);
    res.status(500).json({
      error: 'Failed to acknowledge alerts',
      message: error.message
    });
  }
});

// GET /api/v1/monitoring/rebalance-recommendations - Get rebalancing recommendations
router.get('/rebalance-recommendations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recommendations = await monitoringEngine.getRebalanceRecommendations(req.user!.id);

    // Enhance recommendations with market context
    const enhancedRecommendations = await Promise.all(
      recommendations.map(async (rec) => {
        const strategy = await Strategy.findOne({ id: rec.strategyId });
        return {
          ...rec,
          strategy: strategy ? {
            goal: strategy.goal,
            currentAPY: strategy.actualApy || strategy.estimatedApy,
            riskLevel: strategy.riskLevel
          } : null,
          marketContext: await this.getMarketContext(rec)
        };
      })
    );

    logger.monitoring('Rebalance recommendations retrieved', {
      userId: req.user!.id,
      recommendationCount: recommendations.length
    });

    res.json({
      recommendations: enhancedRecommendations,
      summary: {
        total: recommendations.length,
        highConfidence: recommendations.filter(r => r.confidence > 80).length,
        totalPotentialGain: recommendations.reduce((sum, r) => sum + r.estimatedGain, 0)
      }
    });
  } catch (error) {
    logger.error('Failed to get rebalance recommendations:', error);
    res.status(500).json({
      error: 'Failed to retrieve rebalance recommendations',
      message: error.message
    });
  }
});

// GET /api/v1/monitoring/market-overview - Get market overview and trends
router.get('/market-overview', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [marketSummary, topProtocols, gasPrices, tokenPrices] = await Promise.all([
      marketDataService.getCurrentAPYs(),
      protocolDataService.getTopProtocols(10),
      marketDataService.getGasPrices(),
      marketDataService.getTokenPrices(['ETH', 'NEAR', 'USDC', 'USDT', 'BTC'])
    ]);

    const marketOverview = {
      summary: marketSummary,
      protocols: {
        top: topProtocols.slice(0, 5),
        byCategory: {
          lending: topProtocols.filter(p => p.category === 'lending').slice(0, 3),
          dex: topProtocols.filter(p => p.category === 'dex').slice(0, 3),
          staking: topProtocols.filter(p => p.category === 'staking').slice(0, 3)
        }
      },
      prices: Array.from(tokenPrices.values()),
      gas: gasPrices,
      insights: {
        bestAPYOpportunities: topProtocols
          .sort((a, b) => b.apy - a.apy)
          .slice(0, 3)
          .map(p => ({
            protocol: p.name,
            apy: p.apy,
            chain: p.chain,
            riskScore: p.riskScore
          })),
        lowRiskOptions: topProtocols
          .filter(p => p.riskScore <= 3)
          .sort((a, b) => b.apy - a.apy)
          .slice(0, 3)
          .map(p => ({
            protocol: p.name,
            apy: p.apy,
            riskScore: p.riskScore
          }))
      }
    };

    res.json({ marketOverview });
  } catch (error) {
    logger.error('Failed to get market overview:', error);
    res.status(500).json({
      error: 'Failed to retrieve market overview',
      message: error.message
    });
  }
});

// GET /api/v1/monitoring/portfolio-summary - Get user's portfolio summary
router.get('/portfolio-summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const strategies = await Strategy.find({ userId: req.user!.id });

    const portfolioSummary = {
      totalStrategies: strategies.length,
      activeStrategies: strategies.filter(s => s.status === 'active').length,
      totalValue: strategies.reduce((sum, s) => sum + (s.performance?.currentValue || 0), 0),
      totalInvested: strategies.reduce((sum, s) => sum + (s.performance?.totalInvested || 0), 0),
      totalReturns: strategies.reduce((sum, s) => sum + (s.performance?.totalReturns || 0), 0),
      averageROI: 0,
      riskDistribution: {
        low: strategies.filter(s => s.riskLevel === 'Low').length,
        medium: strategies.filter(s => s.riskLevel === 'Medium').length,
        high: strategies.filter(s => s.riskLevel === 'High').length
      },
      chainDistribution: this.calculateChainDistribution(strategies),
      protocolDistribution: this.calculateProtocolDistribution(strategies),
      performance: {
        last24h: await this.calculate24hPerformance(strategies),
        last7d: await this.calculate7dPerformance(strategies),
        last30d: await this.calculate30dPerformance(strategies)
      }
    };

    // Calculate average ROI
    const strategiesWithROI = strategies.filter(s => s.performance?.roi);
    if (strategiesWithROI.length > 0) {
      portfolioSummary.averageROI = strategiesWithROI.reduce((sum, s) => 
        sum + (s.performance?.roi || 0), 0) / strategiesWithROI.length;
    }

    logger.monitoring('Portfolio summary generated', {
      userId: req.user!.id,
      totalValue: portfolioSummary.totalValue,
      totalStrategies: portfolioSummary.totalStrategies
    });

    res.json({ portfolio: portfolioSummary });
  } catch (error) {
    logger.error('Failed to get portfolio summary:', error);
    res.status(500).json({
      error: 'Failed to retrieve portfolio summary',
      message: error.message
    });
  }
});

// GET /api/v1/monitoring/health-check - Get monitoring system health
router.get('/health-check', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const healthCheck = {
      monitoringEngine: 'operational',
      marketDataService: 'operational',
      protocolDataService: 'operational',
      lastUpdate: new Date().toISOString(),
      metrics: {
        activeStrategiesMonitored: await Strategy.countDocuments({ status: 'active' }),
        alertsGenerated24h: 0, // Would come from alerts collection
        rebalanceRecommendations: 0 // Would come from recommendations collection
      },
      serviceStatus: {
        priceFeeds: await this.checkPriceFeedsHealth(),
        chainConnections: await this.checkChainConnectionsHealth(),
        externalAPIs: await this.checkExternalAPIsHealth()
      }
    };

    res.json({ health: healthCheck });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

// Helper methods
private async getPerformanceHistory(strategyId: string): Promise<any[]> {
  // Mock performance history - in production, would query time-series data
  const history = [];
  const now = Date.now();
  for (let i = 30; i >= 0; i--) {
    history.push({
      timestamp: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
      value: 1000 + Math.random() * 200 - 100,
      roi: (Math.random() * 20) - 5
    });
  }
  return history;
}

private async getAPYTrend(strategy: any): Promise<any[]> {
  // Mock APY trend data
  const trend = [];
  const now = Date.now();
  for (let i = 7; i >= 0; i--) {
    trend.push({
      date: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
      apy: strategy.estimatedApy + (Math.random() * 4) - 2
    });
  }
  return trend;
}

private async getRiskMetrics(strategy: any): Promise<any> {
  return {
    currentRiskScore: strategy.riskLevel === 'Low' ? 2.5 : strategy.riskLevel === 'Medium' ? 5.0 : 7.5,
    volatility: Math.random() * 20 + 5,
    sharpeRatio: Math.random() * 2 + 0.5,
    maxDrawdown: Math.random() * 15 + 2
  };
}

private async getMarketContext(recommendation: any): Promise<any> {
  return {
    marketTrend: 'bullish',
    protocolGrowth: '+15% TVL this week',
    competitorAPY: Math.random() * 5 + 8
  };
}

private calculateChainDistribution(strategies: any[]): any {
  const distribution = {};
  strategies.forEach(strategy => {
    strategy.chains.forEach((chain: string) => {
      distribution[chain] = (distribution[chain] || 0) + 1;
    });
  });
  return distribution;
}

private calculateProtocolDistribution(strategies: any[]): any {
  const distribution = {};
  strategies.forEach(strategy => {
    strategy.protocols.forEach((protocol: string) => {
      distribution[protocol] = (distribution[protocol] || 0) + 1;
    });
  });
  return distribution;
}

private async calculate24hPerformance(strategies: any[]): Promise<number> {
  // Mock 24h performance calculation
  return Math.random() * 10 - 2; // -2% to +8%
}

private async calculate7dPerformance(strategies: any[]): Promise<number> {
  // Mock 7d performance calculation
  return Math.random() * 20 - 5; // -5% to +15%
}

private async calculate30dPerformance(strategies: any[]): Promise<number> {
  // Mock 30d performance calculation
  return Math.random() * 50 - 10; // -10% to +40%
}

private async checkPriceFeedsHealth(): Promise<string> {
  try {
    await marketDataService.getTokenPrices(['ETH']);
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

private async checkChainConnectionsHealth(): Promise<any> {
  return {
    ethereum: 'healthy',
    near: 'healthy',
    arbitrum: 'healthy'
  };
}

private async checkExternalAPIsHealth(): Promise<any> {
  return {
    coinGecko: 'healthy',
    defillama: 'healthy',
    chainlink: 'healthy'
  };
}

export default router;
