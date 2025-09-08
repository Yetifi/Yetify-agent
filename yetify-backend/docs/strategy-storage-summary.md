# Strategy Storage in MongoDB - Summary

## Overview

Yetify stores user strategies in MongoDB using a well-structured, NoSQL document format. The strategy collection is designed to handle complex DeFi strategies with multiple steps, performance tracking, and execution history.

## Key Design Principles

### 1. **Document-Based Storage**
- Each strategy is stored as a single document
- Related data (steps, performance, history) is embedded within the document
- This provides fast read operations and maintains data consistency

### 2. **Flexible Schema**
- MongoDB's flexible schema allows for easy evolution
- New fields can be added without affecting existing data
- Optional fields handle varying strategy complexity

### 3. **Performance Optimized**
- Strategic indexing for common query patterns
- Compound indexes for multi-field queries
- Text search capabilities for strategy discovery

## Document Structure

### Core Fields
```json
{
  "_id": "ObjectId",           // MongoDB's unique identifier
  "id": "strategy_...",        // Application-level unique ID
  "userId": "ObjectId",        // Reference to user document
  "version": 1,                // Schema version for migrations
  "goal": "string",            // Human-readable strategy objective
  "prompt": "string",          // Original user input
  "metadata": { ... },         // User preferences and context
  "chains": ["Ethereum"],      // Target blockchain networks
  "protocols": ["Aave"],       // DeFi protocols to use
  "steps": [ ... ],            // Execution steps array
  "status": "draft|active|...", // Current strategy status
  "performance": { ... },      // Performance tracking data
  "executionHistory": [ ... ], // Transaction history
  "createdAt": "Date",         // Creation timestamp
  "updatedAt": "Date"          // Last update timestamp
}
```

### Embedded Subdocuments

#### Strategy Steps
```json
{
  "stepId": "step_1",
  "order": 1,
  "action": "deposit",
  "protocol": "Aave",
  "asset": "USDC",
  "amount": "5000",
  "expectedApy": 8.5,
  "riskScore": 3,
  "conditions": {
    "minAmount": 1000,
    "maxSlippage": 0.5
  }
}
```

#### Performance Data
```json
{
  "totalInvested": 10000,
  "currentValue": 10150,
  "totalReturns": 150,
  "roi": 1.5,
  "lastUpdated": "2024-01-16T10:00:00Z",
  "dailyReturns": [
    {
      "date": "2024-01-15",
      "value": 10000,
      "returns": 0
    }
  ]
}
```

#### Execution History
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "deposit",
  "status": "success",
  "transactionHash": "0x...",
  "gasUsed": "150000",
  "blockNumber": 18500000
}
```

## Query Patterns

### Common Queries

1. **Get User's Strategies**
   ```javascript
   db.strategies.find({ userId: ObjectId("...") })
   ```

2. **Get Active Strategies**
   ```javascript
   db.strategies.find({ 
     userId: ObjectId("..."),
     status: "active" 
   })
   ```

3. **Search by Protocol**
   ```javascript
   db.strategies.find({ 
     protocols: "Aave",
     status: { $in: ["active", "completed"] }
   })
   ```

4. **Text Search**
   ```javascript
   db.strategies.find({ 
     $text: { $search: "yield farming USDC" } 
   })
   ```

### Aggregation Examples

1. **Portfolio Summary**
   ```javascript
   db.strategies.aggregate([
     { $match: { userId: ObjectId("...") } },
     { $group: {
       _id: null,
       totalInvested: { $sum: "$performance.totalInvested" },
       totalReturns: { $sum: "$performance.totalReturns" }
     }}
   ])
   ```

2. **Performance Analytics**
   ```javascript
   db.strategies.aggregate([
     { $match: { status: "active" } },
     { $sort: { "performance.roi": -1 } },
     { $limit: 10 }
   ])
   ```

## Indexing Strategy

### Primary Indexes
- `{ id: 1 }` - Unique strategy lookup
- `{ userId: 1, status: 1, createdAt: -1 }` - User queries
- `{ protocols: 1, status: 1 }` - Protocol-based queries
- `{ chains: 1, status: 1 }` - Chain-based queries

### Performance Indexes
- `{ "performance.lastUpdated": -1 }` - Performance queries
- `{ isPublic: 1, createdAt: -1 }` - Public strategies
- `{ goal: "text", prompt: "text", tags: "text" }` - Text search

## Data Relationships

### User-Strategy Relationship
- One-to-many relationship
- User document contains basic profile
- Strategy documents reference user via `userId`
- Strategies can be queried independently

### Strategy-Protocol Relationship
- Many-to-many relationship
- Strategies can use multiple protocols
- Protocols are referenced by name in strategy documents
- Protocol data stored separately for market information

## Scalability Considerations

### Document Size
- Strategy documents are typically 2-5KB
- Large execution history arrays may need pagination
- Consider archiving old execution history

### Query Performance
- Indexes optimized for common query patterns
- Use projection to limit returned fields
- Implement pagination for large result sets

### Data Growth
- Soft deletes preserve historical data
- Archive completed strategies after 1 year
- Consider sharding by userId for very large datasets

## Migration Strategy

### Schema Evolution
- Use version field for backward compatibility
- Add new fields as optional initially
- Migrate data in batches to avoid downtime

### Data Migration Examples
```javascript
// Add new field to existing documents
db.strategies.updateMany(
  { version: { $exists: false } },
  { $set: { version: 1 } }
);

// Migrate status values
db.strategies.updateMany(
  { status: "running" },
  { $set: { status: "active" } }
);
```

## Security Considerations

### Access Control
- User can only access their own strategies
- Public strategies have `isPublic: true` flag
- Admin users can access all strategies

### Data Validation
- Mongoose schema validation
- Joi validation for API inputs
- Type checking for critical fields

### Audit Trail
- Execution history tracks all transactions
- Performance data tracks value changes
- Soft deletes preserve audit information

## Best Practices

### 1. **Use ObjectId for References**
- Always use ObjectId for `userId` references
- Provides better performance than string references

### 2. **Index Frequently Queried Fields**
- Create compound indexes for common query patterns
- Monitor index usage and remove unused indexes

### 3. **Validate Data at Application Level**
- Use Mongoose validation
- Implement Joi schemas for API validation
- Handle validation errors gracefully

### 4. **Implement Soft Deletes**
- Use `deletedAt` field instead of hard deletes
- Preserves audit trail and historical data
- Allows for data recovery if needed

### 5. **Monitor Performance**
- Use MongoDB's explain() for query analysis
- Monitor slow query log
- Set up alerts for performance degradation

## Conclusion

The MongoDB strategy storage design provides:
- **Flexibility**: Easy to add new fields and features
- **Performance**: Optimized for common query patterns
- **Scalability**: Can handle large numbers of strategies
- **Reliability**: Comprehensive error handling and validation
- **Maintainability**: Clear structure and documentation

This design supports Yetify's core functionality while providing room for future growth and feature additions.
