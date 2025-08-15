import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  scalar Date
  scalar JSON

  type Query {
    # Strategy queries
    getStrategy(id: ID!): Strategy
    getUserStrategies(userId: ID!): [Strategy!]!
    getActiveStrategies: [Strategy!]!
    
    # Market data queries
    getMarketSummary: MarketSummary!
    getTokenPrices(symbols: [String!]!): [TokenPrice!]!
    getProtocols(chain: String, category: String): [Protocol!]!
    getGasPrices: GasPrices!
    
    # Monitoring queries
    getStrategyPerformance(strategyId: ID!): PerformanceMetrics
    getActiveAlerts(userId: ID!): [RiskAlert!]!
    getRebalanceRecommendations(userId: ID!): [RebalanceRecommendation!]!
    
    # User queries
    getUser(walletAddress: String!): User
    getUserProfile(id: ID!): User
  }

  type Mutation {
    # Strategy mutations
    generateStrategy(input: StrategyInput!): StrategyGenerationResult!
    executeStrategy(input: ExecutionInput!): ExecutionResult!
    updateStrategy(id: ID!, input: StrategyUpdateInput!): Strategy!
    pauseStrategy(id: ID!): Strategy!
    resumeStrategy(id: ID!): Strategy!
    deleteStrategy(id: ID!): Boolean!
    
    # User mutations
    createUser(input: UserInput!): User!
    updateUserPreferences(userId: ID!, preferences: UserPreferencesInput!): User!
    
    # Alert mutations
    acknowledgeAlert(alertId: ID!): RiskAlert!
    executeRebalance(recommendationId: ID!): ExecutionResult!
  }

  type Subscription {
    strategyUpdated(strategyId: ID!): Strategy!
    newAlert(userId: ID!): RiskAlert!
    priceUpdated(symbols: [String!]!): [TokenPrice!]!
    executionProgress(strategyId: ID!): ExecutionProgress!
  }

  # Core Types
  type Strategy {
    id: ID!
    userId: ID!
    goal: String!
    prompt: String!
    chains: [String!]!
    protocols: [String!]!
    steps: [StrategyStep!]!
    riskLevel: RiskLevel!
    status: StrategyStatus!
    estimatedApy: Float!
    estimatedTvl: String!
    actualApy: Float
    actualTvl: Float
    executionTime: String!
    gasEstimate: GasEstimate!
    confidence: Float!
    reasoning: String!
    warnings: [String!]!
    executionHistory: [ExecutionHistoryItem!]!
    performance: StrategyPerformance
    createdAt: Date!
    updatedAt: Date!
  }

  type StrategyStep {
    action: StrategyAction!
    protocol: String!
    asset: String!
    amount: String
    expectedApy: Float
    riskScore: Float
    gasEstimate: String
    dependencies: [String!]
  }

  type User {
    id: ID!
    walletAddress: String!
    walletType: WalletType!
    preferences: UserPreferences!
    strategies: [Strategy!]!
    createdAt: Date!
    lastActive: Date!
    totalInvested: Float!
    totalReturns: Float!
  }

  type UserPreferences {
    riskTolerance: RiskLevel!
    preferredChains: [String!]!
    notificationsEnabled: Boolean!
    autoRebalancing: Boolean!
  }

  type Protocol {
    id: ID!
    name: String!
    chain: String!
    category: ProtocolCategory!
    tvl: Float!
    apy: Float!
    riskScore: Float!
    url: String
    description: String
    tokens: [String!]!
    auditStatus: AuditStatus!
    isActive: Boolean!
    lastUpdated: Date!
  }

  type MarketSummary {
    totalTVL: Float!
    averageAPY: Float!
    topPerformingProtocols: [APYData!]!
    marketTrends: MarketTrends!
    lastUpdated: Date!
  }

  type MarketTrends {
    tvlTrend: TrendDirection!
    apyTrend: TrendDirection!
    riskSentiment: RiskSentiment!
  }

  type APYData {
    protocol: String!
    asset: String!
    apy: Float!
    tvl: Float!
    chain: String!
    risk: RiskLevel!
    category: String!
    lastUpdated: Date!
  }

  type TokenPrice {
    symbol: String!
    price: Float!
    change24h: Float!
    volume24h: Float!
    marketCap: Float!
    lastUpdated: Date!
  }

  type GasPrices {
    ethereum: Float!
    near: Float!
    arbitrum: Float!
    polygon: Float!
    optimism: Float!
  }

  type PerformanceMetrics {
    strategyId: ID!
    totalInvested: Float!
    currentValue: Float!
    totalReturns: Float!
    roi: Float!
    realizedAPY: Float!
    unrealizedGains: Float!
    lastUpdated: Date!
  }

  type StrategyPerformance {
    totalInvested: Float!
    currentValue: Float!
    totalReturns: Float!
    roi: Float!
    lastUpdated: Date
  }

  type RiskAlert {
    id: ID!
    strategyId: ID!
    type: AlertType!
    severity: AlertSeverity!
    message: String!
    recommendations: [String!]!
    timestamp: Date!
    acknowledged: Boolean!
  }

  type RebalanceRecommendation {
    strategyId: ID!
    reason: String!
    confidence: Float!
    estimatedGain: Float!
    actions: [RebalanceAction!]!
    timestamp: Date!
  }

  type RebalanceAction {
    type: ActionType!
    fromProtocol: String
    toProtocol: String
    asset: String!
    amount: Float!
    expectedImpact: String!
  }

  type ExecutionHistoryItem {
    timestamp: Date!
    action: String!
    status: ExecutionStatus!
    transactionHash: String
    gasUsed: String
    error: String
  }

  type GasEstimate {
    ethereum: String!
    near: String!
    arbitrum: String!
  }

  type StrategyGenerationResult {
    strategy: Strategy!
    confidence: Float!
    alternatives: [Strategy!]
    estimatedGas: GasEstimate!
  }

  type ExecutionResult {
    success: Boolean!
    strategyId: ID!
    executedSteps: [StepExecutionResult!]!
    totalGasUsed: String!
    totalCost: String!
    estimatedCompletionTime: String!
    error: String
  }

  type StepExecutionResult {
    stepId: String!
    status: ExecutionStatus!
    transactionHash: String
    blockNumber: Int
    gasUsed: String
    actualAmount: String
    error: String
    timestamp: Date!
  }

  type ExecutionProgress {
    strategyId: ID!
    currentStep: Int!
    totalSteps: Int!
    status: ExecutionStatus!
    estimatedTimeRemaining: String!
    message: String!
  }

  # Input Types
  input StrategyInput {
    prompt: String!
    userAddress: String!
    riskTolerance: RiskLevel
    investmentAmount: Float
    preferredChains: [String!]
    timeHorizon: TimeHorizon
  }

  input ExecutionInput {
    strategyId: ID!
    userAddress: String!
    investmentAmount: Float!
    slippageTolerance: Float!
    gasPreference: GasPreference!
  }

  input StrategyUpdateInput {
    goal: String
    steps: [StrategyStepInput!]
    riskLevel: RiskLevel
    status: StrategyStatus
  }

  input StrategyStepInput {
    action: StrategyAction!
    protocol: String!
    asset: String!
    amount: String
    expectedApy: Float
  }

  input UserInput {
    walletAddress: String!
    walletType: WalletType!
    preferences: UserPreferencesInput
  }

  input UserPreferencesInput {
    riskTolerance: RiskLevel
    preferredChains: [String!]
    notificationsEnabled: Boolean
    autoRebalancing: Boolean
  }

  # Enums
  enum WalletType {
    METAMASK
    NEAR
    WALLETCONNECT
  }

  enum RiskLevel {
    LOW
    MEDIUM
    HIGH
  }

  enum StrategyStatus {
    DRAFT
    ACTIVE
    PAUSED
    COMPLETED
    FAILED
  }

  enum StrategyAction {
    DEPOSIT
    STAKE
    YIELD_FARM
    PROVIDE_LIQUIDITY
    LEVERAGE
    BRIDGE
  }

  enum ProtocolCategory {
    LENDING
    DEX
    YIELD_FARMING
    STAKING
    DERIVATIVES
  }

  enum AuditStatus {
    AUDITED
    UNAUDITED
    PARTIALLY_AUDITED
  }

  enum TrendDirection {
    UP
    DOWN
    STABLE
  }

  enum RiskSentiment {
    BULLISH
    BEARISH
    NEUTRAL
  }

  enum AlertType {
    PRICE_DROP
    APY_DECLINE
    PROTOCOL_RISK
    IMPERMANENT_LOSS
    LIQUIDATION_RISK
  }

  enum AlertSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum ActionType {
    WITHDRAW
    DEPOSIT
    SWAP
    REBALANCE
  }

  enum ExecutionStatus {
    PENDING
    SUCCESS
    FAILED
  }

  enum TimeHorizon {
    SHORT
    MEDIUM
    LONG
  }

  enum GasPreference {
    SLOW
    STANDARD
    FAST
  }
`;
