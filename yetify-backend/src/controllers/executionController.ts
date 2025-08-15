import { Router, Response } from 'express';
import Joi from 'joi';
import { ExecutionEngine } from '../execution-layer/ExecutionEngine';
import { Strategy } from '../utils/database';
import { logger } from '../utils/logger';
import { AuthenticatedRequest, createUserRateLimit } from '../middleware/auth';

const router = Router();
const executionEngine = new ExecutionEngine();

// Rate limiting for execution endpoints (max 5 executions per hour per user)
const executionRateLimit = createUserRateLimit(5, 60 * 60 * 1000);

// Validation schemas
const executeStrategySchema = Joi.object({
  strategyId: Joi.string().required(),
  investmentAmount: Joi.number().min(100).max(1000000).required(),
  slippageTolerance: Joi.number().min(0.1).max(10).default(2),
  gasPreference: Joi.string().valid('slow', 'standard', 'fast').default('standard'),
  confirmExecution: Joi.boolean().default(false)
});

const estimateGasSchema = Joi.object({
  strategyId: Joi.string().required(),
  investmentAmount: Joi.number().min(100).max(1000000).required()
});

// POST /api/v1/execution/estimate - Estimate gas costs for strategy execution
router.post('/estimate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate input
    const { error, value } = estimateGasSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { strategyId, investmentAmount } = value;

    // Find strategy
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

    // Create execution context for estimation
    const executionContext = {
      userAddress: req.user!.walletAddress,
      strategy,
      walletType: req.user!.walletType as 'metamask' | 'near' | 'walletconnect',
      investmentAmount,
      slippageTolerance: 2,
      gasPreference: 'standard' as const
    };

    // Estimate gas costs
    const gasEstimates = await executionEngine.estimateGasForStrategy(executionContext);

    // Calculate USD costs (mock prices for demo)
    const gasPrices = {
      ethereum: 25, // gwei
      near: 0.0001, // NEAR per TGas
      arbitrum: 0.1 // gwei
    };

    const usdEstimates = Object.entries(gasEstimates).reduce((acc, [chain, gasAmount]) => {
      let usdCost = 0;
      
      if (chain === 'ethereum') {
        const ethGas = parseFloat(gasAmount) * gasPrices.ethereum * 1e-9 * 2400; // ETH price
        usdCost = ethGas;
      } else if (chain === 'near') {
        const nearGas = parseFloat(gasAmount.replace(' TGas', '')) * gasPrices.near * 3.2; // NEAR price
        usdCost = nearGas;
      } else if (chain === 'arbitrum') {
        const arbGas = parseFloat(gasAmount) * gasPrices.arbitrum * 1e-9 * 2400; // ETH price
        usdCost = arbGas;
      }

      acc[chain] = {
        gasAmount,
        estimatedCostUSD: usdCost.toFixed(2)
      };
      return acc;
    }, {} as any);

    const totalUSD = Object.values(usdEstimates).reduce((sum: number, estimate: any) => 
      sum + parseFloat(estimate.estimatedCostUSD), 0
    );

    logger.execution('Gas estimation completed', {
      strategyId,
      userId: req.user!.id,
      totalUSD: totalUSD.toFixed(2)
    });

    res.json({
      gasEstimates: usdEstimates,
      totalEstimatedCostUSD: totalUSD.toFixed(2),
      estimatedExecutionTime: strategy.executionTime,
      breakdown: {
        stepCount: strategy.steps.length,
        chainsInvolved: [...new Set(strategy.chains)],
        protocolsInvolved: [...new Set(strategy.protocols)]
      }
    });
  } catch (error) {
    logger.error('Gas estimation failed:', error);
    res.status(500).json({
      error: 'Gas estimation failed',
      message: error.message
    });
  }
});

// POST /api/v1/execution/execute - Execute strategy
router.post('/execute', executionRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate input
    const { error, value } = executeStrategySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { strategyId, investmentAmount, slippageTolerance, gasPreference, confirmExecution } = value;

    if (!confirmExecution) {
      return res.status(400).json({
        error: 'Execution not confirmed',
        message: 'Please confirm execution by setting confirmExecution to true'
      });
    }

    // Find strategy
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

    // Check strategy status
    if (strategy.status === 'active') {
      return res.status(400).json({
        error: 'Strategy already active',
        message: 'This strategy is already being executed'
      });
    }

    if (strategy.status === 'failed') {
      return res.status(400).json({
        error: 'Strategy failed',
        message: 'This strategy has failed and cannot be executed'
      });
    }

    // Create execution context
    const executionContext = {
      userAddress: req.user!.walletAddress,
      strategy,
      walletType: req.user!.walletType as 'metamask' | 'near' | 'walletconnect',
      investmentAmount,
      slippageTolerance,
      gasPreference
    };

    logger.execution('Starting strategy execution', {
      strategyId,
      userId: req.user!.id,
      investmentAmount,
      stepCount: strategy.steps.length
    });

    // Update strategy status to active
    await Strategy.findByIdAndUpdate(strategy._id, {
      status: 'active',
      'performance.totalInvested': investmentAmount,
      updatedAt: new Date()
    });

    // Execute strategy (this runs in background)
    executionEngine.executeStrategy(executionContext)
      .then(async (results) => {
        const success = results.every(r => r.status === 'success');
        
        await Strategy.findByIdAndUpdate(strategy._id, {
          status: success ? 'active' : 'failed',
          executionHistory: results,
          updatedAt: new Date()
        });

        logger.execution('Strategy execution completed', {
          strategyId,
          success,
          executedSteps: results.length
        });
      })
      .catch(async (error) => {
        await Strategy.findByIdAndUpdate(strategy._id, {
          status: 'failed',
          updatedAt: new Date()
        });

        logger.error('Strategy execution failed:', error);
      });

    // Return immediate response
    res.status(202).json({
      message: 'Strategy execution started',
      strategyId,
      status: 'executing',
      estimatedCompletionTime: strategy.executionTime,
      executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      steps: strategy.steps.map((step, index) => ({
        stepNumber: index + 1,
        action: step.action,
        protocol: step.protocol,
        asset: step.asset,
        status: 'pending'
      }))
    });
  } catch (error) {
    logger.error('Strategy execution failed:', error);
    res.status(500).json({
      error: 'Strategy execution failed',
      message: error.message
    });
  }
});

// GET /api/v1/execution/status/:strategyId - Get execution status
router.get('/status/:strategyId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { strategyId } = req.params;

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

    const executionHistory = strategy.executionHistory || [];
    const completedSteps = executionHistory.filter(step => step.status === 'success').length;
    const totalSteps = strategy.steps.length;
    const failedSteps = executionHistory.filter(step => step.status === 'failed').length;

    let overallStatus = 'unknown';
    if (strategy.status === 'active' && completedSteps === totalSteps) {
      overallStatus = 'completed';
    } else if (strategy.status === 'active' && completedSteps < totalSteps) {
      overallStatus = 'executing';
    } else if (strategy.status === 'failed' || failedSteps > 0) {
      overallStatus = 'failed';
    } else if (strategy.status === 'draft') {
      overallStatus = 'not_started';
    }

    res.json({
      strategyId,
      status: overallStatus,
      progress: {
        completedSteps,
        totalSteps,
        failedSteps,
        progressPercentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
      },
      executionHistory: executionHistory.map(step => ({
        timestamp: step.timestamp,
        action: step.action,
        status: step.status,
        transactionHash: step.transactionHash,
        gasUsed: step.gasUsed,
        error: step.error
      })),
      estimatedCompletionTime: strategy.executionTime,
      lastUpdated: strategy.updatedAt
    });
  } catch (error) {
    logger.error('Failed to get execution status:', error);
    res.status(500).json({
      error: 'Failed to retrieve execution status',
      message: error.message
    });
  }
});

// POST /api/v1/execution/cancel/:strategyId - Cancel strategy execution
router.post('/cancel/:strategyId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { strategyId } = req.params;

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

    if (strategy.status !== 'active') {
      return res.status(400).json({
        error: 'Cannot cancel strategy',
        message: 'Strategy is not currently executing'
      });
    }

    // Update strategy status to paused
    await Strategy.findByIdAndUpdate(strategy._id, {
      status: 'paused',
      updatedAt: new Date()
    });

    logger.execution('Strategy execution cancelled', {
      strategyId,
      userId: req.user!.id
    });

    res.json({
      message: 'Strategy execution cancelled',
      strategyId,
      status: 'paused'
    });
  } catch (error) {
    logger.error('Strategy cancellation failed:', error);
    res.status(500).json({
      error: 'Strategy cancellation failed',
      message: error.message
    });
  }
});

// GET /api/v1/execution/history - Get user's execution history
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const strategies = await Strategy.find({
      userId: req.user!.id,
      executionHistory: { $exists: true, $ne: [] }
    })
    .sort({ updatedAt: -1 })
    .limit(Number(limit))
    .skip(Number(offset))
    .select('id goal status executionHistory createdAt updatedAt');

    const executionHistory = strategies.map(strategy => ({
      strategyId: strategy.id,
      strategyGoal: strategy.goal,
      status: strategy.status,
      executedAt: strategy.updatedAt,
      steps: strategy.executionHistory?.map(step => ({
        action: step.action,
        status: step.status,
        transactionHash: step.transactionHash,
        gasUsed: step.gasUsed
      })) || []
    }));

    res.json({
      executions: executionHistory,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: strategies.length
      }
    });
  } catch (error) {
    logger.error('Failed to get execution history:', error);
    res.status(500).json({
      error: 'Failed to retrieve execution history',
      message: error.message
    });
  }
});

// POST /api/v1/execution/dry-run - Perform a dry run simulation
router.post('/dry-run', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = executeStrategySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { strategyId, investmentAmount } = value;

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

    // Simulate execution without actually executing
    const simulation = {
      strategyId,
      simulationId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectedOutcome: {
        estimatedAPY: strategy.estimatedApy,
        projectedValue: investmentAmount * (1 + strategy.estimatedApy / 100),
        timeToBreakeven: Math.round(365 / strategy.estimatedApy * 30), // days
        riskFactors: strategy.warnings
      },
      steps: strategy.steps.map((step, index) => ({
        stepNumber: index + 1,
        action: step.action,
        protocol: step.protocol,
        asset: step.asset,
        estimatedGas: step.gasEstimate || '50000',
        simulatedResult: 'success',
        projectedAPY: step.expectedApy
      })),
      totalEstimatedCost: '$5.50',
      confidence: strategy.confidence
    };

    logger.execution('Dry run simulation completed', {
      strategyId,
      userId: req.user!.id,
      investmentAmount
    });

    res.json({
      simulation,
      message: 'Dry run completed successfully'
    });
  } catch (error) {
    logger.error('Dry run simulation failed:', error);
    res.status(500).json({
      error: 'Dry run simulation failed',
      message: error.message
    });
  }
});

export default router;
