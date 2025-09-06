// Strategy Storage Utilities for LocalStorage Management

export interface StrategyPlan {
  id?: string;
  goal: string;
  chains: string[];
  protocols: string[];
  steps: Array<{
    action: string;
    protocol: string;
    asset: string;
    expectedApy?: number;
    amount?: string;
  }>;
  riskLevel: string;
  estimatedApy?: number;
  estimatedTvl?: string;
  confidence?: number;
  reasoning?: string;
  warnings?: string[];
}

export interface ExecutionRecord {
  id: string;
  timestamp: Date;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  transactionHash?: string;
  errorMessage?: string;
  gasUsed?: string;
  actualReturn?: number;
}

export interface SavedStrategy extends StrategyPlan {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt?: Date;
  status: 'saved' | 'executing' | 'completed' | 'failed';
  executionHistory?: ExecutionRecord[];
  performance?: {
    actualApy?: number;
    totalReturn?: number;
    executionTime?: number;
    lastUpdated?: Date;
  };
  tags?: string[];
}

const STORAGE_KEY = 'yetify_saved_strategies';

/**
 * Generate unique ID for strategies
 */
export function generateStrategyId(): string {
  return `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all saved strategies from localStorage
 */
export function getSavedStrategies(): SavedStrategy[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const strategies = JSON.parse(stored);
    
    // Convert date strings back to Date objects
    return strategies.map((strategy: any) => ({
      ...strategy,
      createdAt: new Date(strategy.createdAt),
      updatedAt: strategy.updatedAt ? new Date(strategy.updatedAt) : undefined,
      executionHistory: strategy.executionHistory?.map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp)
      })) || [],
      performance: strategy.performance ? {
        ...strategy.performance,
        lastUpdated: strategy.performance.lastUpdated ? new Date(strategy.performance.lastUpdated) : undefined
      } : undefined
    }));
  } catch (error) {
    console.error('Error loading saved strategies:', error);
    return [];
  }
}

/**
 * Save a new strategy to localStorage
 */
export function saveStrategy(strategy: StrategyPlan, name: string, tags?: string[]): SavedStrategy {
  const savedStrategy: SavedStrategy = {
    ...strategy,
    id: strategy.id || generateStrategyId(),
    name,
    createdAt: new Date(),
    status: 'saved',
    tags: tags || []
  };

  const existingStrategies = getSavedStrategies();
  const updatedStrategies = [...existingStrategies, savedStrategy];
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStrategies));
  
  return savedStrategy;
}

/**
 * Update an existing strategy
 */
export function updateStrategy(id: string, updates: Partial<SavedStrategy>): SavedStrategy | null {
  const strategies = getSavedStrategies();
  const strategyIndex = strategies.findIndex(s => s.id === id);
  
  if (strategyIndex === -1) {
    console.error('Strategy not found:', id);
    return null;
  }

  const updatedStrategy: SavedStrategy = {
    ...strategies[strategyIndex],
    ...updates,
    updatedAt: new Date()
  };

  strategies[strategyIndex] = updatedStrategy;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(strategies));
  
  return updatedStrategy;
}

/**
 * Delete a strategy
 */
export function deleteStrategy(id: string): boolean {
  try {
    const strategies = getSavedStrategies();
    const filteredStrategies = strategies.filter(s => s.id !== id);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredStrategies));
    return true;
  } catch (error) {
    console.error('Error deleting strategy:', error);
    return false;
  }
}

/**
 * Get a single strategy by ID
 */
export function getStrategyById(id: string): SavedStrategy | null {
  const strategies = getSavedStrategies();
  return strategies.find(s => s.id === id) || null;
}

/**
 * Add execution record to a strategy
 */
export function addExecutionRecord(strategyId: string, record: Omit<ExecutionRecord, 'id'>): boolean {
  const executionRecord: ExecutionRecord = {
    ...record,
    id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date()
  };

  const strategy = getStrategyById(strategyId);
  if (!strategy) return false;

  const updatedStrategy = {
    ...strategy,
    executionHistory: [...(strategy.executionHistory || []), executionRecord],
    status: record.status === 'started' ? 'executing' as const : 
            record.status === 'completed' ? 'completed' as const :
            record.status === 'failed' ? 'failed' as const : strategy.status
  };

  return updateStrategy(strategyId, updatedStrategy) !== null;
}

/**
 * Update strategy performance metrics
 */
export function updatePerformanceMetrics(strategyId: string, metrics: SavedStrategy['performance']): boolean {
  const performance = {
    ...metrics,
    lastUpdated: new Date()
  };

  return updateStrategy(strategyId, { performance }) !== null;
}

/**
 * Get strategies by status
 */
export function getStrategiesByStatus(status: SavedStrategy['status']): SavedStrategy[] {
  return getSavedStrategies().filter(s => s.status === status);
}

/**
 * Search strategies by name or goal
 */
export function searchStrategies(query: string): SavedStrategy[] {
  const strategies = getSavedStrategies();
  const lowercaseQuery = query.toLowerCase();
  
  return strategies.filter(s => 
    s.name.toLowerCase().includes(lowercaseQuery) ||
    s.goal.toLowerCase().includes(lowercaseQuery) ||
    (s.tags && s.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)))
  );
}