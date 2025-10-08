import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from 'apollo-server-express';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import logger from './utils/logger';
import { connectDatabase } from './utils/database';
import { typeDefs } from './graphql/schemas';
import { resolvers } from './graphql/resolvers';
import { authMiddleware } from './middleware/auth';
import strategyRoutes from './controllers/strategyController';
import executionRoutes from './controllers/executionController';
import monitoringRoutes from './controllers/monitoringController';
import testRoutes from './controllers/testController';
import userRoutes from './routes/userRoutes';

interface AuthenticatedRequest extends Request {
  user?: { id: string; walletAddress: string; walletType: string };
}

// Load environment variables with explicit path
dotenv.config({ path: '.env' });
console.log('Environment loaded. OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);

// Logger is now imported directly
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yetify.ai', 'https://app.yetify.ai']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/v1/strategies', authMiddleware, strategyRoutes);
app.use('/api/v1/execution', authMiddleware, executionRoutes);
app.use('/api/v1/monitoring', authMiddleware, monitoringRoutes);
app.use('/api/v1/users', userRoutes);

// Test Routes (no auth required for testing)
app.use('/api/v1/test', testRoutes);

// Add 404 handler AFTER all routes are defined
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// GraphQL endpoint
async function startApolloServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }: { req: AuthenticatedRequest }) => {
      // Add authentication context
      const token = req.headers.authorization?.replace('Bearer ', '');
      return { token, user: req.user };
    },
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();
  server.applyMiddleware({ 
    app: app as any, 
    path: '/graphql',
    cors: false // Already handled by app-level CORS
  });

  return server;
}

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication credentials'
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message
  });
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Start Apollo GraphQL server
    const apolloServer = await startApolloServer();
    logger.info(`GraphQL server ready at http://localhost:${PORT}${apolloServer.graphqlPath}`);

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 Yetify Backend Server running on port ${PORT}`);
      logger.info(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🧠 AI Strategy Engine: READY`);
      logger.info(`⛓️  Multi-chain execution: ENABLED`);
      logger.info(`📈 Real-time monitoring: ACTIVE`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('Server startup failed:', error);
  process.exit(1);
});

export default app;
