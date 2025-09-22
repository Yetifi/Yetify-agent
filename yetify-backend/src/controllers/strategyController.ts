import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { StrategyEngine } from '../ai-engine/StrategyEngine';
import { Strategy, User } from '../utils/database';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const strategyEngine = new StrategyEngine();

// Validation schemas
const createStrategySchema = Joi.object({
  prompt: Joi.string().min(10).max(500).required(),
  riskTolerance: Joi.string().valid('low', 'medium', 'high').default('medium'),
  investmentAmount: Joi.number().min(100).max(1000000).optional(),
  preferredChains: Joi.array().items(Joi.string()).optional(),
  timeHorizon: Joi.string().valid('short', 'medium', 'long').default('medium')
});

const updateStrategySchema = Joi.object({
  goal: Joi.string().min(5).max(200).optional(),
  status: Joi.string().valid('draft', 'active', 'paused', 'completed', 'failed').optional(),
  steps: Joi.array().items(Joi.object({
    action: Joi.string().required(),
    protocol: Joi.string().required(),
    asset: Joi.string().required(),
    amount: Joi.string().optional(),
    expectedApy: Joi.number().optional()
  })).optional()
});

// GET /api/v1/strategies - Get user's strategies
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    
    const filter: any = { userId: req.user!.id };
    if (status) {
      filter.status = status;
    }

    const strategies = await Strategy.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .populate('userId', 'walletAddress');

    const total = await Strategy.countDocuments(filter);

    logger.info(`Retrieved ${strategies.length} strategies for user ${req.user!.id}`);

    res.json({
      strategies,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: total > Number(offset) + Number(limit)
      }
    });
  } catch (error) {
    logger.error('Failed to get strategies:', error);
    res.status(500).json({
      error: 'Failed to retrieve strategies',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/v1/strategies/:id - Get specific strategy
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const strategy = await Strategy.findOne({ 
      id, 
      userId: req.user!.id 
    }).populate('userId', 'walletAddress');

    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        message: 'Strategy does not exist or access denied'
      });
    }

    logger.info(`Retrieved strategy ${id} for user ${req.user!.id}`);

    res.json({ strategy });
  } catch (error) {
    logger.error('Failed to get strategy:', error);
    res.status(500).json({
      error: 'Failed to retrieve strategy',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/v1/strategies/generate - Generate new strategy
router.post('/generate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate input
    const { error, value } = createStrategySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const strategyInput = {
      ...value,
      userAddress: req.user!.walletAddress
    };

    logger.ai('Generating strategy via REST API', {
      userId: req.user!.id,
      prompt: value.prompt
    });

    // Generate strategy using AI engine
    const generatedStrategy = await strategyEngine.generateStrategy(strategyInput);

    // Save to database
    const savedStrategy = await Strategy.create({
      ...generatedStrategy,
      userId: req.user!.id,
      prompt: value.prompt,
      status: 'draft'
    });

    logger.strategy('Strategy generated and saved', {
      strategyId: savedStrategy.id,
      userId: req.user!.id
    });

    res.status(201).json({
      strategy: savedStrategy,
      message: 'Strategy generated successfully'
    });
  } catch (error) {
    logger.error('Strategy generation failed:', error);
    res.status(500).json({
      error: 'Strategy generation failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// PUT /api/v1/strategies/:id - Update strategy
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate input
    const { error, value } = updateStrategySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    // Find and update strategy
    const strategy = await Strategy.findOneAndUpdate(
      { id, userId: req.user!.id },
      { ...value, updatedAt: new Date() },
      { new: true }
    );

    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        message: 'Strategy does not exist or access denied'
      });
    }

    logger.strategy('Strategy updated', {
      strategyId: id,
      userId: req.user!.id,
      changes: Object.keys(value)
    });

    res.json({
      strategy,
      message: 'Strategy updated successfully'
    });
  } catch (error) {
    logger.error('Strategy update failed:', error);
    res.status(500).json({
      error: 'Strategy update failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/v1/strategies/:id/activate - Activate strategy
router.post('/:id/activate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const strategy = await Strategy.findOneAndUpdate(
      { id, userId: req.user!.id },
      { status: 'active', updatedAt: new Date() },
      { new: true }
    );

    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        message: 'Strategy does not exist or access denied'
      });
    }

    logger.strategy('Strategy activated', {
      strategyId: id,
      userId: req.user!.id
    });

    res.json({
      strategy,
      message: 'Strategy activated successfully'
    });
  } catch (error) {
    logger.error('Strategy activation failed:', error);
    res.status(500).json({
      error: 'Strategy activation failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/v1/strategies/:id/pause - Pause strategy
router.post('/:id/pause', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const strategy = await Strategy.findOneAndUpdate(
      { id, userId: req.user!.id },
      { status: 'paused', updatedAt: new Date() },
      { new: true }
    );

    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        message: 'Strategy does not exist or access denied'
      });
    }

    logger.strategy('Strategy paused', {
      strategyId: id,
      userId: req.user!.id
    });

    res.json({
      strategy,
      message: 'Strategy paused successfully'
    });
  } catch (error) {
    logger.error('Strategy pause failed:', error);
    res.status(500).json({
      error: 'Strategy pause failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// DELETE /api/v1/strategies/:id - Delete strategy
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const strategy = await Strategy.findOneAndDelete({
      id,
      userId: req.user!.id
    });

    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        message: 'Strategy does not exist or access denied'
      });
    }

    logger.strategy('Strategy deleted', {
      strategyId: id,
      userId: req.user!.id
    });

    res.json({
      message: 'Strategy deleted successfully'
    });
  } catch (error) {
    logger.error('Strategy deletion failed:', error);
    res.status(500).json({
      error: 'Strategy deletion failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/v1/strategies/:id/feedback - Provide feedback for strategy learning
router.post('/:id/feedback', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { feedback, rating, comments } = req.body;

    if (!['positive', 'negative'].includes(feedback)) {
      return res.status(400).json({
        error: 'Invalid feedback',
        message: 'Feedback must be positive or negative'
      });
    }

    const strategy = await Strategy.findOne({
      id,
      userId: req.user!.id
    });

    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        message: 'Strategy does not exist or access denied'
      });
    }

    // Store feedback for AI learning - convert mongoose doc to plain object
    const strategyData = {
      id: strategy.id,
      goal: strategy.goal,
      chains: strategy.chains,
      protocols: strategy.protocols,
      steps: strategy.steps.map(step => ({
        action: step.action,
        protocol: step.protocol,
        asset: step.asset,
        amount: step.amount || undefined,
        expectedApy: step.expectedApy,
        riskScore: step.riskScore,
        gasEstimate: step.gasEstimate,
        dependencies: step.dependencies
      })),
      riskLevel: strategy.riskLevel,
      estimatedApy: strategy.estimatedApy,
      estimatedTvl: strategy.estimatedTvl,
      executionTime: strategy.executionTime,
      gasEstimate: strategy.gasEstimate,
      confidence: strategy.confidence,
      reasoning: strategy.reasoning,
      warnings: strategy.warnings
    } as any;
    await strategyEngine.storeStrategyKnowledge(strategyData, feedback);

    logger.ai('Strategy feedback received', {
      strategyId: id,
      userId: req.user!.id,
      feedback,
      rating
    });

    res.json({
      message: 'Feedback recorded successfully'
    });
  } catch (error) {
    logger.error('Feedback submission failed:', error);
    res.status(500).json({
      error: 'Feedback submission failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/v1/strategies/:id/performance - Get strategy performance
router.get('/:id/performance', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const strategy = await Strategy.findOne({
      id,
      userId: req.user!.id
    });

    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        message: 'Strategy does not exist or access denied'
      });
    }

    // Return current performance data
    const performance = strategy.performance || {
      totalInvested: 0,
      currentValue: 0,
      totalReturns: 0,
      roi: 0,
      lastUpdated: null
    };

    res.json({ performance });
  } catch (error) {
    logger.error('Failed to get strategy performance:', error);
    res.status(500).json({
      error: 'Failed to retrieve performance data',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/v1/strategies/analytics/summary - Get user's strategy analytics
router.get('/analytics/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const strategies = await Strategy.find({ userId });
    
    const summary = {
      totalStrategies: strategies.length,
      activeStrategies: strategies.filter(s => s.status === 'active').length,
      pausedStrategies: strategies.filter(s => s.status === 'paused').length,
      completedStrategies: strategies.filter(s => s.status === 'completed').length,
      totalInvested: strategies.reduce((sum, s) => sum + (s.performance?.totalInvested || 0), 0),
      totalReturns: strategies.reduce((sum, s) => sum + (s.performance?.totalReturns || 0), 0),
      averageROI: 0,
      bestPerformingStrategy: null as any,
      riskDistribution: {
        low: strategies.filter(s => s.riskLevel === 'Low').length,
        medium: strategies.filter(s => s.riskLevel === 'Medium').length,
        high: strategies.filter(s => s.riskLevel === 'High').length
      }
    };

    // Calculate average ROI
    const strategiesWithROI = strategies.filter(s => s.performance?.roi);
    if (strategiesWithROI.length > 0) {
      summary.averageROI = strategiesWithROI.reduce((sum, s) => sum + (s.performance?.roi || 0), 0) / strategiesWithROI.length;
    }

    // Find best performing strategy
    if (strategiesWithROI.length > 0) {
      summary.bestPerformingStrategy = strategiesWithROI.reduce((best, current) => 
        (current.performance?.roi || 0) > (best.performance?.roi || 0) ? current : best
      );
    }

    res.json({ summary });
  } catch (error) {
    logger.error('Failed to get strategy analytics:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/v1/strategies/update-onchain - Update strategy with on-chain data
router.post('/update-onchain', async (req: Request, res: Response) => {
  try {
    const { strategyId, onChainData } = req.body;

    if (!strategyId || !onChainData) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'strategyId and onChainData are required'
      });
    }

    const strategy = await Strategy.findOne({ id: strategyId });

    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        message: 'Strategy does not exist'
      });
    }

    // Extract transaction details from CLI output if needed
    let transactionHash = onChainData.transactionHash;
    let blockHeight = onChainData.blockHeight;
    
    // Initialize onChain if not exists
    if (!strategy.onChain) {
      strategy.onChain = {
        isStored: false,
        updateHistory: [] as any
      } as any;
    }

    // Update strategy with on-chain data
    strategy.onChain!.isStored = true;
    strategy.onChain!.contractAccount = onChainData.contractAccount || 'strategy-storage-yetify.testnet';
    strategy.onChain!.transactionHash = transactionHash;
    strategy.onChain!.blockHeight = blockHeight;
    strategy.onChain!.storedAt = new Date(onChainData.storedAt || Date.now());
    strategy.onChain!.nearExplorerUrl = `https://testnet.nearblocks.io/txns/${transactionHash}`;
    
    // Initialize storedData if not exists
    if (!strategy.onChain!.storedData) {
      strategy.onChain!.storedData = {} as any;
    }
    
    strategy.onChain!.storedData!.creator = onChainData.storedData?.creator || 'strategy-storage-yetify.testnet';
    strategy.onChain!.storedData!.created_at = onChainData.storedData?.created_at || Date.now();
    strategy.onChain!.storedData!.completeStrategyJson = onChainData.storedData?.completeStrategyJson || '';

    // Update strategy status to indicate it's been stored on-chain
    if (strategy.status === 'draft') {
      strategy.status = 'active';
    }

    await strategy.save();

    logger.info(`Strategy ${strategyId} updated with on-chain data`, {
      strategyId,
      transactionHash: transactionHash,
      contractAccount: strategy.onChain!.contractAccount
    });

    res.json({
      success: true,
      message: 'Strategy updated with on-chain data successfully',
      onChain: strategy.onChain
    });

  } catch (error) {
    logger.error('Failed to update strategy with on-chain data:', error);
    res.status(500).json({
      error: 'Failed to update on-chain data',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
