# MongoDB Operations Guide for Yetify Strategies

## Collection: `strategies`

This guide provides comprehensive examples of MongoDB operations for managing user strategies in Yetify.

## Basic CRUD Operations

### Create Strategy
```javascript
// Insert a new strategy
const newStrategy = {
  id: `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  userId: ObjectId("507f1f77bcf86cd799439012"),
  version: 1,
  goal: "Maximize yield on $5,000 USDC",
  prompt: "I want to earn 10% APY on my USDC...",
  metadata: {
    investmentAmount: 5000,
    currency: "USDC",
    timeHorizon: "medium",
    riskTolerance: "low",
    userExperience: "beginner"
  },
  chains: ["Ethereum"],
  protocols: ["Aave"],
  steps: [/* strategy steps */],
  riskLevel: "Low",
  status: "draft",
  estimatedApy: 8.5,
  estimatedTvl: "$5,000",
  confidence: 90,
  reasoning: "Conservative strategy using Aave lending",
  warnings: [],
  performance: {
    totalInvested: 0,
    currentValue: 0,
    totalReturns: 0,
    roi: 0,
    lastUpdated: new Date()
  },
  tags: ["stablecoin", "lending"],
  isPublic: false
};

db.strategies.insertOne(newStrategy);
```

### Read Strategies

#### Get User's Strategies
```javascript
// Get all strategies for a user
db.strategies.find({ userId: ObjectId("507f1f77bcf86cd799439012") });

// Get active strategies only
db.strategies.find({ 
  userId: ObjectId("507f1f77bcf86cd799439012"),
  status: "active"
});

// Get strategies with pagination
db.strategies.find({ userId: ObjectId("507f1f77bcf86cd799439012") })
  .sort({ createdAt: -1 })
  .skip(0)
  .limit(10);
```

#### Get Strategy by ID
```javascript
db.strategies.findOne({ id: "strategy_1704067200000_abc123def" });
```

#### Search Strategies
```javascript
// Text search
db.strategies.find({ 
  $text: { $search: "yield farming USDC" } 
});

// Filter by protocol
db.strategies.find({ 
  protocols: "Aave",
  status: { $in: ["active", "completed"] }
});

// Filter by risk level
db.strategies.find({ 
  riskLevel: "Low",
  "metadata.riskTolerance": "low"
});

// Filter by investment amount range
db.strategies.find({
  "metadata.investmentAmount": { $gte: 1000, $lte: 10000 }
});
```

### Update Strategy

#### Update Strategy Status
```javascript
db.strategies.updateOne(
  { id: "strategy_1704067200000_abc123def" },
  { 
    $set: { 
      status: "active",
      updatedAt: new Date()
    }
  }
);
```

#### Update Performance Data
```javascript
db.strategies.updateOne(
  { id: "strategy_1704067200000_abc123def" },
  { 
    $set: { 
      "performance.currentValue": 10200,
      "performance.totalReturns": 200,
      "performance.roi": 2.0,
      "performance.lastUpdated": new Date()
    }
  }
);
```

#### Add Execution History Entry
```javascript
db.strategies.updateOne(
  { id: "strategy_1704067200000_abc123def" },
  { 
    $push: { 
      executionHistory: {
        timestamp: new Date(),
        action: "withdraw",
        status: "success",
        transactionHash: "0x...",
        gasUsed: "100000",
        error: null,
        blockNumber: 18500100,
        stepId: "step_1"
      }
    }
  }
);
```

#### Update Daily Returns
```javascript
db.strategies.updateOne(
  { id: "strategy_1704067200000_abc123def" },
  { 
    $push: { 
      "performance.dailyReturns": {
        date: "2024-01-17",
        value: 10200,
        returns: 200
      }
    }
  }
);
```

### Delete Strategy

#### Soft Delete (Recommended)
```javascript
db.strategies.updateOne(
  { id: "strategy_1704067200000_abc123def" },
  { 
    $set: { 
      deletedAt: new Date(),
      status: "cancelled"
    }
  }
);
```

#### Hard Delete (Use with caution)
```javascript
db.strategies.deleteOne({ id: "strategy_1704067200000_abc123def" });
```

## Advanced Queries

### Aggregation Pipelines

#### Get User Portfolio Summary
```javascript
db.strategies.aggregate([
  { $match: { 
    userId: ObjectId("507f1f77bcf86cd799439012"),
    status: { $in: ["active", "completed"] },
    deletedAt: null
  }},
  { $group: {
    _id: null,
    totalStrategies: { $sum: 1 },
    totalInvested: { $sum: "$performance.totalInvested" },
    totalValue: { $sum: "$performance.currentValue" },
    totalReturns: { $sum: "$performance.totalReturns" },
    averageROI: { $avg: "$performance.roi" },
    averageAPY: { $avg: "$estimatedApy" }
  }}
]);
```

#### Get Top Performing Strategies
```javascript
db.strategies.aggregate([
  { $match: { 
    status: "active",
    "performance.roi": { $gt: 0 }
  }},
  { $sort: { "performance.roi": -1 }},
  { $limit: 10 },
  { $project: {
    id: 1,
    goal: 1,
    "performance.roi": 1,
    "performance.totalReturns": 1,
    chains: 1,
    protocols: 1
  }}
]);
```

#### Get Strategy Performance Over Time
```javascript
db.strategies.aggregate([
  { $match: { 
    id: "strategy_1704067200000_abc123def"
  }},
  { $unwind: "$performance.dailyReturns" },
  { $sort: { "performance.dailyReturns.date": 1 }},
  { $project: {
    date: "$performance.dailyReturns.date",
    value: "$performance.dailyReturns.value",
    returns: "$performance.dailyReturns.returns"
  }}
]);
```

#### Get Protocol Usage Statistics
```javascript
db.strategies.aggregate([
  { $match: { 
    status: { $in: ["active", "completed"] }
  }},
  { $unwind: "$protocols" },
  { $group: {
    _id: "$protocols",
    count: { $sum: 1 },
    averageAPY: { $avg: "$estimatedApy" },
    totalTVL: { $sum: "$performance.totalInvested" }
  }},
  { $sort: { count: -1 }}
]);
```

### Complex Queries

#### Find Strategies by Multiple Criteria
```javascript
db.strategies.find({
  $and: [
    { userId: ObjectId("507f1f77bcf86cd799439012") },
    { status: "active" },
    { "metadata.investmentAmount": { $gte: 1000 } },
    { "metadata.riskTolerance": "medium" },
    { chains: "Ethereum" },
    { protocols: { $in: ["Aave", "Compound"] } }
  ]
});
```

#### Find Strategies with High Performance
```javascript
db.strategies.find({
  $and: [
    { status: "active" },
    { "performance.roi": { $gt: 5 } },
    { "performance.totalInvested": { $gt: 0 } }
  ]
}).sort({ "performance.roi": -1 });
```

#### Find Strategies by Date Range
```javascript
db.strategies.find({
  createdAt: {
    $gte: new Date("2024-01-01"),
    $lt: new Date("2024-02-01")
  }
});
```

## Indexing Strategy

### Create Indexes
```javascript
// Compound index for user queries
db.strategies.createIndex({ 
  "userId": 1, 
  "status": 1, 
  "createdAt": -1 
});

// Index for strategy lookup
db.strategies.createIndex({ "id": 1 }, { unique: true });

// Index for performance queries
db.strategies.createIndex({ "performance.lastUpdated": -1 });

// Index for public strategies
db.strategies.createIndex({ "isPublic": 1, "createdAt": -1 });

// Index for protocol-based queries
db.strategies.createIndex({ "protocols": 1, "status": 1 });

// Index for chain-based queries
db.strategies.createIndex({ "chains": 1, "status": 1 });

// Text index for search
db.strategies.createIndex({ 
  "goal": "text", 
  "prompt": "text", 
  "tags": "text" 
});

// Index for soft deletes
db.strategies.createIndex({ "deletedAt": 1 });
```

## Data Migration Examples

### Add New Field to Existing Documents
```javascript
// Add version field to all existing strategies
db.strategies.updateMany(
  { version: { $exists: false } },
  { $set: { version: 1 } }
);
```

### Migrate Status Values
```javascript
// Update old status values to new enum values
db.strategies.updateMany(
  { status: "running" },
  { $set: { status: "active" } }
);
```

### Archive Old Strategies
```javascript
// Move completed strategies older than 1 year to archive
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

db.strategies.updateMany(
  { 
    status: "completed",
    createdAt: { $lt: oneYearAgo }
  },
  { 
    $set: { 
      status: "archived",
      archivedAt: new Date()
    }
  }
);
```

## Performance Optimization

### Query Optimization Tips

1. **Use Projection**: Only fetch needed fields
```javascript
db.strategies.find(
  { userId: ObjectId("...") },
  { id: 1, goal: 1, status: 1, "performance.roi": 1 }
);
```

2. **Use Limit**: Limit result sets
```javascript
db.strategies.find({ userId: ObjectId("...") }).limit(20);
```

3. **Use Sort with Index**: Ensure sort fields are indexed
```javascript
db.strategies.find({ userId: ObjectId("...") })
  .sort({ createdAt: -1 }); // Ensure createdAt is indexed
```

4. **Use Explain**: Analyze query performance
```javascript
db.strategies.find({ userId: ObjectId("...") }).explain("executionStats");
```

### Bulk Operations

#### Bulk Insert
```javascript
const strategies = [/* array of strategy objects */];
db.strategies.insertMany(strategies);
```

#### Bulk Update
```javascript
db.strategies.updateMany(
  { status: "draft" },
  { $set: { updatedAt: new Date() } }
);
```

## Error Handling

### Common Error Scenarios

1. **Duplicate Key Error**
```javascript
try {
  await db.strategies.insertOne(strategy);
} catch (error) {
  if (error.code === 11000) {
    // Handle duplicate key error
    console.log("Strategy ID already exists");
  }
}
```

2. **Validation Error**
```javascript
try {
  await db.strategies.insertOne(invalidStrategy);
} catch (error) {
  if (error.name === 'ValidationError') {
    // Handle validation error
    console.log("Validation failed:", error.message);
  }
}
```

## Monitoring and Maintenance

### Collection Stats
```javascript
db.strategies.stats();
```

### Index Usage
```javascript
db.strategies.aggregate([{ $indexStats: {} }]);
```

### Slow Query Log
```javascript
// Enable profiling for queries taking longer than 100ms
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(5);
```
