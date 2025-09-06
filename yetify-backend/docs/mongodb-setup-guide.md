# MongoDB Setup Guide for Yetify

This guide covers MongoDB setup for different environments: local development, admin/production, and testing.

## Environment Overview

| Environment | Purpose | Database Name | Authentication | Port | Data Persistence |
|-------------|---------|---------------|----------------|------|------------------|
| **Local Development** | Development & testing | `yetify_dev` | None (optional) | 27017 | Local filesystem |
| **Admin/Production** | Production deployment | `yetify` | Required | 27017 | Persistent volumes |
| **Testing** | Unit/integration tests | `yetify_test` | None | In-memory | Memory only |

## 1. Local Development Setup

### Option A: Docker Compose (Recommended)

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  yetify-mongodb-dev:
    image: mongo:7.0
    container_name: yetify-mongodb-dev
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=yetify_dev
    volumes:
      - mongodb-dev-data:/data/db
      - ./scripts/mongo-init-dev.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - yetify-dev-network
    restart: unless-stopped

volumes:
  mongodb-dev-data:
    driver: local

networks:
  yetify-dev-network:
    driver: bridge
```

### Option B: Local MongoDB Installation

```bash
# macOS (using Homebrew)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community

# Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Windows
# Download from https://www.mongodb.com/try/download/community
# Run the installer and follow the setup wizard
```

### Environment Variables for Local Development

```env
# .env.development
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/yetify_dev
MONGODB_OPTIONS=retryWrites=true&w=majority
DB_NAME=yetify_dev
```

### Local Development Commands

```bash
# Start MongoDB (Docker)
docker-compose -f docker-compose.dev.yml up -d yetify-mongodb-dev

# Connect to MongoDB
mongosh mongodb://localhost:27017/yetify_dev

# View collections
db.getCollectionNames()

# Check database stats
db.stats()

# Stop MongoDB
docker-compose -f docker-compose.dev.yml down
```

## 2. Admin/Production Setup

### Docker Compose Production Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  yetify-mongodb:
    image: mongo:7.0
    container_name: yetify-mongodb
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=yetify
      - MONGO_INITDB_ROOT_USERNAME=${MONGODB_ROOT_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGODB_ROOT_PASSWORD}
    volumes:
      - mongodb-data:/data/db
      - mongodb-config:/data/configdb
      - ./scripts/mongo-init-prod.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
      - ./scripts/mongod.conf:/etc/mongod.conf:ro
    networks:
      - yetify-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
    command: ["mongod", "--config", "/etc/mongod.conf"]

volumes:
  mongodb-data:
    driver: local
  mongodb-config:
    driver: local

networks:
  yetify-network:
    driver: bridge
```

### Production Environment Variables

```env
# .env.production
NODE_ENV=production
MONGODB_URI=mongodb://admin:${MONGODB_ROOT_PASSWORD}@yetify-mongodb:27017/yetify?authSource=admin
MONGODB_ROOT_USER=admin
MONGODB_ROOT_PASSWORD=your_secure_password_here
DB_NAME=yetify
```

### MongoDB Configuration File

```conf
# scripts/mongod.conf
storage:
  dbPath: /data/db
  journal:
    enabled: true
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 0.0.0.0

security:
  authorization: enabled

replication:
  replSetName: "yetify-rs"

processManagement:
  timeZoneInfo: /usr/share/zoneinfo
```

### Production Initialization Script

```javascript
// scripts/mongo-init-prod.js
db = db.getSiblingDB('yetify');

// Create application user
db.createUser({
  user: 'yetify_app',
  pwd: 'yetify_app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'yetify'
    }
  ]
});

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['walletAddress', 'walletType'],
      properties: {
        walletAddress: {
          bsonType: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$'
        },
        walletType: {
          bsonType: 'string',
          enum: ['metamask', 'near', 'walletconnect']
        }
      }
    }
  }
});

db.createCollection('strategies', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'userId', 'goal', 'prompt', 'chains', 'protocols', 'steps'],
      properties: {
        id: {
          bsonType: 'string',
          pattern: '^strategy_\\d+_[a-zA-Z0-9]+$'
        },
        userId: {
          bsonType: 'objectId'
        },
        status: {
          bsonType: 'string',
          enum: ['draft', 'active', 'paused', 'completed', 'failed', 'cancelled']
        }
      }
    }
  }
});

// Create indexes
db.users.createIndex({ walletAddress: 1 }, { unique: true });
db.strategies.createIndex({ id: 1 }, { unique: true });
db.strategies.createIndex({ userId: 1, status: 1, createdAt: -1 });
db.strategies.createIndex({ protocols: 1, status: 1 });
db.strategies.createIndex({ chains: 1, status: 1 });
db.strategies.createIndex({ goal: 'text', prompt: 'text', tags: 'text' });

print('Production database initialized successfully');
```

## 3. Testing Setup

### In-Memory MongoDB (Jest/Vitest)

```javascript
// tests/setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'yetify_test'
    }
  });
  
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  
  process.env.MONGODB_URI = mongoUri;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

### Test Environment Variables

```env
# .env.test
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/yetify_test
DB_NAME=yetify_test
```

## 4. Database Administration

### Admin User Setup

```bash
# Connect as admin
mongosh mongodb://admin:password@localhost:27017/admin

# Create admin user
use admin
db.createUser({
  user: 'admin',
  pwd: 'admin_password',
  roles: [
    { role: 'userAdminAnyDatabase', db: 'admin' },
    { role: 'readWriteAnyDatabase', db: 'admin' },
    { role: 'dbAdminAnyDatabase', db: 'admin' }
  ]
});

# Create read-only user for monitoring
db.createUser({
  user: 'monitor',
  pwd: 'monitor_password',
  roles: [
    { role: 'readAnyDatabase', db: 'admin' }
  ]
});
```

### Backup and Restore

```bash
# Backup database
mongodump --uri="mongodb://admin:password@localhost:27017/yetify" --out=/backup/yetify-$(date +%Y%m%d)

# Restore database
mongorestore --uri="mongodb://admin:password@localhost:27017/yetify" /backup/yetify-20240115

# Backup specific collections
mongodump --uri="mongodb://admin:password@localhost:27017/yetify" --collection=strategies --out=/backup/
```

### Monitoring and Maintenance

```bash
# Check database status
mongosh --eval "db.adminCommand('serverStatus')"

# Check collection stats
mongosh yetify --eval "db.stats()"

# Check index usage
mongosh yetify --eval "db.strategies.aggregate([{ \$indexStats: {} }])"

# Check slow queries
mongosh yetify --eval "db.setProfilingLevel(1, { slowms: 100 })"
mongosh yetify --eval "db.system.profile.find().sort({ ts: -1 }).limit(5)"
```

## 5. Security Best Practices

### Authentication Setup

```javascript
// Enable authentication
use admin
db.createUser({
  user: 'admin',
  pwd: 'secure_password_here',
  roles: ['userAdminAnyDatabase', 'readWriteAnyDatabase', 'dbAdminAnyDatabase']
});

// Create application user with limited permissions
use yetify
db.createUser({
  user: 'yetify_app',
  pwd: 'app_password_here',
  roles: [
    { role: 'readWrite', db: 'yetify' }
  ]
});
```

### Network Security

```yaml
# docker-compose.security.yml
services:
  yetify-mongodb:
    # ... other config
    networks:
      - internal-network
    # Remove port exposure for production
    # ports:
    #   - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGODB_ROOT_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGODB_ROOT_PASSWORD}
    command: >
      mongod
      --bind_ip_all
      --auth
      --keyFile /etc/mongodb/keyfile
      --replSet yetify-rs

networks:
  internal-network:
    driver: bridge
    internal: true
```

### SSL/TLS Configuration

```yaml
# Add to docker-compose.yml
volumes:
  - ./ssl/mongodb.pem:/etc/ssl/mongodb.pem:ro
  - ./ssl/mongodb-ca.pem:/etc/ssl/mongodb-ca.pem:ro

environment:
  - MONGO_SSL_MODE=requireSSL
  - MONGO_SSL_PEM_KEY_FILE=/etc/ssl/mongodb.pem
  - MONGO_SSL_CA_FILE=/etc/ssl/mongodb-ca.pem
```

## 6. Performance Optimization

### Connection Pooling

```javascript
// src/utils/database.ts
const options: mongoose.ConnectOptions = {
  maxPoolSize: 10,        // Maximum number of connections
  minPoolSize: 2,         // Minimum number of connections
  maxIdleTimeMS: 30000,   // Close connections after 30 seconds of inactivity
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  retryWrites: true,
  retryReads: true
};
```

### Indexing Strategy

```javascript
// Create compound indexes for common queries
db.strategies.createIndex({ userId: 1, status: 1, createdAt: -1 });
db.strategies.createIndex({ protocols: 1, status: 1 });
db.strategies.createIndex({ chains: 1, status: 1 });
db.strategies.createIndex({ 'performance.lastUpdated': -1 });

// Text search index
db.strategies.createIndex({ 
  goal: 'text', 
  prompt: 'text', 
  tags: 'text' 
});
```

## 7. Environment-Specific Commands

### Local Development

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f yetify-mongodb-dev

# Connect to database
mongosh mongodb://localhost:27017/yetify_dev

# Reset database
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### Production

```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f yetify-mongodb

# Connect as admin
mongosh mongodb://admin:password@localhost:27017/admin

# Connect as application user
mongosh mongodb://yetify_app:password@localhost:27017/yetify
```

### Testing

```bash
# Run tests with in-memory MongoDB
npm test

# Run tests with specific database
MONGODB_URI=mongodb://localhost:27017/yetify_test npm test
```

## 8. Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if MongoDB is running
   docker ps | grep mongo
   
   # Check logs
   docker logs yetify-mongodb
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

### Health Checks

```bash
# Check MongoDB health
mongosh --eval "db.adminCommand('ping')"

# Check database stats
mongosh yetify --eval "db.stats()"

# Check collection sizes
mongosh yetify --eval "db.runCommand({collStats: 'strategies'})"
```

This comprehensive setup ensures MongoDB is properly configured for all environments with appropriate security, performance, and monitoring capabilities.
