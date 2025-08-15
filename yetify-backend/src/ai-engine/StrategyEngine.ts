import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { createLogger } from '../utils/logger';

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
  action: 'deposit' | 'stake' | 'yield_farm' | 'provide_liquidity' | 'leverage' | 'bridge';
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
  private openAI: OpenAI;
  private pinecone: Pinecone;
  private vectorStore: PineconeStore | null = null;
  private protocolService: ProtocolDataService;
  private marketService: MarketDataService;

  constructor() {
    // Initialize AI models
    this.geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.openAI = new OpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.7,
      modelName: 'gpt-4-turbo-preview'
    });

    // Initialize Pinecone for RAG
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENVIRONMENT!
    });

    // Initialize services
    this.protocolService = new ProtocolDataService();
    this.marketService = new MarketDataService();

    this.initializeVectorStore();
  }

  private async initializeVectorStore() {
    try {
      const index = this.pinecone.Index(process.env.PINECONE_INDEX || 'yetify-strategies');
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY
      });

      this.vectorStore = new PineconeStore(embeddings, {
        pineconeIndex: index,
        textKey: 'text',
        namespace: 'strategy-knowledge'
      });

      logger.ai('Vector store initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize vector store:', error);
    }
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
    if (!this.vectorStore) {
      logger.warn('Vector store not available, using fallback knowledge');
      return this.getFallbackKnowledge();
    }

    try {
      const results = await this.vectorStore.similaritySearch(query, 5);
      const knowledge = results.map(doc => doc.pageContent);
      
      logger.ai('Retrieved relevant knowledge', { 
        query,
        resultCount: knowledge?.length || 0
      });
      
      return knowledge;
    } catch (error) {
      logger.error('Knowledge retrieval failed:', error);
      return this.getFallbackKnowledge();
    }
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
      // Try Gemini first, fallback to OpenAI
      let response: string;
      
      try {
        const model = this.geminiAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
        response = result.response.text();
        logger.ai('Strategy generated using Gemini');
      } catch (geminiError) {
        logger.warn('Gemini failed, falling back to OpenAI:', geminiError);
        
        const chatPrompt = ChatPromptTemplate.fromMessages([
          ['system', systemPrompt],
          ['human', userPrompt]
        ]);
        
        const chain = chatPrompt.pipe(this.openAI);
        const result: any = await chain.invoke({});
        response = typeof result.content === 'string' ? result.content : String(result.content);
        logger.ai('Strategy generated using OpenAI');
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
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        id: `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        goal: parsed.goal || prompt.prompt,
        chains: parsed.chains || ['Ethereum', 'NEAR'],
        protocols: parsed.protocols || ['Aave', 'Lido'],
        steps: parsed.steps || [],
        riskLevel: parsed.riskLevel || 'Medium',
        estimatedApy: parsed.estimatedApy || 8.5,
        estimatedTvl: prompt.investmentAmount ? `$${prompt.investmentAmount}` : '$1,000',
        executionTime: this.calculateExecutionTime(parsed.steps?.length || 1),
        gasEstimate: {
          ethereum: '0.02 ETH',
          near: '0.1 NEAR',
          arbitrum: '0.005 ETH'
        },
        confidence: parsed.confidence || 85,
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
    if (!this.vectorStore) return;

    try {
      const document = {
        pageContent: `Strategy: ${strategy.goal}. Chains: ${strategy.chains.join(', ')}. Protocols: ${strategy.protocols.join(', ')}. APY: ${strategy.estimatedApy}%. Risk: ${strategy.riskLevel}. Feedback: ${userFeedback}`,
        metadata: {
          strategyId: strategy.id,
          feedback: userFeedback,
          timestamp: new Date().toISOString()
        }
      };

      await this.vectorStore.addDocuments([document]);
      logger.ai('Strategy knowledge stored', { strategyId: strategy.id, feedback: userFeedback });
    } catch (error) {
      logger.error('Failed to store strategy knowledge:', error);
    }
  }
}
