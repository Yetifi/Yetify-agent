# MongoDB Strategy Collection Schema

## Collection: `strategies`

### Document Structure

```json
{
  "_id": "ObjectId",
  "id": "strategy_1642680600000",
  "userId": "ObjectId",
  "version": 1,
  "goal": "Maximize yield on $10k USDC",
  "prompt": "I want to earn 15% APY on my USDC...",
  "metadata": {
    "investmentAmount": 10000,
    "currency": "USDC",
    "timeHorizon": "medium",
    "riskTolerance": "medium",
    "userExperience": "intermediate"
  },
  "chains": ["Ethereum", "NEAR"],
  "protocols": ["Aave", "Lido", "Uniswap"],
  "steps": [
    {
      "stepId": "step_1",
      "order": 1,
      "action": "deposit",
      "protocol": "Aave",
      "asset": "USDC",
      "amount": "5000",
      "expectedApy": 8.5,
      "riskScore": 3,
      "gasEstimate": "0.02 ETH",
      "dependencies": [],
      "conditions": {
        "minAmount": 1000,
        "maxSlippage": 0.5
      }
    }
  ],
  "riskLevel": "Medium",
  "status": "draft",
  "estimatedApy": 12.5,
  "estimatedTvl": "$10,000",
  "actualApy": 11.8,
  "actualTvl": 10000,
  "executionTime": "~5 minutes",
  "gasEstimate": {
    "ethereum": "0.02 ETH",
    "near": "0.1 NEAR",
    "arbitrum": "0.005 ETH"
  },
  "confidence": 85,
  "reasoning": "Strategy leverages Aave's stable lending...",
  "warnings": ["High gas costs on Ethereum"],
  "executionHistory": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "action": "deposit",
      "status": "success",
      "transactionHash": "0x123...",
      "gasUsed": "150000",
      "error": null,
      "blockNumber": 18500000
    }
  ],
  "performance": {
    "totalInvested": 10000,
    "currentValue": 10150,
    "totalReturns": 150,
    "roi": 1.5,
    "lastUpdated": "2024-01-15T10:30:00Z",
    "dailyReturns": [
      {
        "date": "2024-01-15",
        "value": 10000,
        "returns": 0
      }
    ]
  },
  "tags": ["stablecoin", "lending", "yield-farming"],
  "isPublic": false,
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Indexes

### Required Indexes

```javascript
// Compound index for user queries
db.strategies.createIndex({ "userId": 1, "status": 1, "createdAt": -1 })

// Index for strategy lookup
db.strategies.createIndex({ "id": 1 }, { unique: true })

// Index for performance queries
db.strategies.createIndex({ "performance.lastUpdated": -1 })

// Index for public strategies
db.strategies.createIndex({ "isPublic": 1, "createdAt": -1 })

// Index for protocol-based queries
db.strategies.createIndex({ "protocols": 1, "status": 1 })

// Index for chain-based queries
db.strategies.createIndex({ "chains": 1, "status": 1 })

// Text index for search
db.strategies.createIndex({ 
  "goal": "text", 
  "prompt": "text", 
  "tags": "text" 
})
```

## Query Examples

### Get user's active strategies
```javascript
db.strategies.find({
  "userId": ObjectId("..."),
  "status": "active"
}).sort({ "createdAt": -1 })
```

### Get strategies by protocol
```javascript
db.strategies.find({
  "protocols": "Aave",
  "status": { $in: ["active", "completed"] }
})
```

### Search strategies by text
```javascript
db.strategies.find({
  $text: { $search: "yield farming USDC" }
})
```

### Get performance metrics
```javascript
db.strategies.aggregate([
  { $match: { "userId": ObjectId("...") } },
  { $group: {
    _id: null,
    totalInvested: { $sum: "$performance.totalInvested" },
    totalReturns: { $sum: "$performance.totalReturns" },
    avgROI: { $avg: "$performance.roi" }
  }}
])
```

## Data Validation

### Mongoose Schema Validation
```javascript
const StrategySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, default: 1 },
  goal: { type: String, required: true, maxlength: 500 },
  prompt: { type: String, required: true, maxlength: 2000 },
  metadata: {
    investmentAmount: { type: Number, min: 0 },
    currency: { type: String, enum: ['USDC', 'USDT', 'ETH', 'NEAR'] },
    timeHorizon: { type: String, enum: ['short', 'medium', 'long'] },
    riskTolerance: { type: String, enum: ['low', 'medium', 'high'] },
    userExperience: { type: String, enum: ['beginner', 'intermediate', 'advanced'] }
  },
  chains: [{ type: String, enum: ['Ethereum', 'NEAR', 'Arbitrum', 'Polygon'] }],
  protocols: [{ type: String }],
  steps: [{
    stepId: { type: String, required: true },
    order: { type: Number, required: true },
    action: { type: String, enum: ['deposit', 'stake', 'yield_farm', 'provide_liquidity', 'leverage', 'bridge'] },
    protocol: { type: String, required: true },
    asset: { type: String, required: true },
    amount: { type: String },
    expectedApy: { type: Number, min: 0, max: 1000 },
    riskScore: { type: Number, min: 1, max: 10 },
    gasEstimate: { type: String },
    dependencies: [{ type: String }],
    conditions: {
      minAmount: { type: Number },
      maxSlippage: { type: Number }
    }
  }],
  riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
  status: { type: String, enum: ['draft', 'active', 'paused', 'completed', 'failed'], default: 'draft' },
  estimatedApy: { type: Number, required: true, min: 0, max: 1000 },
  estimatedTvl: { type: String, required: true },
  actualApy: { type: Number, min: 0, max: 1000 },
  actualTvl: { type: Number, min: 0 },
  executionTime: { type: String },
  gasEstimate: {
    ethereum: { type: String },
    near: { type: String },
    arbitrum: { type: String }
  },
  confidence: { type: Number, min: 0, max: 100 },
  reasoning: { type: String, maxlength: 1000 },
  warnings: [{ type: String }],
  executionHistory: [{
    timestamp: { type: Date, default: Date.now },
    action: { type: String },
    status: { type: String, enum: ['pending', 'success', 'failed'] },
    transactionHash: { type: String },
    gasUsed: { type: String },
    error: { type: String },
    blockNumber: { type: Number }
  }],
  performance: {
    totalInvested: { type: Number, default: 0 },
    currentValue: { type: Number, default: 0 },
    totalReturns: { type: Number, default: 0 },
    roi: { type: Number, default: 0 },
    lastUpdated: { type: Date },
    dailyReturns: [{
      date: { type: String },
      value: { type: Number },
      returns: { type: Number }
    }]
  },
  tags: [{ type: String }],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'strategies'
});
```

## Best Practices

1. **Use ObjectId for references**: Always use ObjectId for `userId` references
2. **Index frequently queried fields**: Create compound indexes for common query patterns
3. **Validate data**: Use Mongoose validation and Joi schemas
4. **Handle large arrays**: Consider pagination for `executionHistory` and `dailyReturns`
5. **Use text search**: Implement full-text search for strategy discovery
6. **Version control**: Add version field for strategy updates
7. **Soft deletes**: Consider adding `deletedAt` field instead of hard deletes
8. **Archive old data**: Move completed strategies to archive collection after 1 year

## Migration Considerations

When updating the schema:
1. Always add new fields as optional initially
2. Use database migrations for required field additions
3. Consider data transformation for field type changes
4. Test with production-like data volumes
