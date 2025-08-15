import axios from 'axios';
import { logger } from '../utils/logger';

export interface TokenPrice {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
}

export interface APYData {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  chain: string;
  risk: 'low' | 'medium' | 'high';
  category: string;
  lastUpdated: string;
}

export interface GasPrices {
  ethereum: number; // gwei
  near: number; // TGas
  arbitrum: number; // gwei
  polygon: number; // gwei
  optimism: number; // gwei
}

export interface TVLData {
  protocol: string;
  chain: string;
  tvl: number;
  change24h: number;
  change7d: number;
  dominance: number;
}

export interface MarketSummary {
  totalTVL: number;
  averageAPY: number;
  topPerformingProtocols: APYData[];
  marketTrends: {
    tvlTrend: 'up' | 'down' | 'stable';
    apyTrend: 'up' | 'down' | 'stable';
    riskSentiment: 'bullish' | 'bearish' | 'neutral';
  };
  lastUpdated: string;
}

export class MarketDataService {
  private priceCache: Map<string, TokenPrice> = new Map();
  private apyCache: Map<string, APYData[]> = new Map();
  private gasCache: GasPrices | null = null;
  private tvlCache: Map<string, TVLData[]> = new Map();
  private cacheExpiry: number = 2 * 60 * 1000; // 2 minutes

  constructor() {
    // Start periodic cache refresh
    setInterval(() => this.refreshAllCaches(), this.cacheExpiry);
  }

  async getTokenPrices(symbols: string[]): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    for (const symbol of symbols) {
      const cached = this.priceCache.get(symbol);
      if (cached) {
        prices.set(symbol, cached);
      } else {
        try {
          const price = await this.fetchTokenPrice(symbol);
          prices.set(symbol, price);
          this.priceCache.set(symbol, price);
        } catch (error) {
          logger.error(`Failed to fetch price for ${symbol}:`, error);
          // Use fallback price
          prices.set(symbol, this.getFallbackPrice(symbol));
        }
      }
    }

    logger.monitoring('Token prices fetched', { symbolCount: symbols.length });
    return prices;
  }

  async getCurrentAPYs(): Promise<MarketSummary> {
    const cacheKey = 'current_apys';
    
    if (this.apyCache.has(cacheKey)) {
      const cached = this.apyCache.get(cacheKey)!;
      return this.calculateMarketSummary(cached);
    }

    try {
      const apyData = await this.fetchCurrentAPYs();
      this.apyCache.set(cacheKey, apyData);
      
      logger.monitoring('APY data fetched', { protocolCount: apyData.length });
      return this.calculateMarketSummary(apyData);
    } catch (error) {
      logger.error('Failed to fetch APY data:', error);
      return this.getFallbackMarketSummary();
    }
  }

  async getTVLData(): Promise<TVLData[]> {
    const cacheKey = 'tvl_data';
    
    if (this.tvlCache.has(cacheKey)) {
      return this.tvlCache.get(cacheKey)!;
    }

    try {
      const tvlData = await this.fetchTVLData();
      this.tvlCache.set(cacheKey, tvlData);
      
      logger.monitoring('TVL data fetched', { protocolCount: tvlData.length });
      return tvlData;
    } catch (error) {
      logger.error('Failed to fetch TVL data:', error);
      return this.getFallbackTVLData();
    }
  }

  async getGasPrices(): Promise<GasPrices> {
    if (this.gasCache) {
      return this.gasCache;
    }

    try {
      const gasPrices = await this.fetchGasPrices();
      this.gasCache = gasPrices;
      
      logger.monitoring('Gas prices fetched', gasPrices);
      return gasPrices;
    } catch (error) {
      logger.error('Failed to fetch gas prices:', error);
      return this.getFallbackGasPrices();
    }
  }

  async getProtocolAPY(protocol: string, asset: string): Promise<number | null> {
    const apyData = await this.getCurrentAPYs();
    const protocolData = apyData.topPerformingProtocols.find(
      p => p.protocol.toLowerCase() === protocol.toLowerCase() && 
           p.asset.toLowerCase() === asset.toLowerCase()
    );
    
    return protocolData?.apy || null;
  }

  async getChainTVL(chain: string): Promise<number> {
    const tvlData = await this.getTVLData();
    return tvlData
      .filter(d => d.chain.toLowerCase() === chain.toLowerCase())
      .reduce((sum, d) => sum + d.tvl, 0);
  }

  private async fetchTokenPrice(symbol: string): Promise<TokenPrice> {
    try {
      // Try CoinGecko first
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
        params: {
          ids: this.getCoingeckoId(symbol),
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_24hr_vol: true,
          include_market_cap: true
        },
        timeout: 5000
      });

      const data = Object.values(response.data)[0] as any;
      
      return {
        symbol,
        price: data.usd,
        change24h: data.usd_24h_change || 0,
        volume24h: data.usd_24h_vol || 0,
        marketCap: data.usd_market_cap || 0,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      // Fallback to alternative source
      return await this.fetchTokenPriceFallback(symbol);
    }
  }

  private async fetchTokenPriceFallback(symbol: string): Promise<TokenPrice> {
    // Mock implementation - in production, use alternative APIs
    const mockPrices = {
      'ETH': { price: 2400, change24h: 2.5 },
      'NEAR': { price: 3.2, change24h: -1.2 },
      'USDC': { price: 1.0, change24h: 0.01 },
      'USDT': { price: 1.0, change24h: -0.01 }
    };

    const mockData = mockPrices[symbol as keyof typeof mockPrices] || 
                    { price: 100, change24h: 0 };

    return {
      symbol,
      price: mockData.price,
      change24h: mockData.change24h,
      volume24h: 50000000,
      marketCap: 1000000000,
      lastUpdated: new Date().toISOString()
    };
  }

  private async fetchCurrentAPYs(): Promise<APYData[]> {
    try {
      // Fetch from multiple sources
      const [defiPulseData, aaveData, nearData] = await Promise.allSettled([
        this.fetchDefiPulseAPYs(),
        this.fetchAaveAPYs(),
        this.fetchNearAPYs()
      ]);

      const allAPYData: APYData[] = [];

      if (defiPulseData.status === 'fulfilled') {
        allAPYData.push(...defiPulseData.value);
      }

      if (aaveData.status === 'fulfilled') {
        allAPYData.push(...aaveData.value);
      }

      if (nearData.status === 'fulfilled') {
        allAPYData.push(...nearData.value);
      }

      return allAPYData.length > 0 ? allAPYData : this.getFallbackAPYData();
    } catch (error) {
      logger.error('Failed to fetch APY data from all sources:', error);
      return this.getFallbackAPYData();
    }
  }

  private async fetchDefiPulseAPYs(): Promise<APYData[]> {
    // Mock implementation - in production, use DeFiPulse API
    return [
      {
        protocol: 'Aave',
        asset: 'USDC',
        apy: 4.2,
        tvl: 1200000000,
        chain: 'Ethereum',
        risk: 'low',
        category: 'lending',
        lastUpdated: new Date().toISOString()
      },
      {
        protocol: 'Compound',
        asset: 'USDC',
        apy: 3.8,
        tvl: 850000000,
        chain: 'Ethereum',
        risk: 'low',
        category: 'lending',
        lastUpdated: new Date().toISOString()
      }
    ];
  }

  private async fetchAaveAPYs(): Promise<APYData[]> {
    try {
      // Mock Aave subgraph data - in production, query actual subgraph
      return [
        {
          protocol: 'Aave V3',
          asset: 'ETH',
          apy: 1.8,
          tvl: 2500000000,
          chain: 'Ethereum',
          risk: 'low',
          category: 'lending',
          lastUpdated: new Date().toISOString()
        },
        {
          protocol: 'Aave V3',
          asset: 'USDT',
          apy: 4.5,
          tvl: 1800000000,
          chain: 'Ethereum',
          risk: 'low',
          category: 'lending',
          lastUpdated: new Date().toISOString()
        }
      ];
    } catch (error) {
      logger.error('Failed to fetch Aave APYs:', error);
      return [];
    }
  }

  private async fetchNearAPYs(): Promise<APYData[]> {
    try {
      // Mock NEAR protocol data
      return [
        {
          protocol: 'Ref Finance',
          asset: 'NEAR',
          apy: 12.5,
          tvl: 85000000,
          chain: 'NEAR',
          risk: 'medium',
          category: 'dex',
          lastUpdated: new Date().toISOString()
        },
        {
          protocol: 'Burrow',
          asset: 'USDC',
          apy: 8.7,
          tvl: 35000000,
          chain: 'NEAR',
          risk: 'medium',
          category: 'lending',
          lastUpdated: new Date().toISOString()
        }
      ];
    } catch (error) {
      logger.error('Failed to fetch NEAR APYs:', error);
      return [];
    }
  }

  private async fetchTVLData(): Promise<TVLData[]> {
    try {
      // Mock TVL data - in production, use DeFiLlama API
      return [
        {
          protocol: 'Aave',
          chain: 'Ethereum',
          tvl: 6500000000,
          change24h: 2.1,
          change7d: 5.8,
          dominance: 12.5
        },
        {
          protocol: 'Lido',
          chain: 'Ethereum',
          tvl: 12000000000,
          change24h: 1.8,
          change7d: 4.2,
          dominance: 23.1
        },
        {
          protocol: 'Ref Finance',
          chain: 'NEAR',
          tvl: 85000000,
          change24h: -0.5,
          change7d: 8.2,
          dominance: 45.2
        }
      ];
    } catch (error) {
      logger.error('Failed to fetch TVL data:', error);
      return [];
    }
  }

  private async fetchGasPrices(): Promise<GasPrices> {
    try {
      // Fetch Ethereum gas prices
      const ethGasResponse = await axios.get('https://api.etherscan.io/api', {
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: process.env.ETHERSCAN_API_KEY || 'demo'
        },
        timeout: 5000
      });

      const ethGas = ethGasResponse.data.result?.StandardGasPrice || 25;

      return {
        ethereum: parseInt(ethGas),
        near: 100, // TGas - NEAR has predictable gas
        arbitrum: Math.round(ethGas * 0.1), // Arbitrum is ~10x cheaper
        polygon: Math.round(ethGas * 0.05), // Polygon is ~20x cheaper
        optimism: Math.round(ethGas * 0.1) // Optimism is ~10x cheaper
      };
    } catch (error) {
      logger.error('Failed to fetch gas prices:', error);
      return this.getFallbackGasPrices();
    }
  }

  private calculateMarketSummary(apyData: APYData[]): MarketSummary {
    const totalTVL = apyData.reduce((sum, d) => sum + d.tvl, 0);
    const averageAPY = apyData.reduce((sum, d) => sum + d.apy, 0) / apyData.length;
    
    const topPerforming = apyData
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 10);

    return {
      totalTVL,
      averageAPY: Math.round(averageAPY * 100) / 100,
      topPerformingProtocols: topPerforming,
      marketTrends: {
        tvlTrend: totalTVL > 50000000000 ? 'up' : 'stable',
        apyTrend: averageAPY > 8 ? 'up' : 'stable',
        riskSentiment: 'neutral'
      },
      lastUpdated: new Date().toISOString()
    };
  }

  private getCoingeckoId(symbol: string): string {
    const symbolMap: { [key: string]: string } = {
      'ETH': 'ethereum',
      'NEAR': 'near',
      'USDC': 'usd-coin',
      'USDT': 'tether'
    };
    
    return symbolMap[symbol] || symbol.toLowerCase();
  }

  private getFallbackPrice(symbol: string): TokenPrice {
    const fallbackPrices: { [key: string]: Partial<TokenPrice> } = {
      'ETH': { price: 2400, change24h: 2.5 },
      'NEAR': { price: 3.2, change24h: -1.2 },
      'USDC': { price: 1.0, change24h: 0.01 },
      'USDT': { price: 1.0, change24h: -0.01 }
    };

    const fallback = fallbackPrices[symbol] || { price: 100, change24h: 0 };
    
    return {
      symbol,
      price: fallback.price!,
      change24h: fallback.change24h!,
      volume24h: 50000000,
      marketCap: 1000000000,
      lastUpdated: new Date().toISOString()
    };
  }

  private getFallbackAPYData(): APYData[] {
    return [
      {
        protocol: 'Aave',
        asset: 'USDC',
        apy: 4.2,
        tvl: 1200000000,
        chain: 'Ethereum',
        risk: 'low',
        category: 'lending',
        lastUpdated: new Date().toISOString()
      },
      {
        protocol: 'Lido',
        asset: 'ETH',
        apy: 4.8,
        tvl: 12000000000,
        chain: 'Ethereum',
        risk: 'low',
        category: 'staking',
        lastUpdated: new Date().toISOString()
      }
    ];
  }

  private getFallbackMarketSummary(): MarketSummary {
    const fallbackData = this.getFallbackAPYData();
    return this.calculateMarketSummary(fallbackData);
  }

  private getFallbackTVLData(): TVLData[] {
    return [
      {
        protocol: 'Aave',
        chain: 'Ethereum',
        tvl: 6500000000,
        change24h: 2.1,
        change7d: 5.8,
        dominance: 12.5
      }
    ];
  }

  private getFallbackGasPrices(): GasPrices {
    return {
      ethereum: 25,
      near: 100,
      arbitrum: 3,
      polygon: 1,
      optimism: 3
    };
  }

  private async refreshAllCaches(): Promise<void> {
    try {
      logger.monitoring('Refreshing market data caches');
      
      // Clear caches
      this.priceCache.clear();
      this.apyCache.clear();
      this.gasCache = null;
      this.tvlCache.clear();

      // Refresh with new data
      await Promise.allSettled([
        this.getCurrentAPYs(),
        this.getTVLData(),
        this.getGasPrices(),
        this.getTokenPrices(['ETH', 'NEAR', 'USDC', 'USDT'])
      ]);

      logger.monitoring('Market data caches refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh market data caches:', error);
    }
  }
}
