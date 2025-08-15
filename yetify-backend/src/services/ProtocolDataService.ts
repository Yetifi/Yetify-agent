import axios from 'axios';
import { logger } from '../utils/logger';

export interface Protocol {
  id: string;
  name: string;
  chain: string;
  category: 'lending' | 'dex' | 'yield_farming' | 'staking' | 'derivatives';
  tvl: number;
  apy: number;
  riskScore: number;
  url: string;
  description: string;
  tokens: string[];
  auditStatus: 'audited' | 'unaudited' | 'partially_audited';
  lastUpdated: string;
}

export interface RiskAssessment {
  protocolId: string;
  score: number; // 1-10 scale
  factors: {
    auditScore: number;
    tvlStability: number;
    teamReputability: number;
    codeMaturity: number;
    communityTrust: number;
  };
  warnings: string[];
  recommendation: 'low_risk' | 'medium_risk' | 'high_risk';
}

export class ProtocolDataService {
  private protocolCache: Map<string, Protocol[]> = new Map();
  private riskCache: Map<string, RiskAssessment> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Start periodic cache refresh
    setInterval(() => this.refreshCache(), this.cacheExpiry);
  }

  async getTopProtocols(limit: number = 50): Promise<Protocol[]> {
    const cacheKey = `top_protocols_${limit}`;

    if (this.protocolCache.has(cacheKey)) {
      const cached = this.protocolCache.get(cacheKey)!;
      logger.info('Returning cached protocol data');
      return cached;
    }

    try {
      const protocols = await this.fetchProtocolsFromSources();
      const topProtocols = protocols.sort((a, b) => b.tvl - a.tvl).slice(0, limit);

      this.protocolCache.set(cacheKey, topProtocols);
      logger.info(`Fetched ${topProtocols.length} top protocols`);

      return topProtocols;
    } catch (error) {
      logger.error('Failed to fetch top protocols:', error);
      return this.getFallbackProtocols();
    }
  }

  async getProtocolsByChain(chain: string): Promise<Protocol[]> {
    const allProtocols = await this.getTopProtocols();
    return allProtocols.filter(p => p.chain.toLowerCase() === chain.toLowerCase());
  }

  async getProtocolsByCategory(category: Protocol['category']): Promise<Protocol[]> {
    const allProtocols = await this.getTopProtocols();
    return allProtocols.filter(p => p.category === category);
  }

  async getRiskScores(): Promise<Map<string, RiskAssessment>> {
    if (this.riskCache.size === 0) {
      await this.calculateRiskScores();
    }
    return this.riskCache;
  }

  async getProtocolRisk(protocolId: string): Promise<RiskAssessment | null> {
    const riskScores = await this.getRiskScores();
    return riskScores.get(protocolId) || null;
  }

  private async fetchProtocolsFromSources(): Promise<Protocol[]> {
    const protocols: Protocol[] = [];

    // Fetch from multiple sources in parallel
    const [defiLlamaData, aaveData, nearData] = await Promise.allSettled([
      this.fetchFromDefiLlama(),
      this.fetchAaveProtocols(),
      this.fetchNearProtocols()
    ]);

    if (defiLlamaData.status === 'fulfilled') {
      protocols.push(...defiLlamaData.value);
    }

    if (aaveData.status === 'fulfilled') {
      protocols.push(...aaveData.value);
    }

    if (nearData.status === 'fulfilled') {
      protocols.push(...nearData.value);
    }

    return this.deduplicateProtocols(protocols);
  }

  private async fetchFromDefiLlama(): Promise<Protocol[]> {
    try {
      const response = await axios.get('https://api.llama.fi/protocols', {
        timeout: 10000
      });

      return response.data
        .filter((p: any) => p.tvl > 1000000) // Filter protocols with > $1M TVL
        .slice(0, 30)
        .map((p: any) => ({
          id: p.slug,
          name: p.name,
          chain: p.chain || 'Ethereum',
          category: this.categorizeProtocol(p.category),
          tvl: p.tvl,
          apy: this.estimateAPY(p.category, p.tvl),
          riskScore: this.calculateBasicRiskScore(p),
          url: p.url || '',
          description: p.description || '',
          tokens: p.symbol ? [p.symbol] : [],
          auditStatus: this.determineAuditStatus(p.audits),
          lastUpdated: new Date().toISOString()
        }));
    } catch (error) {
      logger.error('Failed to fetch from DeFiLlama:', error);
      return [];
    }
  }

  private async fetchAaveProtocols(): Promise<Protocol[]> {
    try {
      // Mock Aave data - in production, use Aave's subgraph
      return [
        {
          id: 'aave-v3-ethereum',
          name: 'Aave V3',
          chain: 'Ethereum',
          category: 'lending',
          tvl: 6500000000,
          apy: 4.2,
          riskScore: 2.1,
          url: 'https://aave.com',
          description: 'Decentralized lending protocol',
          tokens: ['USDC', 'USDT', 'ETH', 'DAI'],
          auditStatus: 'audited',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'aave-v3-arbitrum',
          name: 'Aave V3 Arbitrum',
          chain: 'Arbitrum',
          category: 'lending',
          tvl: 1200000000,
          apy: 4.8,
          riskScore: 2.3,
          url: 'https://aave.com',
          description: 'Aave V3 on Arbitrum',
          tokens: ['USDC', 'USDT', 'ETH', 'DAI'],
          auditStatus: 'audited',
          lastUpdated: new Date().toISOString()
        }
      ];
    } catch (error) {
      logger.error('Failed to fetch Aave protocols:', error);
      return [];
    }
  }

  private async fetchNearProtocols(): Promise<Protocol[]> {
    try {
      // Mock NEAR data - in production, use NEAR indexer
      return [
        {
          id: 'ref-finance',
          name: 'Ref Finance',
          chain: 'NEAR',
          category: 'dex',
          tvl: 85000000,
          apy: 12.5,
          riskScore: 3.2,
          url: 'https://ref.finance',
          description: 'Leading AMM on NEAR',
          tokens: ['NEAR', 'USDC', 'USDT', 'ETH'],
          auditStatus: 'audited',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'burrow-cash',
          name: 'Burrow',
          chain: 'NEAR',
          category: 'lending',
          tvl: 35000000,
          apy: 8.7,
          riskScore: 4.1,
          url: 'https://burrow.cash',
          description: 'Money market on NEAR',
          tokens: ['NEAR', 'USDC', 'USDT'],
          auditStatus: 'audited',
          lastUpdated: new Date().toISOString()
        }
      ];
    } catch (error) {
      logger.error('Failed to fetch NEAR protocols:', error);
      return [];
    }
  }

  private categorizeProtocol(category: string): Protocol['category'] {
    const lowerCategory = category?.toLowerCase() || '';

    if (lowerCategory.includes('lending') || lowerCategory.includes('borrow')) {
      return 'lending';
    }
    if (lowerCategory.includes('dex') || lowerCategory.includes('swap')) {
      return 'dex';
    }
    if (lowerCategory.includes('yield') || lowerCategory.includes('farm')) {
      return 'yield_farming';
    }
    if (lowerCategory.includes('staking')) {
      return 'staking';
    }
    if (lowerCategory.includes('derivative')) {
      return 'derivatives';
    }

    return 'dex'; // Default category
  }

  private estimateAPY(category: string, tvl: number): number {
    // Simple APY estimation based on category and TVL
    const baseCategoryAPY = {
      lending: 4.5,
      dex: 8.2,
      yield_farming: 15.3,
      staking: 6.8,
      derivatives: 12.1
    };

    const categoryAPY = baseCategoryAPY[this.categorizeProtocol(category)] || 8.0;

    // Adjust based on TVL (higher TVL generally means lower risk and APY)
    const tvlFactor = Math.max(0.5, Math.min(2.0, 1 - (Math.log10(tvl) - 6) * 0.1));

    return Math.round(categoryAPY * tvlFactor * 100) / 100;
  }

  private calculateBasicRiskScore(protocol: any): number {
    let riskScore = 5.0; // Base risk score

    // TVL factor (higher TVL = lower risk)
    if (protocol.tvl > 1000000000) riskScore -= 1.5;
    else if (protocol.tvl > 100000000) riskScore -= 1.0;
    else if (protocol.tvl > 10000000) riskScore -= 0.5;

    // Age factor (older protocols generally safer)
    const ageInDays = protocol.listedAt
      ? (Date.now() - new Date(protocol.listedAt).getTime()) / (1000 * 60 * 60 * 24)
      : 365;

    if (ageInDays > 365) riskScore -= 1.0;
    else if (ageInDays > 180) riskScore -= 0.5;

    // Chain factor
    if (protocol.chain === 'Ethereum') riskScore -= 0.5;
    else if (protocol.chain === 'NEAR') riskScore -= 0.3;

    return Math.max(1.0, Math.min(10.0, riskScore));
  }

  private determineAuditStatus(audits: any): Protocol['auditStatus'] {
    if (!audits || audits.length === 0) return 'unaudited';
    if (audits.length >= 2) return 'audited';
    return 'partially_audited';
  }

  private deduplicateProtocols(protocols: Protocol[]): Protocol[] {
    const seen = new Set<string>();
    return protocols.filter(protocol => {
      const key = `${protocol.name.toLowerCase()}-${protocol.chain.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async calculateRiskScores(): Promise<void> {
    const protocols = await this.getTopProtocols();

    for (const protocol of protocols) {
      const riskAssessment: RiskAssessment = {
        protocolId: protocol.id,
        score: protocol.riskScore,
        factors: {
          auditScore: protocol.auditStatus === 'audited' ? 9 : 5,
          tvlStability: Math.min(10, protocol.tvl / 100000000),
          teamReputability: 7, // Would be calculated based on team analysis
          codeMaturity: protocol.lastUpdated ? 8 : 6,
          communityTrust: 7 // Would be calculated based on community metrics
        },
        warnings: this.generateRiskWarnings(protocol),
        recommendation:
          protocol.riskScore <= 3
            ? 'low_risk'
            : protocol.riskScore <= 6
              ? 'medium_risk'
              : 'high_risk'
      };

      this.riskCache.set(protocol.id, riskAssessment);
    }

    logger.info(`Calculated risk scores for ${protocols.length} protocols`);
  }

  private generateRiskWarnings(protocol: Protocol): string[] {
    const warnings: string[] = [];

    if (protocol.auditStatus === 'unaudited') {
      warnings.push('Protocol has not been audited');
    }

    if (protocol.tvl < 10000000) {
      warnings.push('Low TVL may indicate higher risk');
    }

    if (protocol.riskScore > 7) {
      warnings.push('High risk protocol - use with caution');
    }

    return warnings;
  }

  private getFallbackProtocols(): Protocol[] {
    return [
      {
        id: 'aave-fallback',
        name: 'Aave',
        chain: 'Ethereum',
        category: 'lending',
        tvl: 6500000000,
        apy: 4.2,
        riskScore: 2.1,
        url: 'https://aave.com',
        description: 'Decentralized lending protocol',
        tokens: ['USDC', 'USDT', 'ETH'],
        auditStatus: 'audited',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'lido-fallback',
        name: 'Lido',
        chain: 'Ethereum',
        category: 'staking',
        tvl: 12000000000,
        apy: 4.8,
        riskScore: 2.3,
        url: 'https://lido.fi',
        description: 'Liquid staking for Ethereum',
        tokens: ['ETH', 'stETH'],
        auditStatus: 'audited',
        lastUpdated: new Date().toISOString()
      }
    ];
  }

  private async refreshCache(): Promise<void> {
    try {
      logger.info('Refreshing protocol data cache');
      this.protocolCache.clear();
      this.riskCache.clear();
      await this.getTopProtocols(); // This will populate the cache
      await this.calculateRiskScores();
      logger.info('Protocol data cache refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh protocol cache:', error);
    }
  }
}
