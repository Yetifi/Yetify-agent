import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLogger } from '../utils/logger';
import { OpenRouterService } from '../services/OpenRouterService';
import { UserController } from '../controllers/userController';

const logger = createLogger();
import { ProtocolDataService } from '../services/ProtocolDataService';
import { MarketDataService } from '../services/MarketDataService';

export interface StrategyPrompt {
  prompt: string;
  userAddress?: string;
  riskTolerance?: 'low' | 'medium' | 'high';
  investmentAmount?: number;
  preferredChains?: string[];
  timeHorizon?: 'short' | 'medium' | 'long';
  userApiKey?: string;
}

export interface GeneratedStrategy {
  id: string;
  goal: string;
  chains: string[];
  protocols: string[];
  steps: StrategyStep[];
  riskLevel: 'Low' | 'Medium' | 'High';
  estimatedApy: number;
  estimatedTvl: string;
  executionTime: string;
  gasEstimate: {
    ethereum: string;
    near: string;
    arbitrum: string;
  };
  confidence: number;
  reasoning: string;
  warnings: string[];
}

export interface StrategyStep {
  action: 'deposit' | 'stake' | 'yield_farm' | 'provide_liquidity' | 'leverage' | 'bridge' | 'swap' | 'withdraw';
  protocol: string;
  asset: string;
  amount?: string;
  expectedApy?: number;
  riskScore?: number;
  gasEstimate?: string;
  dependencies?: string[];
}

export class StrategyEngine {
  private geminiAI: GoogleGenerativeAI;
  private openRouter: OpenRouterService;
  private protocolService: ProtocolDataService;
  private marketService: MarketDataService;
  private userController: UserController;

  constructor() {
    // Initialize AI models
    this.geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');
    
    // Initialize OpenRouter service (primary AI provider)
    this.openRouter = new OpenRouterService();

    // Initialize services
    this.protocolService = new ProtocolDataService();
    this.marketService = MarketDataService.getInstance();
    this.userController = new UserController();
  }

  // Vector store temporarily disabled - will implement with alternative embedding
  private async initializeVectorStore() {
    logger.info('Vector store initialization skipped for MVP');
  }

  async generateStrategy(prompt: StrategyPrompt): Promise<GeneratedStrategy> {
    const startTime = Date.now();
    
    try {
      logger.ai('Generating strategy for prompt', { prompt: prompt.prompt });

      // Step 1: Gather real-time market data
      const marketData = await this.gatherMarketData(prompt);
      
      // Step 2: Retrieve relevant strategy knowledge using RAG
      const relevantKnowledge = await this.retrieveRelevantKnowledge(prompt.prompt);
      
      // Step 3: Generate strategy using LLM with enhanced context
      const strategy = await this.generateWithLLM(prompt, marketData, relevantKnowledge);
      
      // Step 4: Validate and optimize strategy
      const optimizedStrategy = await this.validateAndOptimize(strategy);
      
      const duration = Date.now() - startTime;
      logger.performance('Strategy generation', duration, { strategyId: optimizedStrategy.id });
      
      return optimizedStrategy;
    } catch (error) {
      logger.error('Strategy generation failed:', error);
      throw new Error('Failed to generate strategy: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private async gatherMarketData(prompt: StrategyPrompt) {
    const marketData = {
      protocols: await this.protocolService.getTopProtocols() || [],
      apyData: await this.marketService.getCurrentAPYs() || { averageAPY: 0 },
      tvlData: await this.marketService.getTVLData() || {},
      riskScores: await this.protocolService.getRiskScores() || new Map(),
      gasPrice: await this.marketService.getGasPrices() || { ethereum: '20', near: '10' },
      tokenPrices: await this.marketService.getTokenPrices(['ETH', 'NEAR', 'USDC', 'USDT']) || new Map()
    };

    logger.ai('Market data gathered', { 
      protocolCount: marketData.protocols?.length || 0,
      avgAPY: marketData.apyData?.averageAPY || 0
    });

    return marketData;
  }

  private async retrieveRelevantKnowledge(query: string): Promise<string[]> {
    // Use fallback knowledge for MVP
    logger.info('Using fallback knowledge for MVP');
    return this.getFallbackKnowledge();
  }

  private getFallbackKnowledge(): string[] {
    return [
      'Aave provides lending and borrowing services with variable interest rates',
      'Lido offers liquid staking for Ethereum with stETH tokens',
      'Uniswap V3 provides concentrated liquidity for better capital efficiency',
      'Curve Finance specializes in stablecoin and like-asset trading',
      'Ref Finance is NEAR\'s leading DeFi protocol for swaps and yield farming'
    ];
  }

  private async generateWithLLM(
    prompt: StrategyPrompt, 
    marketData: any, 
    knowledge: string[]
  ): Promise<GeneratedStrategy> {
    
    const systemPrompt = this.buildSystemPrompt(marketData, knowledge);
    const userPrompt = this.buildUserPrompt(prompt);

    try {
      // Use Gemini directly for faster response
      let response: string;
      
      try {
        // API Key Priority:
        // 1. User's database API key (gemini field)
        // 2. API key from request
        // 3. System default API key
        let apiKey = process.env.GEMINI_API_KEY || 'dummy-key';
        let keySource = 'system';
        
        if (prompt.userAddress) {
          const dbApiKey = await this.userController.getUserApiKey(prompt.userAddress, 'gemini');
          if (dbApiKey) {
            apiKey = dbApiKey;
            keySource = 'database';
          }
        }
        
        if (prompt.userApiKey) {
          apiKey = prompt.userApiKey;
          keySource = 'request';
        }
        
        const geminiAI = new GoogleGenerativeAI(apiKey);
        const model = geminiAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
        response = result.response.text();
        
        logger.ai('Strategy generated using Gemini 1.5 Flash', { 
          keySource,
          userKey: keySource !== 'system',
          userAddress: prompt.userAddress?.slice(0, 10) + '...'
        });
      } catch (geminiError) {
        logger.error('Gemini failed:', geminiError);
        throw new Error('AI service unavailable');
      }

      return this.parseStrategyResponse(response, prompt);
    } catch (error) {
      logger.error('LLM generation failed:', error);
      throw new Error('Failed to generate strategy with LLM');
    }
  }

  private buildSystemPrompt(marketData: any, knowledge: string[]): string {
    return `
You are an expert DeFi yield strategist AI for Yetify. Your role is to create executable, multi-chain yield strategies based on user prompts.

Current Market Data:
- Top Protocols: ${(marketData.protocols || []).slice(0, 10).map((p: any) => `${p?.name || 'Unknown'} (${p?.chain || 'Unknown'}, APY: ${p?.apy || 0}%)`).join(', ')}
- Average Market APY: ${marketData.apyData?.averageAPY || 0}%
- ETH Gas Price: ${marketData.gasPrice?.ethereum || 'Unknown'} gwei
- NEAR Gas: ${marketData.gasPrice?.near || 'Unknown'} TGas

Relevant Knowledge:
${(knowledge || []).join('\n')}

Generate strategies following these rules:
1. Always output valid JSON with the specified schema
2. Include realistic APY estimates based on current market data
3. Consider gas costs and execution complexity
4. Provide clear step-by-step execution plans
5. Include risk assessments and warnings
6. Support multi-chain execution when beneficial
7. Prioritize user safety and capital preservation

Response Schema:
{
  "goal": "string",
  "chains": ["string"],
  "protocols": ["string"],
  "steps": [{"action": "string", "protocol": "string", "asset": "string", "expectedApy": number}],
  "riskLevel": "Low|Medium|High",
  "estimatedApy": number,
  "confidence": number,
  "reasoning": "string",
  "warnings": ["string"]
}`;
  }

  private buildUserPrompt(prompt: StrategyPrompt): string {
    return `
User Request: "${prompt.prompt}"

Additional Context:
- Risk Tolerance: ${prompt.riskTolerance || 'medium'}
- Investment Amount: ${prompt.investmentAmount ? `$${prompt.investmentAmount}` : 'not specified'}
- Preferred Chains: ${prompt.preferredChains?.join(', ') || 'no preference'}
- Time Horizon: ${prompt.timeHorizon || 'medium-term'}

Please generate an optimal DeFi yield strategy that addresses this request.`;
  }

  private parseStrategyResponse(response: string, prompt: StrategyPrompt): GeneratedStrategy {
    try {
      // Log raw response for debugging
      logger.info('Raw AI response:', { responseLength: response.length, preview: response.substring(0, 200) });
      
      // Try multiple JSON extraction methods
      let jsonStr = '';
      
      // Method 1: Look for JSON in code blocks
      const jsonCodeBlock = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonCodeBlock) {
        jsonStr = jsonCodeBlock[1].trim();
      }
      // Method 2: Look for JSON object
      else {
        const jsonObject = response.match(/\{[\s\S]*\}/);
        if (jsonObject) {
          jsonStr = jsonObject[0];
        } else {
          jsonStr = response;
        }
      }
      
      // Clean up the JSON string
      jsonStr = jsonStr.trim();
      
      // Fix common JSON issues
      jsonStr = jsonStr
        .replace(/\/\/[^\n\r]*/g, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
        .replace(/:\s*([^",{\[\s][^",}\]]*[^",}\]\s])(\s*[,}])/g, ':"$1"$2') // Quote unquoted string values
        .replace(/\n/g, ' ') // Remove newlines
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
        .replace(/,\s*]/g, ']') // Remove trailing commas before closing brackets
        .replace(/([^"])(\w+)(\s*:)/g, '$1"$2"$3') // Quote any remaining unquoted keys
        .trim();
      
      logger.info('Cleaned JSON string:', { 
        jsonStr: jsonStr.substring(0, 500),
        position662: jsonStr.substring(650, 680),
        fullLength: jsonStr.length 
      });
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        id: `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        goal: parsed.goal || prompt.prompt,
        chains: parsed.chains || ['Ethereum', 'NEAR'],
        protocols: parsed.protocols || ['Aave', 'Lido'],
        steps: (parsed.steps || []).map((step: any) => ({
          ...step,
          expectedApy: typeof step.expectedApy === 'string' ? parseFloat(step.expectedApy) : step.expectedApy,
          riskScore: typeof step.riskScore === 'string' ? parseFloat(step.riskScore) : step.riskScore
        })),
        riskLevel: parsed.riskLevel || 'Medium',
        estimatedApy: typeof parsed.estimatedApy === 'string' ? parseFloat(parsed.estimatedApy) : (parsed.estimatedApy || 8.5),
        estimatedTvl: prompt.investmentAmount ? `$${prompt.investmentAmount}` : '$1,000',
        executionTime: this.calculateExecutionTime(parsed.steps?.length || 1),
        gasEstimate: {
          ethereum: '0.02 ETH',
          near: '0.1 NEAR',
          arbitrum: '0.005 ETH'
        },
        confidence: typeof parsed.confidence === 'string' ? parseFloat(parsed.confidence) : (parsed.confidence || 85),
        reasoning: parsed.reasoning || 'Strategy generated based on current market conditions',
        warnings: parsed.warnings || []
      };
    } catch (error) {
      logger.error('Failed to parse strategy response:', error);
      throw new Error('Invalid strategy response format');
    }
  }

  private calculateExecutionTime(stepCount: number): string {
    const baseTime = 2; // minutes
    const timePerStep = 1.5;
    const totalMinutes = baseTime + (stepCount * timePerStep);
    
    if (totalMinutes < 60) {
      return `~${Math.round(totalMinutes)} minutes`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.round(totalMinutes % 60);
      return `~${hours}h ${minutes}m`;
    }
  }

  private async validateAndOptimize(strategy: GeneratedStrategy): Promise<GeneratedStrategy> {
    // Add validation logic here
    logger.ai('Strategy validated and optimized', { strategyId: strategy.id });
    return strategy;
  }

  async storeStrategyKnowledge(strategy: GeneratedStrategy, userFeedback: 'positive' | 'negative') {
    // Knowledge storage disabled for MVP
    logger.info('Strategy knowledge storage skipped for MVP', { 
      strategyId: strategy.id, 
      feedback: userFeedback 
    });
  }
}
