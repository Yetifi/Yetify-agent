import { Request, Response } from 'express';
import { OpenRouterService } from '../services/OpenRouterService';
import { StrategyEngine } from '../ai-engine/StrategyEngine';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export class TestController {
  private openRouter: OpenRouterService;
  private strategyEngine: StrategyEngine;

  constructor() {
    this.openRouter = new OpenRouterService();
    this.strategyEngine = new StrategyEngine();
  }

  async testOpenRouter(req: Request, res: Response) {
    try {
      logger.info('Testing OpenRouter connection...');
      
      const isConnected = await this.openRouter.testConnection();
      const modelInfo = this.openRouter.getModelInfo();

      res.json({
        success: true,
        message: 'OpenRouter test completed',
        connection: isConnected,
        model: modelInfo,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('OpenRouter test failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async testStrategyGeneration(req: Request, res: Response) {
    try {
      const { prompt, userAddress, userApiKey } = req.body;
      
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Prompt is required'
        });
      }

      logger.info('Testing strategy generation with prompt:', prompt);

      const strategy = await this.strategyEngine.generateStrategy({
        prompt,
        userAddress, // Optional: for testing database API key
        userApiKey, // Optional: for testing request API key
        riskTolerance: 'medium',
        investmentAmount: 1000,
        preferredChains: ['Ethereum', 'NEAR'],
        timeHorizon: 'medium'
      });

      res.json({
        success: true,
        message: 'Strategy generated successfully',
        strategy,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Strategy generation test failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async healthCheck(req: Request, res: Response) {
    try {
      const openRouterStatus = await this.openRouter.testConnection();
      
      res.json({
        success: true,
        services: {
          openRouter: {
            status: openRouterStatus ? 'connected' : 'disconnected',
            model: this.openRouter.getModelInfo()
          },
          strategyEngine: {
            status: 'initialized'
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export router
import { Router } from 'express';
const router = Router();
const testController = new TestController();

router.get('/openrouter', testController.testOpenRouter.bind(testController));
router.post('/strategy', testController.testStrategyGeneration.bind(testController));
router.get('/health', testController.healthCheck.bind(testController));

export default router;