// Prompt Validation Schemas for Yetify AI Strategy Generation

import Joi from 'joi';

// Supported blockchain networks
export const SUPPORTED_CHAINS = [
  'Ethereum',
  'NEAR',
  'Arbitrum', 
  'Polygon',
  'Optimism',
  'Avalanche',
  'BSC'
] as const;

// Risk tolerance levels
export const RISK_TOLERANCE_LEVELS = [
  'low',
  'medium', 
  'high'
] as const;

// Time horizon options
export const TIME_HORIZONS = [
  'short',   // < 3 months
  'medium',  // 3-12 months
  'long'     // > 12 months
] as const;

// Strategy generation request validation
export const strategyGenerationSchema = Joi.object({
  prompt: Joi.string()
    .min(10)
    .max(2000)
    .required()
    .messages({
      'string.empty': 'Prompt cannot be empty',
      'string.min': 'Prompt must be at least 10 characters long',
      'string.max': 'Prompt cannot exceed 2000 characters',
      'any.required': 'Prompt is required'
    }),
    
  riskTolerance: Joi.string()
    .valid(...RISK_TOLERANCE_LEVELS)
    .default('medium')
    .messages({
      'any.only': 'Risk tolerance must be one of: low, medium, high'
    }),
    
  investmentAmount: Joi.number()
    .min(100)
    .max(10000000)
    .optional()
    .messages({
      'number.min': 'Investment amount must be at least $100',
      'number.max': 'Investment amount cannot exceed $10,000,000'
    }),
    
  preferredChains: Joi.array()
    .items(Joi.string().valid(...SUPPORTED_CHAINS))
    .min(1)
    .max(5)
    .optional()
    .messages({
      'array.min': 'At least one blockchain must be selected',
      'array.max': 'Cannot select more than 5 blockchains',
      'any.only': `Supported chains: ${SUPPORTED_CHAINS.join(', ')}`
    }),
    
  timeHorizon: Joi.string()
    .valid(...TIME_HORIZONS)
    .default('medium')
    .messages({
      'any.only': 'Time horizon must be one of: short, medium, long'
    })
});

// Test strategy generation request validation (simpler)
export const testStrategySchema = Joi.object({
  prompt: Joi.string()
    .min(5)
    .max(1000)
    .required()
    .messages({
      'string.empty': 'Prompt cannot be empty',
      'string.min': 'Prompt must be at least 5 characters long',
      'string.max': 'Prompt cannot exceed 1000 characters',
      'any.required': 'Prompt is required'
    })
});

// Strategy step validation
export const strategyStepSchema = Joi.object({
  action: Joi.string()
    .valid('deposit', 'stake', 'yield_farm', 'provide_liquidity', 'leverage', 'bridge')
    .required()
    .messages({
      'any.only': 'Action must be one of: deposit, stake, yield_farm, provide_liquidity, leverage, bridge',
      'any.required': 'Action is required'
    }),
    
  protocol: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Protocol name must be at least 2 characters',
      'string.max': 'Protocol name cannot exceed 100 characters',
      'any.required': 'Protocol is required'
    }),
    
  asset: Joi.string()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'Asset must be specified',
      'string.max': 'Asset name cannot exceed 50 characters',
      'any.required': 'Asset is required'
    }),
    
  amount: Joi.string()
    .optional()
    .messages({
      'string.base': 'Amount must be a string'
    }),
    
  expectedApy: Joi.number()
    .min(0)
    .max(1000)
    .optional()
    .messages({
      'number.min': 'Expected APY cannot be negative',
      'number.max': 'Expected APY cannot exceed 1000%'
    }),
    
  riskScore: Joi.number()
    .min(1)
    .max(10)
    .optional()
    .messages({
      'number.min': 'Risk score must be at least 1',
      'number.max': 'Risk score cannot exceed 10'
    }),
    
  gasEstimate: Joi.string()
    .optional(),
    
  dependencies: Joi.array()
    .items(Joi.string())
    .optional()
});

// Complete strategy validation
export const strategySchema = Joi.object({
  id: Joi.string()
    .pattern(/^strat_\d+$/)
    .required()
    .messages({
      'string.pattern.base': 'Strategy ID must follow format: strat_[timestamp]',
      'any.required': 'Strategy ID is required'
    }),
    
  userId: Joi.string()
    .pattern(/^user_\d+$/)
    .required()
    .messages({
      'string.pattern.base': 'User ID must follow format: user_[timestamp]',
      'any.required': 'User ID is required'
    }),
    
  goal: Joi.string()
    .min(5)
    .max(500)
    .required()
    .messages({
      'string.min': 'Goal must be at least 5 characters',
      'string.max': 'Goal cannot exceed 500 characters',
      'any.required': 'Goal is required'
    }),
    
  prompt: Joi.string()
    .min(10)
    .max(2000)
    .required(),
    
  chains: Joi.array()
    .items(Joi.string().valid(...SUPPORTED_CHAINS))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one chain is required'
    }),
    
  protocols: Joi.array()
    .items(Joi.string())
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one protocol is required'
    }),
    
  steps: Joi.array()
    .items(strategyStepSchema)
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'At least one step is required',
      'array.max': 'Cannot have more than 10 steps',
      'any.required': 'Steps are required'
    }),
    
  riskLevel: Joi.string()
    .valid('Low', 'Medium', 'High')
    .required()
    .messages({
      'any.only': 'Risk level must be Low, Medium, or High'
    }),
    
  status: Joi.string()
    .valid('draft', 'active', 'paused', 'completed', 'failed')
    .default('draft'),
    
  estimatedApy: Joi.number()
    .min(0)
    .max(1000)
    .required()
    .messages({
      'number.min': 'Estimated APY cannot be negative',
      'number.max': 'Estimated APY cannot exceed 1000%'
    }),
    
  estimatedTvl: Joi.string()
    .required()
    .messages({
      'any.required': 'Estimated TVL is required'
    }),
    
  confidence: Joi.number()
    .min(0)
    .max(100)
    .optional()
    .messages({
      'number.min': 'Confidence cannot be negative',
      'number.max': 'Confidence cannot exceed 100'
    }),
    
  reasoning: Joi.string()
    .max(2000)
    .optional()
    .messages({
      'string.max': 'Reasoning cannot exceed 2000 characters'
    }),
    
  warnings: Joi.array()
    .items(Joi.string().max(500))
    .optional()
    .messages({
      'string.max': 'Each warning cannot exceed 500 characters'
    })
});

// Execution request validation
export const executionRequestSchema = Joi.object({
  strategyId: Joi.string()
    .pattern(/^strat_\d+$/)
    .required()
    .messages({
      'string.pattern.base': 'Strategy ID must follow format: strat_[timestamp]',
      'any.required': 'Strategy ID is required'
    }),
    
  dryRun: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Dry run must be a boolean value'
    })
});

// Query parameter validation schemas
export const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),
    
  limit: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(10)
    .messages({
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50'
    })
});

export const strategyFilterSchema = paginationSchema.keys({
  status: Joi.string()
    .valid('draft', 'active', 'paused', 'completed', 'failed')
    .optional()
    .messages({
      'any.only': 'Status must be one of: draft, active, paused, completed, failed'
    })
});

export const performancePeriodSchema = Joi.object({
  period: Joi.string()
    .valid('1d', '7d', '30d', '90d', '1y')
    .default('7d')
    .messages({
      'any.only': 'Period must be one of: 1d, 7d, 30d, 90d, 1y'
    })
});

// Common validation patterns
export const patterns = {
  walletAddress: {
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    near: /^[a-z0-9._-]+\.near$|^[a-f0-9]{64}$/
  },
  
  transactionHash: {
    ethereum: /^0x[a-fA-F0-9]{64}$/,
    near: /^[a-zA-Z0-9]{43,44}$/
  },
  
  amount: /^\d+(\.\d+)?$/,
  
  percentage: /^\d+(\.\d{1,2})?$/,
  
  id: {
    strategy: /^strat_\d+$/,
    user: /^user_\d+$/,
    execution: /^exec_\d+$/
  }
};

// Validation helper functions
export function validatePrompt(prompt: string): {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  // Basic length validation
  if (prompt.length < 10) {
    errors.push('Prompt is too short (minimum 10 characters)');
    suggestions.push('Try describing your investment goals in more detail');
  }
  
  if (prompt.length > 2000) {
    errors.push('Prompt is too long (maximum 2000 characters)');
    suggestions.push('Try to be more concise while keeping key details');
  }
  
  // Content validation
  const investmentKeywords = ['invest', 'earn', 'yield', 'apy', 'return', 'profit', 'stake', 'farm'];
  const hasInvestmentContext = investmentKeywords.some(keyword => 
    prompt.toLowerCase().includes(keyword)
  );
  
  if (!hasInvestmentContext) {
    errors.push('Prompt should describe an investment or earning strategy');
    suggestions.push('Include keywords like: invest, earn, yield, stake, or farming');
  }
  
  // Amount detection
  const amountPattern = /\$[\d,]+|\d+\s*(usd|usdc|dai|near|eth)/i;
  if (!amountPattern.test(prompt)) {
    suggestions.push('Consider specifying an investment amount (e.g., $10,000)');
  }
  
  // Risk detection
  const riskKeywords = ['risk', 'safe', 'conservative', 'aggressive', 'stable'];
  const hasRiskContext = riskKeywords.some(keyword => 
    prompt.toLowerCase().includes(keyword)
  );
  
  if (!hasRiskContext) {
    suggestions.push('Consider mentioning your risk tolerance (low, medium, high)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
}

export function validateChainSupport(chains: string[]): {
  supported: string[];
  unsupported: string[];
} {
  const supported: string[] = [];
  const unsupported: string[] = [];
  
  chains.forEach(chain => {
    const normalizedChain = chain.charAt(0).toUpperCase() + chain.slice(1).toLowerCase();
    if (SUPPORTED_CHAINS.includes(normalizedChain as any)) {
      supported.push(normalizedChain);
    } else {
      unsupported.push(chain);
    }
  });
  
  return { supported, unsupported };
}

export function sanitizePrompt(prompt: string): string {
  // Remove potentially harmful content
  return prompt
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/data:/gi, '') // Remove data: protocols
    .trim()
    .substring(0, 2000); // Ensure max length
}

// Export validation middleware factory
export function createValidationMiddleware(schema: Joi.ObjectSchema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.details.map(detail => detail.message).join(', '),
        timestamp: new Date().toISOString()
      });
    }
    
    req.body = value;
    next();
  };
}

// Commonly used validation middleware
export const validateStrategyGeneration = createValidationMiddleware(strategyGenerationSchema);
export const validateTestStrategy = createValidationMiddleware(testStrategySchema);
export const validateExecution = createValidationMiddleware(executionRequestSchema);