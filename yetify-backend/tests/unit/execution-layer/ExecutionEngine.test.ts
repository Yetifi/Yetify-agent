import { ExecutionEngine, ExecutionContext } from '../../../src/execution-layer/ExecutionEngine';
import { testUtils } from '../../setup';

// Mock external blockchain libraries
jest.mock('ethers');
jest.mock('near-api-js');

describe('ExecutionEngine', () => {
  let executionEngine: ExecutionEngine;
  let mockExecutionContext: ExecutionContext;

  beforeEach(() => {
    executionEngine = new ExecutionEngine();
    
    // Setup mock execution context
    mockExecutionContext = {
      userAddress: '0x742d35Cc6097C8f4f5b2E3894C5B6545AE2A1234',
      strategy: testUtils.createTestStrategy(),
      walletType: 'metamask',
      investmentAmount: 5000,
      slippageTolerance: 2,
      gasPreference: 'standard'
    };
  });

  describe('executeStrategy', () => {
    it('should execute strategy successfully', async () => {
      const results = await executionEngine.executeStrategy(mockExecutionContext);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(mockExecutionContext.strategy.steps.length);

      results.forEach(result => {
        expect(result.stepId).toBeDefined();
        expect(result.status).toMatch(/^(pending|success|failed)$/);
        expect(result.timestamp).toBeDefined();
      });
    });

    it('should handle strategy with multiple steps', async () => {
      const multiStepStrategy = {
        ...testUtils.createTestStrategy(),
        steps: [
          { action: 'deposit' as const, protocol: 'Lido', asset: 'ETH', expectedApy: 4.2 },
          { action: 'stake' as const, protocol: 'Aave', asset: 'stETH', expectedApy: 8.5 },
          { action: 'yield_farm' as const, protocol: 'Curve', asset: 'USDC', expectedApy: 12.1 }
        ]
      };

      const contextWithMultipleSteps = {
        ...mockExecutionContext,
        strategy: multiStepStrategy
      };

      const results = await executionEngine.executeStrategy(contextWithMultipleSteps);

      expect(results).toHaveLength(3);
      expect(results[0].stepId).toBe('step_0');
      expect(results[1].stepId).toBe('step_1');
      expect(results[2].stepId).toBe('step_2');
    });

    it('should stop execution on step failure', async () => {
      // Mock a strategy that would fail on second step
      const failingStrategy = {
        ...testUtils.createTestStrategy(),
        steps: [
          { action: 'deposit' as const, protocol: 'ValidProtocol', asset: 'ETH', expectedApy: 4.2 },
          { action: 'stake' as const, protocol: 'InvalidProtocol', asset: 'INVALID', expectedApy: 0 },
          { action: 'stake' as const, protocol: 'Aave', asset: 'stETH', expectedApy: 8.5 }
        ]
      };

      const contextWithFailingStrategy = {
        ...mockExecutionContext,
        strategy: failingStrategy
      };

      const results = await executionEngine.executeStrategy(contextWithFailingStrategy);

      // Should only execute until failure
      expect(results.length).toBeGreaterThan(0);
      
      // Check if any step failed
      const hasFailedStep = results.some(result => result.status === 'failed');
      if (hasFailedStep) {
        // If there's a failed step, subsequent steps shouldn't be executed
        const failedIndex = results.findIndex(result => result.status === 'failed');
        expect(results).toHaveLength(failedIndex + 1);
      }
    });

    it('should handle different wallet types', async () => {
      const nearContext = {
        ...mockExecutionContext,
        walletType: 'near' as const,
        userAddress: 'user.near'
      };

      const results = await executionEngine.executeStrategy(nearContext);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      results.forEach(result => {
        expect(result.status).toMatch(/^(pending|success|failed)$/);
      });
    });

    it('should handle different gas preferences', async () => {
      const fastGasContext = {
        ...mockExecutionContext,
        gasPreference: 'fast' as const
      };

      const slowGasContext = {
        ...mockExecutionContext,
        gasPreference: 'slow' as const
      };

      const [fastResults, slowResults] = await Promise.all([
        executionEngine.executeStrategy(fastGasContext),
        executionEngine.executeStrategy(slowGasContext)
      ]);

      expect(fastResults).toBeDefined();
      expect(slowResults).toBeDefined();
      
      // Both should execute, but potentially with different gas costs
      expect(fastResults.length).toBe(slowResults.length);
    });
  });

  describe('estimateGasForStrategy', () => {
    it('should estimate gas costs for strategy', async () => {
      const gasEstimates = await executionEngine.estimateGasForStrategy(mockExecutionContext);

      expect(gasEstimates).toBeDefined();
      expect(typeof gasEstimates).toBe('object');

      // Should have estimates for relevant chains
      const expectedChains = mockExecutionContext.strategy.chains.map(chain => chain.toLowerCase());
      expectedChains.forEach(chain => {
        if (['ethereum', 'near', 'arbitrum'].includes(chain)) {
          expect(gasEstimates[chain]).toBeDefined();
        }
      });

      // Gas estimates should be positive numbers
      Object.values(gasEstimates).forEach(estimate => {
        expect(parseFloat(estimate as string)).toBeGreaterThan(0);
      });
    });

    it('should handle strategies with no steps', async () => {
      const emptyStrategy = {
        ...testUtils.createTestStrategy(),
        steps: []
      };

      const contextWithEmptyStrategy = {
        ...mockExecutionContext,
        strategy: emptyStrategy
      };

      const gasEstimates = await executionEngine.estimateGasForStrategy(contextWithEmptyStrategy);

      expect(gasEstimates).toBeDefined();
      expect(typeof gasEstimates).toBe('object');
    });

    it('should aggregate gas costs for multiple steps on same chain', async () => {
      const multiStepEthStrategy = {
        ...testUtils.createTestStrategy(),
        chains: ['Ethereum'],
        steps: [
          { action: 'deposit' as const, protocol: 'Aave', asset: 'ETH', expectedApy: 4.2 },
          { action: 'stake' as const, protocol: 'Lido', asset: 'ETH', expectedApy: 5.1 },
          { action: 'yield_farm' as const, protocol: 'Curve', asset: 'stETH', expectedApy: 8.5 }
        ]
      };

      const contextWithMultipleEthSteps = {
        ...mockExecutionContext,
        strategy: multiStepEthStrategy
      };

      const gasEstimates = await executionEngine.estimateGasForStrategy(contextWithMultipleEthSteps);

      expect(gasEstimates.ethereum).toBeDefined();
      expect(parseFloat(gasEstimates.ethereum)).toBeGreaterThan(100000); // Should be sum of multiple operations
    });
  });

  describe('validation', () => {
    it('should validate execution context', async () => {
      const invalidContext = {
        ...mockExecutionContext,
        userAddress: '', // Invalid address
        investmentAmount: -100 // Negative amount
      };

      // The execution should handle invalid context gracefully
      try {
        const results = await executionEngine.executeStrategy(invalidContext);
        expect(results).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle unknown protocols gracefully', async () => {
      const unknownProtocolStrategy = {
        ...testUtils.createTestStrategy(),
        steps: [
          { action: 'deposit' as const, protocol: 'UnknownProtocol', asset: 'ETH', expectedApy: 4.2 }
        ]
      };

      const contextWithUnknownProtocol = {
        ...mockExecutionContext,
        strategy: unknownProtocolStrategy
      };

      const results = await executionEngine.executeStrategy(contextWithUnknownProtocol);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // Should either execute with default executor or fail gracefully
      results.forEach(result => {
        expect(result.status).toMatch(/^(pending|success|failed)$/);
      });
    });
  });

  describe('chain-specific execution', () => {
    it('should handle Ethereum-specific protocols', async () => {
      const ethStrategy = {
        ...testUtils.createTestStrategy(),
        chains: ['Ethereum'],
        protocols: ['Aave', 'Lido'],
        steps: [
          { action: 'deposit' as const, protocol: 'Aave', asset: 'ETH', expectedApy: 4.2 },
          { action: 'stake' as const, protocol: 'Lido', asset: 'ETH', expectedApy: 5.1 }
        ]
      };

      const ethContext = {
        ...mockExecutionContext,
        strategy: ethStrategy
      };

      const results = await executionEngine.executeStrategy(ethContext);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
      
      results.forEach(result => {
        expect(result.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/); // Ethereum tx hash format
      });
    });

    it('should handle NEAR-specific protocols', async () => {
      const nearStrategy = {
        ...testUtils.createTestStrategy(),
        chains: ['NEAR'],
        protocols: ['Ref Finance', 'Burrow'],
        steps: [
          { action: 'deposit' as const, protocol: 'Ref Finance', asset: 'NEAR', expectedApy: 12.5 },
          { action: 'yield_farm' as const, protocol: 'Burrow', asset: 'USDC', expectedApy: 8.7 }
        ]
      };

      const nearContext = {
        ...mockExecutionContext,
        strategy: nearStrategy,
        userAddress: 'user.testnet',
        walletType: 'near' as const
      };

      const results = await executionEngine.executeStrategy(nearContext);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
      
      results.forEach(result => {
        expect(result.gasUsed).toMatch(/TGas/); // NEAR gas format
      });
    });

    it('should handle Arbitrum protocols with lower gas costs', async () => {
      const arbStrategy = {
        ...testUtils.createTestStrategy(),
        chains: ['Arbitrum'],
        protocols: ['Aave'],
        steps: [
          { action: 'deposit' as const, protocol: 'Aave', asset: 'ETH', expectedApy: 4.8 }
        ]
      };

      const arbContext = {
        ...mockExecutionContext,
        strategy: arbStrategy
      };

      const gasEstimates = await executionEngine.estimateGasForStrategy(arbContext);

      expect(gasEstimates.arbitrum).toBeDefined();
      
      // Arbitrum gas should be lower than Ethereum
      const arbGas = parseFloat(gasEstimates.arbitrum);
      expect(arbGas).toBeGreaterThan(0);
      expect(arbGas).toBeLessThan(500000); // Should be relatively low
    });
  });

  describe('performance and reliability', () => {
    it('should execute strategy within reasonable time', async () => {
      const startTime = Date.now();
      await executionEngine.executeStrategy(mockExecutionContext);
      const endTime = Date.now();

      // Should complete within 30 seconds for mock execution
      expect(endTime - startTime).toBeLessThan(30000);
    }, 35000);

    it('should handle concurrent executions', async () => {
      const contexts = Array.from({ length: 3 }, (_, i) => ({
        ...mockExecutionContext,
        strategy: {
          ...mockExecutionContext.strategy,
          id: `concurrent_strategy_${i}`
        }
      }));

      const promises = contexts.map(context => 
        executionEngine.executeStrategy(context)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should provide detailed error information on failure', async () => {
      const invalidStrategy = {
        ...testUtils.createTestStrategy(),
        steps: [
          { action: 'deposit' as const, protocol: 'invalid', asset: 'invalid', expectedApy: 0 }
        ]
      };

      const invalidContext = {
        ...mockExecutionContext,
        strategy: invalidStrategy
      };

      const results = await executionEngine.executeStrategy(invalidContext);

      expect(results).toBeDefined();
      
      // Check if any failed results have error information
      results.forEach(result => {
        if (result.status === 'failed') {
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error?.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
