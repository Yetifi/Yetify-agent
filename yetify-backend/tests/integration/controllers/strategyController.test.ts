import request from 'supertest';
import express from 'express';
import { Strategy, User } from '../../../src/utils/database';
import strategyController from '../../../src/controllers/strategyController';
import { authMiddleware } from '../../../src/middleware/auth';
import { testUtils } from '../../setup';

// Mock the AI strategy engine
jest.mock('../../../src/ai-engine/StrategyEngine', () => ({
  StrategyEngine: jest.fn().mockImplementation(() => ({
    generateStrategy: jest.fn().mockResolvedValue(testUtils.createTestStrategy()),
    storeStrategyKnowledge: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('Strategy Controller Integration Tests', () => {
  let app: express.Application;
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    // Setup Express app with middleware
    app = express();
    app.use(express.json());
    
    // Mock auth middleware for testing
    app.use('/api/v1/strategies', (req: any, res, next) => {
      req.user = {
        id: testUser._id.toString(),
        walletAddress: testUser.walletAddress,
        walletType: testUser.walletType
      };
      next();
    });
    
    app.use('/api/v1/strategies', strategyController);

    // Create test user
    const userData = testUtils.createTestUser();
    testUser = await User.create(userData);
    authToken = testUtils.generateTestToken({
      userId: testUser._id.toString(),
      walletAddress: testUser.walletAddress,
      walletType: testUser.walletType
    });
  });

  describe('GET /api/v1/strategies', () => {
    it('should return user strategies', async () => {
      // Create test strategies
      const strategy1 = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'test_strategy_1'
      });

      const strategy2 = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'test_strategy_2',
        status: 'active'
      });

      const response = await request(app)
        .get('/api/v1/strategies')
        .expect(200);

      expect(response.body.strategies).toHaveLength(2);
      expect(response.body.strategies[0].id).toBe('test_strategy_2'); // Should be sorted by createdAt desc
      expect(response.body.strategies[1].id).toBe('test_strategy_1');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter strategies by status', async () => {
      await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'active_strategy',
        status: 'active'
      });

      await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'draft_strategy',
        status: 'draft'
      });

      const response = await request(app)
        .get('/api/v1/strategies?status=active')
        .expect(200);

      expect(response.body.strategies).toHaveLength(1);
      expect(response.body.strategies[0].status).toBe('active');
    });

    it('should implement pagination', async () => {
      // Create multiple strategies
      for (let i = 0; i < 5; i++) {
        await Strategy.create({
          ...testUtils.createTestStrategy(),
          userId: testUser._id,
          id: `test_strategy_${i}`
        });
      }

      const response = await request(app)
        .get('/api/v1/strategies?limit=2&offset=1')
        .expect(200);

      expect(response.body.strategies).toHaveLength(2);
      expect(response.body.pagination.total).toBe(5);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.offset).toBe(1);
      expect(response.body.pagination.hasMore).toBe(true);
    });
  });

  describe('GET /api/v1/strategies/:id', () => {
    it('should return specific strategy', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'specific_strategy'
      });

      const response = await request(app)
        .get('/api/v1/strategies/specific_strategy')
        .expect(200);

      expect(response.body.strategy).toBeDefined();
      expect(response.body.strategy.id).toBe('specific_strategy');
      expect(response.body.strategy.goal).toBe(strategy.goal);
    });

    it('should return 404 for non-existent strategy', async () => {
      const response = await request(app)
        .get('/api/v1/strategies/non_existent_strategy')
        .expect(404);

      expect(response.body.error).toBe('Strategy not found');
    });

    it('should deny access to other users strategies', async () => {
      // Create another user and their strategy
      const otherUser = await User.create({
        ...testUtils.createTestUser(),
        walletAddress: '0x123456789abcdef123456789abcdef123456789a'
      });

      await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: otherUser._id,
        id: 'other_user_strategy'
      });

      const response = await request(app)
        .get('/api/v1/strategies/other_user_strategy')
        .expect(404);

      expect(response.body.error).toBe('Strategy not found');
    });
  });

  describe('POST /api/v1/strategies/generate', () => {
    it('should generate new strategy', async () => {
      const strategyInput = {
        prompt: 'Maximize my ETH yield with low risk',
        riskTolerance: 'low',
        investmentAmount: 5000,
        preferredChains: ['Ethereum'],
        timeHorizon: 'long'
      };

      const response = await request(app)
        .post('/api/v1/strategies/generate')
        .send(strategyInput)
        .expect(201);

      expect(response.body.strategy).toBeDefined();
      expect(response.body.strategy.prompt).toBe(strategyInput.prompt);
      expect(response.body.strategy.status).toBe('draft');
      expect(response.body.message).toBe('Strategy generated successfully');

      // Verify strategy was saved to database
      const savedStrategy = await Strategy.findOne({ id: response.body.strategy.id });
      expect(savedStrategy).toBeTruthy();
      expect(savedStrategy?.userId.toString()).toBe(testUser._id.toString());
    });

    it('should validate input parameters', async () => {
      const invalidInput = {
        prompt: 'x', // Too short
        riskTolerance: 'invalid', // Invalid value
        investmentAmount: 50 // Too low
      };

      const response = await request(app)
        .post('/api/v1/strategies/generate')
        .send(invalidInput)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeInstanceOf(Array);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/generate')
        .send({}) // Empty body
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toContain('"prompt" is required');
    });
  });

  describe('PUT /api/v1/strategies/:id', () => {
    it('should update strategy', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'updateable_strategy'
      });

      const updateData = {
        goal: 'Updated strategy goal',
        status: 'active'
      };

      const response = await request(app)
        .put('/api/v1/strategies/updateable_strategy')
        .send(updateData)
        .expect(200);

      expect(response.body.strategy.goal).toBe(updateData.goal);
      expect(response.body.strategy.status).toBe(updateData.status);
      expect(response.body.message).toBe('Strategy updated successfully');

      // Verify update in database
      const updatedStrategy = await Strategy.findOne({ id: 'updateable_strategy' });
      expect(updatedStrategy?.goal).toBe(updateData.goal);
      expect(updatedStrategy?.status).toBe(updateData.status);
    });

    it('should validate update data', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'validation_test_strategy'
      });

      const invalidUpdate = {
        status: 'invalid_status'
      };

      const response = await request(app)
        .put('/api/v1/strategies/validation_test_strategy')
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/v1/strategies/:id/activate', () => {
    it('should activate strategy', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'activatable_strategy',
        status: 'draft'
      });

      const response = await request(app)
        .post('/api/v1/strategies/activatable_strategy/activate')
        .expect(200);

      expect(response.body.strategy.status).toBe('active');
      expect(response.body.message).toBe('Strategy activated successfully');

      // Verify in database
      const activatedStrategy = await Strategy.findOne({ id: 'activatable_strategy' });
      expect(activatedStrategy?.status).toBe('active');
    });
  });

  describe('POST /api/v1/strategies/:id/pause', () => {
    it('should pause strategy', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'pausable_strategy',
        status: 'active'
      });

      const response = await request(app)
        .post('/api/v1/strategies/pausable_strategy/pause')
        .expect(200);

      expect(response.body.strategy.status).toBe('paused');
      expect(response.body.message).toBe('Strategy paused successfully');
    });
  });

  describe('DELETE /api/v1/strategies/:id', () => {
    it('should delete strategy', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'deletable_strategy'
      });

      const response = await request(app)
        .delete('/api/v1/strategies/deletable_strategy')
        .expect(200);

      expect(response.body.message).toBe('Strategy deleted successfully');

      // Verify deletion in database
      const deletedStrategy = await Strategy.findOne({ id: 'deletable_strategy' });
      expect(deletedStrategy).toBeNull();
    });

    it('should not delete non-existent strategy', async () => {
      const response = await request(app)
        .delete('/api/v1/strategies/non_existent')
        .expect(404);

      expect(response.body.error).toBe('Strategy not found');
    });
  });

  describe('POST /api/v1/strategies/:id/feedback', () => {
    it('should accept positive feedback', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'feedback_strategy'
      });

      const feedbackData = {
        feedback: 'positive',
        rating: 5,
        comments: 'Great strategy!'
      };

      const response = await request(app)
        .post('/api/v1/strategies/feedback_strategy/feedback')
        .send(feedbackData)
        .expect(200);

      expect(response.body.message).toBe('Feedback recorded successfully');
    });

    it('should accept negative feedback', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'negative_feedback_strategy'
      });

      const feedbackData = {
        feedback: 'negative',
        rating: 2,
        comments: 'Could be improved'
      };

      const response = await request(app)
        .post('/api/v1/strategies/negative_feedback_strategy/feedback')
        .send(feedbackData)
        .expect(200);

      expect(response.body.message).toBe('Feedback recorded successfully');
    });

    it('should validate feedback data', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'invalid_feedback_strategy'
      });

      const invalidFeedback = {
        feedback: 'invalid_type'
      };

      const response = await request(app)
        .post('/api/v1/strategies/invalid_feedback_strategy/feedback')
        .send(invalidFeedback)
        .expect(400);

      expect(response.body.error).toBe('Invalid feedback');
    });
  });

  describe('GET /api/v1/strategies/:id/performance', () => {
    it('should return strategy performance data', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'performance_strategy',
        performance: {
          totalInvested: 1000,
          currentValue: 1050,
          totalReturns: 50,
          roi: 5.0,
          lastUpdated: new Date()
        }
      });

      const response = await request(app)
        .get('/api/v1/strategies/performance_strategy/performance')
        .expect(200);

      expect(response.body.performance).toBeDefined();
      expect(response.body.performance.totalInvested).toBe(1000);
      expect(response.body.performance.currentValue).toBe(1050);
      expect(response.body.performance.roi).toBe(5.0);
    });

    it('should return default performance data for new strategies', async () => {
      const strategy = await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'new_strategy'
      });

      const response = await request(app)
        .get('/api/v1/strategies/new_strategy/performance')
        .expect(200);

      expect(response.body.performance).toBeDefined();
      expect(response.body.performance.totalInvested).toBe(0);
      expect(response.body.performance.currentValue).toBe(0);
      expect(response.body.performance.roi).toBe(0);
    });
  });

  describe('GET /api/v1/strategies/analytics/summary', () => {
    it('should return user analytics summary', async () => {
      // Create multiple strategies with different statuses
      await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'active_1',
        status: 'active',
        riskLevel: 'Low',
        performance: { totalInvested: 1000, totalReturns: 100, roi: 10 }
      });

      await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'paused_1',
        status: 'paused',
        riskLevel: 'Medium',
        performance: { totalInvested: 2000, totalReturns: 150, roi: 7.5 }
      });

      await Strategy.create({
        ...testUtils.createTestStrategy(),
        userId: testUser._id,
        id: 'completed_1',
        status: 'completed',
        riskLevel: 'High',
        performance: { totalInvested: 500, totalReturns: 200, roi: 40 }
      });

      const response = await request(app)
        .get('/api/v1/strategies/analytics/summary')
        .expect(200);

      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalStrategies).toBe(3);
      expect(response.body.summary.activeStrategies).toBe(1);
      expect(response.body.summary.pausedStrategies).toBe(1);
      expect(response.body.summary.completedStrategies).toBe(1);
      expect(response.body.summary.totalInvested).toBe(3500);
      expect(response.body.summary.totalReturns).toBe(450);
      expect(response.body.summary.riskDistribution).toEqual({
        low: 1,
        medium: 1,
        high: 1
      });
    });
  });
});
