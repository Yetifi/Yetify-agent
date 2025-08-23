import { ethers } from 'ethers';
import { JsonRpcProvider } from '@near-js/providers';
import { Account } from '@near-js/accounts';
import { KeyPairSigner } from '@near-js/signers';
import { KeyPair } from '@near-js/crypto';
import { InMemoryKeyStore } from '@near-js/keystores';
import { createLogger } from '../utils/logger';

const logger = createLogger();
import { GeneratedStrategy, StrategyStep } from '../ai-engine/StrategyEngine';

export interface ExecutionContext {
  userAddress: string;
  strategy: GeneratedStrategy;
  walletType: 'metamask' | 'near' | 'walletconnect';
  investmentAmount: number;
  slippageTolerance: number;
  gasPreference: 'slow' | 'standard' | 'fast';
}

export interface ExecutionResult {
  stepId: string;
  status: 'pending' | 'success' | 'failed';
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  actualAmount?: string;
  error?: string;
  timestamp: string;
}

export interface ChainExecutor {
  executeStep(step: StrategyStep, context: ExecutionContext): Promise<ExecutionResult>;
  estimateGas(step: StrategyStep, context: ExecutionContext): Promise<string>;
  validateStep(step: StrategyStep, context: ExecutionContext): Promise<boolean>;
}

export class ExecutionEngine {
  private ethereumExecutor: EthereumExecutor;
  private nearExecutor: NearExecutor;
  private arbitrumExecutor: ArbitrumExecutor;

  constructor() {
    this.ethereumExecutor = new EthereumExecutor();
    this.nearExecutor = new NearExecutor();
    this.arbitrumExecutor = new ArbitrumExecutor();
  }

  async executeStrategy(context: ExecutionContext): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    try {
      logger.execution('Starting strategy execution', {
        strategyId: context.strategy.id,
        stepCount: context.strategy.steps.length,
        userAddress: context.userAddress
      });

      // Validate all steps before execution
      const validationResults = await this.validateAllSteps(context);
      if (validationResults.some(v => !v.isValid)) {
        throw new Error(
          'Strategy validation failed: ' +
            validationResults
              .filter(v => !v.isValid)
              .map(v => v.error)
              .join(', ')
        );
      }

      // Execute steps sequentially
      for (let i = 0; i < context.strategy.steps.length; i++) {
        const step = context.strategy.steps[i];

        try {
          logger.execution(`Executing step ${i + 1}/${context.strategy.steps.length}`, {
            action: step.action,
            protocol: step.protocol,
            asset: step.asset
          });

          const result = await this.executeStep(step, context, `step_${i}`);
          results.push(result);

          // Stop execution if step fails
          if (result.status === 'failed') {
            logger.error(`Step ${i + 1} failed, stopping execution`, result);
            break;
          }

          // Wait between steps to avoid nonce conflicts
          await this.delay(2000);
        } catch (error) {
          logger.error(`Error executing step ${i + 1}:`, error);
          results.push({
            stepId: `step_${i}`,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          });
          break;
        }
      }

      logger.execution('Strategy execution completed', {
        strategyId: context.strategy.id,
        successfulSteps: results.filter(r => r.status === 'success').length,
        totalSteps: results.length
      });

      return results;
    } catch (error) {
      logger.error('Strategy execution failed:', error);
      throw new Error(`Execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeStep(
    step: StrategyStep,
    context: ExecutionContext,
    stepId: string
  ): Promise<ExecutionResult> {
    const executor = this.getExecutorForStep(step);

    if (!executor) {
      throw new Error(`No executor available for protocol: ${step.protocol}`);
    }

    try {
      const result = await executor.executeStep(step, context);
      return { ...result, stepId };
    } catch (error) {
      logger.error(`Step execution failed:`, error);
      return {
        stepId,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  private getExecutorForStep(step: StrategyStep): ChainExecutor | null {
    // Determine which chain executor to use based on protocol
    const protocolChainMap: { [key: string]: string } = {
      aave: 'ethereum',
      lido: 'ethereum',
      uniswap: 'ethereum',
      curve: 'ethereum',
      compound: 'ethereum',
      'ref finance': 'near',
      burrow: 'near',
      'meta pool': 'near'
    };

    const chain = protocolChainMap[step.protocol.toLowerCase()];

    switch (chain) {
      case 'ethereum':
        return this.ethereumExecutor;
      case 'near':
        return this.nearExecutor;
      case 'arbitrum':
        return this.arbitrumExecutor;
      default:
        // Default to Ethereum for unknown protocols
        return this.ethereumExecutor;
    }
  }

  private async validateAllSteps(
    context: ExecutionContext
  ): Promise<Array<{ isValid: boolean; error?: string }>> {
    const validations = [];

    for (const step of context.strategy.steps) {
      const executor = this.getExecutorForStep(step);

      if (!executor) {
        validations.push({
          isValid: false,
          error: `No executor for protocol: ${step.protocol}`
        });
        continue;
      }

      try {
        const isValid = await executor.validateStep(step, context);
        validations.push({ isValid });
      } catch (error) {
        validations.push({
          isValid: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return validations;
  }

  async estimateGasForStrategy(context: ExecutionContext): Promise<{ [chain: string]: string }> {
    const gasEstimates: { [chain: string]: string } = {};

    for (const step of context.strategy.steps) {
      const executor = this.getExecutorForStep(step);

      if (executor) {
        try {
          const gasEstimate = await executor.estimateGas(step, context);
          const chain = this.getChainForStep(step);

          if (gasEstimates[chain]) {
            // Sum gas estimates for the same chain
            gasEstimates[chain] = (
              parseFloat(gasEstimates[chain]) + parseFloat(gasEstimate)
            ).toString();
          } else {
            gasEstimates[chain] = gasEstimate;
          }
        } catch (error) {
          logger.error(`Gas estimation failed for step:`, error);
        }
      }
    }

    return gasEstimates;
  }

  private getChainForStep(step: StrategyStep): string {
    const protocolChainMap: { [key: string]: string } = {
      aave: 'ethereum',
      lido: 'ethereum',
      uniswap: 'ethereum',
      'ref finance': 'near',
      burrow: 'near'
    };

    return protocolChainMap[step.protocol.toLowerCase()] || 'ethereum';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Ethereum Executor Implementation
class EthereumExecutor implements ChainExecutor {
  private provider: ethers.Provider;
  private contracts: Map<string, ethers.Contract> = new Map();

  constructor() {
    this.provider = new ethers.JsonRpcProvider(
      process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/your_key'
    );
    this.initializeContracts();
  }

  private initializeContracts() {
    // Initialize common DeFi protocol contracts
    // This would contain actual contract addresses and ABIs in production
    const aaveV3PoolAddress = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
    const lidoStETHAddress = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';

    // Mock contract interfaces - in production, load actual ABIs
    const mockABI = [
      'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
      'function withdraw(address asset, uint256 amount, address to)',
      'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
      'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)'
    ];

    try {
      this.contracts.set('aave', new ethers.Contract(aaveV3PoolAddress, mockABI, this.provider));
      this.contracts.set('lido', new ethers.Contract(lidoStETHAddress, mockABI, this.provider));
    } catch (error) {
      logger.error('Failed to initialize Ethereum contracts:', error);
    }
  }

  async executeStep(step: StrategyStep, context: ExecutionContext): Promise<ExecutionResult> {
    try {
      logger.execution('Executing Ethereum step', { step: step.action, protocol: step.protocol });

      // This would contain actual transaction execution logic
      // For now, simulate execution
      await this.delay(3000); // Simulate transaction time

      // Mock successful execution
      const mockResult: ExecutionResult = {
        stepId: `eth_${Date.now()}`,
        status: 'success',
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
        gasUsed: (Math.random() * 100000 + 50000).toFixed(0),
        actualAmount: step.amount || '1000',
        timestamp: new Date().toISOString()
      };

      logger.execution('Ethereum step executed successfully', mockResult);
      return mockResult;
    } catch (error) {
      logger.error('Ethereum step execution failed:', error);
      throw error;
    }
  }

  async estimateGas(step: StrategyStep, context: ExecutionContext): Promise<string> {
    try {
      // Mock gas estimation - in production, use actual contract calls
      const baseGas = {
        deposit: 150000,
        stake: 200000,
        yield_farm: 300000,
        provide_liquidity: 250000,
        leverage: 400000,
        bridge: 350000
      };

      const gasEstimate = baseGas[step.action as keyof typeof baseGas] || 150000;
      return gasEstimate.toString();
    } catch (error) {
      logger.error('Gas estimation failed:', error);
      return '200000'; // Fallback gas estimate
    }
  }

  async validateStep(step: StrategyStep, context: ExecutionContext): Promise<boolean> {
    try {
      // Validate step parameters
      if (!step.protocol || !step.asset || !step.action) {
        return false;
      }

      // Check if protocol contract exists
      const contract = this.contracts.get(step.protocol.toLowerCase());
      if (!contract) {
        logger.warn(`Contract not found for protocol: ${step.protocol}`);
        return false;
      }

      // Additional validations would go here
      return true;
    } catch (error) {
      logger.error('Step validation failed:', error);
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// NEAR Executor Implementation
class NearExecutor implements ChainExecutor {
  private provider: JsonRpcProvider;
  private keyStore: InMemoryKeyStore;
  
  constructor() {
    // Modern NEAR API JS approach
    this.keyStore = new InMemoryKeyStore();
    this.provider = new JsonRpcProvider({ 
      url: process.env.NEAR_NODE_URL || 'https://rpc.testnet.near.org'
    });
    
    console.log('NEAR provider initialized for testnet');
  }

  async executeStep(step: StrategyStep, context: ExecutionContext): Promise<ExecutionResult> {
    try {
      logger.execution('Executing NEAR step', { step: step.action, protocol: step.protocol });

      // Simulate NEAR transaction execution
      await this.delay(2000);

      const mockResult: ExecutionResult = {
        stepId: `near_${Date.now()}`,
        status: 'success',
        transactionHash: `${Math.random().toString(36).substr(2, 44)}`,
        gasUsed: (Math.random() * 100 + 10).toFixed(2) + ' TGas',
        actualAmount: step.amount || '1000',
        timestamp: new Date().toISOString()
      };

      logger.execution('NEAR step executed successfully', mockResult);
      return mockResult;
    } catch (error) {
      logger.error('NEAR step execution failed:', error);
      throw error;
    }
  }

  async estimateGas(step: StrategyStep, context: ExecutionContext): Promise<string> {
    // NEAR gas is more predictable
    const baseGas = {
      deposit: '30',
      stake: '50',
      yield_farm: '80',
      provide_liquidity: '60',
      bridge: '100'
    };

    const gasEstimate = baseGas[step.action as keyof typeof baseGas] || '50';
    return `${gasEstimate} TGas`;
  }

  async validateStep(step: StrategyStep, context: ExecutionContext): Promise<boolean> {
    // Basic validation for NEAR steps
    return !!(step.protocol && step.asset && step.action);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Arbitrum Executor Implementation (similar to Ethereum but with L2 optimizations)
class ArbitrumExecutor implements ChainExecutor {
  private provider: ethers.Provider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(
      process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
    );
  }

  async executeStep(step: StrategyStep, context: ExecutionContext): Promise<ExecutionResult> {
    try {
      logger.execution('Executing Arbitrum step', { step: step.action, protocol: step.protocol });

      // Simulate Arbitrum execution (faster and cheaper than Ethereum)
      await this.delay(1500);

      const mockResult: ExecutionResult = {
        stepId: `arb_${Date.now()}`,
        status: 'success',
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        blockNumber: Math.floor(Math.random() * 1000000) + 150000000,
        gasUsed: (Math.random() * 50000 + 25000).toFixed(0), // Lower gas usage
        actualAmount: step.amount || '1000',
        timestamp: new Date().toISOString()
      };

      logger.execution('Arbitrum step executed successfully', mockResult);
      return mockResult;
    } catch (error) {
      logger.error('Arbitrum step execution failed:', error);
      throw error;
    }
  }

  async estimateGas(step: StrategyStep, context: ExecutionContext): Promise<string> {
    // Arbitrum has lower gas costs
    const ethereumGas = parseInt(await new EthereumExecutor().estimateGas(step, context));
    const arbitrumGas = Math.floor(ethereumGas * 0.1); // ~10x cheaper
    return arbitrumGas.toString();
  }

  async validateStep(step: StrategyStep, context: ExecutionContext): Promise<boolean> {
    // Use Ethereum validation logic
    return new EthereumExecutor().validateStep(step, context);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
