import cron from 'node-cron';
import { createLogger } from '../utils/logger';

const logger = createLogger();
import { MarketDataService } from '../services/MarketDataService';
import { ProtocolDataService } from '../services/ProtocolDataService';
import { Strategy, User } from '../utils/database';
import { GeneratedStrategy } from '../ai-engine/StrategyEngine';

export interface PerformanceMetrics {
  strategyId: string;
  totalInvested: number;
  currentValue: number;
  totalReturns: number;
  roi: number; // Return on Investment percentage
  realizedAPY: number;
  unrealizedGains: number;
  lastUpdated: string;
}

export interface RiskAlert {
  id: string;
  strategyId: string;
  type: 'price_drop' | 'apy_decline' | 'protocol_risk' | 'impermanent_loss' | 'liquidation_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendations: string[];
  timestamp: string;
  acknowledged: boolean;
}

export interface PositionUpdate {
  strategyId: string;
  protocol: string;
  asset: string;
  position: {
    amount: number;
    value: number;
    apy: number;
    health: number; // Health factor for borrowing positions
  };
  lastUpdated: string;
}

export interface RebalanceRecommendation {
  strategyId: string;
  reason: string;
  confidence: number;
  estimatedGain: number;
  actions: Array<{
    type: 'withdraw' | 'deposit' | 'swap' | 'rebalance';
    fromProtocol?: string;
    toProtocol?: string;
    asset: string;
    amount: number;
    expectedImpact: string;
  }>;
  timestamp: string;
}

export class MonitoringEngine {
  private marketService: MarketDataService;
  private protocolService: ProtocolDataService;
  private alertThresholds = {
    priceDrop: 10, // Alert if price drops more than 10%
    apyDecline: 20, // Alert if APY declines more than 20%
    healthFactor: 1.3, // Alert if health factor below 1.3
    roiThreshold: -5 // Alert if ROI drops below -5%
  };

  constructor() {
    this.marketService = MarketDataService.getInstance();
    this.protocolService = new ProtocolDataService();
    this.startMonitoring();
  }

  private startMonitoring() {
    // Monitor strategy performance every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.monitorAllStrategies().catch(error => {
        logger.error('Strategy monitoring failed:', error);
      });
    });

    // Check for rebalancing opportunities every hour
    cron.schedule('0 * * * *', () => {
      this.checkRebalancingOpportunities().catch(error => {
        logger.error('Rebalancing check failed:', error);
      });
    });

    // Update position data every 10 minutes
    cron.schedule('*/10 * * * *', () => {
      this.updatePositionData().catch(error => {
        logger.error('Position update failed:', error);
      });
    });

    logger.monitoring('Monitoring engine started with scheduled tasks');
  }

  async monitorAllStrategies(): Promise<void> {
    try {
      const activeStrategies = await Strategy.find({ status: 'active' }).populate('userId');

      logger.monitoring(`Monitoring ${activeStrategies.length} active strategies`);

      for (const strategy of activeStrategies) {
        try {
          await this.monitorStrategy(strategy);
        } catch (error) {
          logger.error(`Failed to monitor strategy ${strategy.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch active strategies:', error);
    }
  }

  async monitorStrategy(strategy: any): Promise<PerformanceMetrics> {
    try {
      const performance = await this.calculatePerformance(strategy);
      const alerts = await this.checkForAlerts(strategy, performance);

      // Update strategy performance in database
      await Strategy.findByIdAndUpdate(strategy._id, {
        'performance.totalInvested': performance.totalInvested,
        'performance.currentValue': performance.currentValue,
        'performance.totalReturns': performance.totalReturns,
        'performance.roi': performance.roi,
        'performance.lastUpdated': new Date()
      });

      // Send alerts if any
      if (alerts.length > 0) {
        await this.processAlerts(alerts);
      }

      logger.monitoring(`Strategy ${strategy.id} monitored`, {
        roi: performance.roi,
        currentValue: performance.currentValue,
        alertCount: alerts.length
      });

      return performance;
    } catch (error) {
      logger.error(`Strategy monitoring failed for ${strategy.id}:`, error);
      throw error;
    }
  }

  private async calculatePerformance(strategy: any): Promise<PerformanceMetrics> {
    try {
      // Get current market prices
      const tokenPrices = await this.marketService.getTokenPrices(['ETH', 'NEAR', 'USDC', 'USDT']);

      // Calculate current value based on positions
      const currentValue = await this.calculateCurrentValue(strategy, tokenPrices);

      // Get total invested amount
      const totalInvested = strategy.performance?.totalInvested || 0;

      // Calculate returns and ROI
      const totalReturns = currentValue - totalInvested;
      const roi = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

      // Calculate realized APY
      const timeElapsed = Date.now() - new Date(strategy.createdAt).getTime();
      const yearInMs = 365 * 24 * 60 * 60 * 1000;
      const annualizedReturn = (currentValue / totalInvested - 1) * (yearInMs / timeElapsed);
      const realizedAPY = annualizedReturn * 100;

      const performance: PerformanceMetrics = {
        strategyId: strategy.id,
        totalInvested,
        currentValue,
        totalReturns,
        roi,
        realizedAPY: isFinite(realizedAPY) ? realizedAPY : 0,
        unrealizedGains: totalReturns,
        lastUpdated: new Date().toISOString()
      };

      return performance;
    } catch (error) {
      logger.error('Performance calculation failed:', error);
      throw error;
    }
  }

  private async calculateCurrentValue(
    strategy: any,
    tokenPrices: Map<string, any>
  ): Promise<number> {
    let totalValue = 0;

    // This would calculate actual position values based on on-chain data
    // For now, simulate based on strategy steps and estimated returns
    for (const step of strategy.steps) {
      const tokenPrice = tokenPrices.get(step.asset);
      const amount = parseFloat(step.amount || '1000');

      if (tokenPrice) {
        const baseValue = amount * tokenPrice.price;

        // Apply estimated APY gains over time
        const timeElapsed = Date.now() - new Date(strategy.createdAt).getTime();
        const daysElapsed = timeElapsed / (1000 * 60 * 60 * 24);
        const apyGain = ((baseValue * (step.expectedApy || 0)) / 100) * (daysElapsed / 365);

        totalValue += baseValue + apyGain;
      }
    }

    return totalValue;
  }

  private async checkForAlerts(
    strategy: any,
    performance: PerformanceMetrics
  ): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];

    // ROI Alert
    if (performance.roi < this.alertThresholds.roiThreshold) {
      alerts.push({
        id: `roi_alert_${strategy.id}_${Date.now()}`,
        strategyId: strategy.id,
        type: 'price_drop',
        severity: performance.roi < -15 ? 'critical' : 'high',
        message: `Strategy ROI has dropped to ${performance.roi.toFixed(2)}%`,
        recommendations: [
          'Consider rebalancing to safer assets',
          'Review market conditions',
          'Set stop-loss if losses continue'
        ],
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // APY Decline Alert
    const currentAPY = await this.getCurrentStrategyAPY(strategy);
    if (currentAPY < strategy.estimatedApy * (1 - this.alertThresholds.apyDecline / 100)) {
      alerts.push({
        id: `apy_alert_${strategy.id}_${Date.now()}`,
        strategyId: strategy.id,
        type: 'apy_decline',
        severity: 'medium',
        message: `Strategy APY has declined from ${strategy.estimatedApy}% to ${currentAPY.toFixed(2)}%`,
        recommendations: [
          'Explore alternative protocols with better rates',
          'Consider reallocating funds',
          'Monitor market trends'
        ],
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // Protocol Risk Alert
    const riskAlerts = await this.checkProtocolRisks(strategy);
    alerts.push(...riskAlerts);

    return alerts;
  }

  private async getCurrentStrategyAPY(strategy: any): Promise<number> {
    let weightedAPY = 0;
    let totalWeight = 0;

    for (const step of strategy.steps) {
      const currentAPY = await this.marketService.getProtocolAPY(step.protocol, step.asset);
      if (currentAPY) {
        const weight = parseFloat(step.amount || '1000');
        weightedAPY += currentAPY * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? weightedAPY / totalWeight : 0;
  }

  private async checkProtocolRisks(strategy: any): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];
    const riskScores = await this.protocolService.getRiskScores();

    for (const step of strategy.steps) {
      const protocolRisk = riskScores.get(step.protocol);

      if (protocolRisk && protocolRisk.score > 7) {
        alerts.push({
          id: `risk_alert_${strategy.id}_${step.protocol}_${Date.now()}`,
          strategyId: strategy.id,
          type: 'protocol_risk',
          severity: protocolRisk.score > 8.5 ? 'critical' : 'high',
          message: `High risk detected for ${step.protocol} (Risk Score: ${protocolRisk.score}/10)`,
          recommendations: protocolRisk.warnings.concat([
            'Consider reducing exposure to this protocol',
            'Monitor protocol developments closely'
          ]),
          timestamp: new Date().toISOString(),
          acknowledged: false
        });
      }
    }

    return alerts;
  }

  private async processAlerts(alerts: RiskAlert[]): Promise<void> {
    for (const alert of alerts) {
      try {
        // Log the alert
        logger.monitoring(`Risk alert generated`, {
          type: alert.type,
          severity: alert.severity,
          strategyId: alert.strategyId
        });

        // In production, send notifications via email, SMS, or in-app notifications
        await this.sendNotification(alert);

        // Store alert in database for user access
        // await AlertModel.create(alert);
      } catch (error) {
        logger.error('Failed to process alert:', error);
      }
    }
  }

  private async sendNotification(alert: RiskAlert): Promise<void> {
    // Mock notification system - in production, integrate with email/SMS services
    logger.monitoring(`Notification sent for ${alert.type} alert`, {
      severity: alert.severity,
      strategyId: alert.strategyId
    });
  }

  async checkRebalancingOpportunities(): Promise<RebalanceRecommendation[]> {
    try {
      const activeStrategies = await Strategy.find({ status: 'active' });
      const recommendations: RebalanceRecommendation[] = [];

      for (const strategy of activeStrategies) {
        const recommendation = await this.analyzeRebalancingOpportunity(strategy);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }

      logger.monitoring(`Generated ${recommendations.length} rebalancing recommendations`);
      return recommendations;
    } catch (error) {
      logger.error('Rebalancing analysis failed:', error);
      return [];
    }
  }

  private async analyzeRebalancingOpportunity(
    strategy: any
  ): Promise<RebalanceRecommendation | null> {
    try {
      // Get current market conditions
      const marketSummary = await this.marketService.getCurrentAPYs();
      const currentAPY = await this.getCurrentStrategyAPY(strategy);

      // Find better opportunities
      const betterProtocols = marketSummary.topPerformingProtocols.filter(
        protocol => protocol.apy > currentAPY * 1.2 && protocol.risk === 'low'
      );

      if (betterProtocols.length === 0) {
        return null;
      }

      const bestProtocol = betterProtocols[0];
      const estimatedGain =
        ((bestProtocol.apy - currentAPY) * (strategy.performance?.totalInvested || 1000)) / 100;

      if (estimatedGain < 100) {
        // Don't recommend for small gains
        return null;
      }

      return {
        strategyId: strategy.id,
        reason: `Better APY opportunity: ${bestProtocol.protocol} offers ${bestProtocol.apy}% vs current ${currentAPY.toFixed(2)}%`,
        confidence: 75,
        estimatedGain,
        actions: [
          {
            type: 'rebalance',
            fromProtocol: strategy.steps[0]?.protocol || 'current',
            toProtocol: bestProtocol.protocol,
            asset: bestProtocol.asset,
            amount: strategy.performance?.totalInvested || 1000,
            expectedImpact: `+${(bestProtocol.apy - currentAPY).toFixed(2)}% APY`
          }
        ],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Rebalancing analysis failed for strategy:', error);
      return null;
    }
  }

  async updatePositionData(): Promise<void> {
    try {
      const activeStrategies = await Strategy.find({ status: 'active' });

      for (const strategy of activeStrategies) {
        const positions = await this.fetchPositionData(strategy);

        // Update positions in database or cache
        // await PositionModel.updateMany({ strategyId: strategy.id }, positions);

        logger.monitoring(`Position data updated for strategy ${strategy.id}`, {
          positionCount: positions.length
        });
      }
    } catch (error) {
      logger.error('Position data update failed:', error);
    }
  }

  private async fetchPositionData(strategy: any): Promise<PositionUpdate[]> {
    const positions: PositionUpdate[] = [];

    // Mock position fetching - in production, query actual on-chain data
    for (const step of strategy.steps) {
      const currentAPY = await this.marketService.getProtocolAPY(step.protocol, step.asset);

      positions.push({
        strategyId: strategy.id,
        protocol: step.protocol,
        asset: step.asset,
        position: {
          amount: parseFloat(step.amount || '1000'),
          value: parseFloat(step.amount || '1000') * 1.05, // Mock 5% gain
          apy: currentAPY || step.expectedApy || 0,
          health: Math.random() * 2 + 1.5 // Mock health factor
        },
        lastUpdated: new Date().toISOString()
      });
    }

    return positions;
  }

  // Public API methods for dashboard access
  async getStrategyPerformance(strategyId: string): Promise<PerformanceMetrics | null> {
    try {
      const strategy = await Strategy.findOne({ id: strategyId });
      if (!strategy) return null;

      return await this.calculatePerformance(strategy);
    } catch (error) {
      logger.error('Failed to get strategy performance:', error);
      return null;
    }
  }

  async getActiveAlerts(userId: string): Promise<RiskAlert[]> {
    try {
      const userStrategies = await Strategy.find({ userId, status: 'active' });
      const allAlerts: RiskAlert[] = [];

      for (const strategy of userStrategies) {
        const performance = await this.calculatePerformance(strategy);
        const alerts = await this.checkForAlerts(strategy, performance);
        allAlerts.push(...alerts);
      }

      return allAlerts.filter(alert => !alert.acknowledged);
    } catch (error) {
      logger.error('Failed to get active alerts:', error);
      return [];
    }
  }

  async getRebalanceRecommendations(userId: string): Promise<RebalanceRecommendation[]> {
    try {
      const userStrategies = await Strategy.find({ userId, status: 'active' });
      const recommendations: RebalanceRecommendation[] = [];

      for (const strategy of userStrategies) {
        const recommendation = await this.analyzeRebalancingOpportunity(strategy);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('Failed to get rebalance recommendations:', error);
      return [];
    }
  }
}
