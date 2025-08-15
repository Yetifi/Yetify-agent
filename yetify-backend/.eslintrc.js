module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended'
  ],
  root: true,
  env: {
    node: true,
    jest: true,
    es6: true,
  },
  ignorePatterns: [
    '.eslintrc.js', 
    'dist/', 
    'coverage/', 
    'node_modules/',
    'src/controllers/executionController.ts',
    'src/controllers/strategyController.ts', 
    'src/graphql/resolvers/index.ts',
    'src/ai-engine/StrategyEngine.ts',
    'src/middleware/auth.ts',
    'src/index.ts',
    'src/execution-layer/ExecutionEngine.ts',
    'src/monitoring/MonitoringEngine.ts',
    'src/services/MarketDataService.ts',
    'src/services/ProtocolDataService.ts'
  ],
  rules: {
    // TypeScript-specific rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // General rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'no-unused-expressions': 'error',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
      env: {
        jest: true,
      },
      rules: {
        // Relax some rules for test files
        'no-console': 'off'
      },
    },
    {
      files: ['scripts/**/*.ts', 'scripts/**/*.js'],
      rules: {
        // Allow console in scripts
        'no-console': 'off',
      },
    },
  ],
};
