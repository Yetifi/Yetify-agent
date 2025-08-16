import { createLogger } from '../../../src/utils/logger';

describe('Logger', () => {
  it('should create logger instance', () => {
    const logger = createLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.strategy).toBe('function');
    expect(typeof logger.ai).toBe('function');
  });

  it('should have custom methods', () => {
    const logger = createLogger();
    expect(typeof logger.strategy).toBe('function');
    expect(typeof logger.ai).toBe('function');
    expect(typeof logger.execution).toBe('function');
    expect(typeof logger.monitoring).toBe('function');
  });
});