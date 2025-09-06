# MongoDB Environment Setup Summary

## Overview

This document provides a comprehensive guide for setting up MongoDB in different environments for the Yetify project. Each environment is optimized for its specific use case with appropriate security, performance, and monitoring configurations.

## Environment Comparison

| Aspect | Local Development | Admin/Production | Testing |
|--------|------------------|------------------|---------|
| **Database Name** | `yetify_dev` | `yetify` | `yetify_test` |
| **Authentication** | None (optional) | Required (admin + app users) | None (in-memory) |
| **Port** | 27017 | 27017 | In-memory |
| **Data Persistence** | Local filesystem | Persistent volumes | Memory only |
| **Security** | Basic | Full authentication + SSL | None |
| **Monitoring** | Basic logs | Full monitoring + metrics | None |
| **Backup** | Manual | Automated daily | None |
| **Performance** | Standard | Optimized | Fast (in-memory) |

## Quick Start Commands

### Local Development
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Connect to database
mongosh mongodb://localhost:27017/yetify_dev

# Stop environment
docker-compose -f docker-compose.dev.yml down
```

### Production
```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Connect as admin
mongosh mongodb://admin:password@localhost:27017/admin

# Connect as app user
mongosh mongodb://yetify_app:password@localhost:27017/yetify

# Stop environment
docker-compose -f docker-compose.prod.yml down
```

### Testing
```bash
# Run tests (uses in-memory MongoDB)
npm test

# Run tests with specific database
MONGODB_URI=mongodb://localhost:27017/yetify_test npm test
```

## Database Structure

### Collections
1. **users** - User accounts and preferences
2. **strategies** - DeFi strategies and execution data
3. **protocols** - Market data for DeFi protocols

### Key Features
- **Document-based storage** for flexible schema
- **Embedded subdocuments** for related data
- **Comprehensive indexing** for query performance
- **Data validation** with JSON Schema
- **Soft deletes** for data preservation
- **Version control** for schema evolution

## Security Configuration

### Development
- No authentication required
- Local network access only
- Basic data validation

### Production
- **Admin user**: Full database access
- **App user**: Read/write access to application data
- **Monitor user**: Read-only access for monitoring
- **SSL/TLS encryption** for data in transit
- **Network isolation** with custom Docker networks
- **Regular security updates**

## Performance Optimization

### Indexing Strategy
```javascript
// Primary indexes
{ id: 1 } // Unique strategy lookup
{ userId: 1, status: 1, createdAt: -1 } // User queries
{ protocols: 1, status: 1 } // Protocol-based queries
{ chains: 1, status: 1 } // Chain-based queries

// Performance indexes
{ 'performance.lastUpdated': -1 } // Performance queries
{ isPublic: 1, createdAt: -1 } // Public strategies
{ goal: 'text', prompt: 'text', tags: 'text' } // Text search
```

### Connection Pooling
- **Development**: 5 connections max
- **Production**: 10-20 connections max
- **Testing**: 5 connections max

## Monitoring and Maintenance

### Health Checks
- **MongoDB**: `db.adminCommand('ping')`
- **Redis**: `redis-cli ping`
- **Application**: Custom health check endpoint

### Backup Strategy
- **Development**: Manual backups
- **Production**: Automated daily backups
- **Retention**: 30 days for production
- **Storage**: Local volumes + S3 (optional)

### Logging
- **Development**: Debug level, console output
- **Production**: Info level, file output
- **Log rotation**: Daily rotation, 30-day retention

## Environment Variables

### Required Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/yetify_dev
DB_NAME=yetify_dev

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_char_key
```

### Production Variables
```bash
# Database with authentication
MONGODB_URI=mongodb://yetify_app:password@yetify-mongodb:27017/yetify?authSource=admin
MONGODB_ROOT_USER=admin
MONGODB_ROOT_PASSWORD=secure_password

# Redis with password
REDIS_URL=redis://:password@yetify-redis:6379
REDIS_PASSWORD=secure_password
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if MongoDB is running
   docker ps | grep mongo
   
   # Check logs
   docker logs yetify-mongodb-dev
   ```

2. **Authentication Failed**
   ```bash
   # Check user exists
   mongosh --eval "db.getUsers()"
   
   # Reset password
   mongosh --eval "db.changeUserPassword('username', 'new_password')"
   ```

3. **Database Not Found**
   ```bash
   # List databases
   mongosh --eval "show dbs"
   
   # Create database
   mongosh --eval "use yetify; db.createCollection('test')"
   ```

### Performance Issues

1. **Slow Queries**
   ```bash
   # Enable profiling
   mongosh --eval "db.setProfilingLevel(1, { slowms: 100 })"
   
   # Check slow queries
   mongosh --eval "db.system.profile.find().sort({ ts: -1 }).limit(5)"
   ```

2. **High Memory Usage**
   ```bash
   # Check memory usage
   mongosh --eval "db.serverStatus().mem"
   
   # Check index usage
   mongosh --eval "db.strategies.aggregate([{ \$indexStats: {} }])"
   ```

## Best Practices

### Development
- Use Docker Compose for consistent environment
- Enable MongoDB Express for database management
- Use in-memory MongoDB for testing
- Keep development data separate from production

### Production
- Use strong passwords and authentication
- Enable SSL/TLS encryption
- Set up automated backups
- Monitor database performance
- Regular security updates
- Use connection pooling
- Implement proper logging

### Testing
- Use in-memory MongoDB for unit tests
- Clean up data after each test
- Mock external dependencies
- Test with realistic data volumes

## File Structure

```
yetify-backend/
├── docker-compose.yml          # Main production setup
├── docker-compose.dev.yml      # Development setup
├── docker-compose.prod.yml     # Production setup
├── scripts/
│   ├── mongo-init-dev.js       # Development initialization
│   ├── mongo-init-prod.js      # Production initialization
│   └── backup.sh               # Backup script
├── config/
│   ├── env.development.example # Development config
│   └── env.production.example  # Production config
└── docs/
    ├── mongodb-setup-guide.md  # Detailed setup guide
    ├── mongodb-operations-guide.md # Operations guide
    └── mongodb-environment-summary.md # This file
```

## Next Steps

1. **Choose your environment** (development, production, or testing)
2. **Copy the appropriate environment file** and update with your values
3. **Run the Docker Compose command** for your chosen environment
4. **Verify the setup** by connecting to the database
5. **Configure monitoring** and backups for production
6. **Set up CI/CD** for automated deployments

This setup provides a robust, scalable, and secure MongoDB environment for the Yetify DeFi strategy platform across all environments.
