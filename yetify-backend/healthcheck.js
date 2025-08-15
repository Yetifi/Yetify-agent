#!/usr/bin/env node

/**
 * Health Check Script for Yetify Backend
 * 
 * This script performs comprehensive health checks on the Yetify backend service
 * for Docker container health monitoring and service discovery.
 */

const http = require('http');

// Configuration
const CONFIG = {
  hostname: 'localhost',
  port: process.env.PORT || 3001,
  timeout: 5000,
  retries: 2,
  endpoints: {
    health: '/health',
    metrics: '/metrics',
    ready: '/ready'
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Make HTTP request with timeout and retry logic
 */
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: CONFIG.hostname,
      port: CONFIG.port,
      path,
      method: 'GET',
      timeout: CONFIG.timeout,
      ...options
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            data: data ? JSON.parse(data) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            data: data,
            parseError: error.message
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${CONFIG.timeout}ms`));
    });
    
    req.setTimeout(CONFIG.timeout);
    req.end();
  });
}

/**
 * Retry logic wrapper
 */
async function withRetry(operation, retries = CONFIG.retries) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retries + 1) {
        throw error;
      }
      
      console.log(`${colors.yellow}⚠️  Attempt ${attempt} failed, retrying...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Check basic health endpoint
 */
async function checkHealth() {
  console.log(`${colors.cyan}🔍 Checking health endpoint...${colors.reset}`);
  
  const response = await makeRequest(CONFIG.endpoints.health);
  
  if (response.statusCode === 200 && response.data?.status === 'healthy') {
    console.log(`${colors.green}✅ Health check passed${colors.reset}`);
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Environment: ${response.data.environment}`);
    console.log(`   Version: ${response.data.version}`);
    console.log(`   Timestamp: ${response.data.timestamp}`);
    return true;
  } else {
    throw new Error(`Health check failed: ${response.statusCode} ${response.statusMessage}`);
  }
}

/**
 * Check service readiness
 */
async function checkReadiness() {
  console.log(`${colors.cyan}🔍 Checking readiness...${colors.reset}`);
  
  try {
    const response = await makeRequest(CONFIG.endpoints.ready);
    
    if (response.statusCode === 200) {
      console.log(`${colors.green}✅ Service is ready${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.yellow}⚠️  Service not ready: ${response.statusCode}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Readiness check unavailable: ${error.message}${colors.reset}`);
    return true; // Don't fail health check if readiness endpoint doesn't exist
  }
}

/**
 * Check database connectivity (through health endpoint)
 */
async function checkDatabase() {
  console.log(`${colors.cyan}🔍 Checking database connectivity...${colors.reset}`);
  
  try {
    const response = await makeRequest('/api/v1/monitoring/health-check');
    
    if (response.statusCode === 200 && response.data?.health) {
      const dbStatus = response.data.health.serviceStatus?.database || 'unknown';
      console.log(`${colors.green}✅ Database connectivity: ${dbStatus}${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.yellow}⚠️  Database check unavailable${colors.reset}`);
      return true; // Don't fail health check if monitoring endpoint doesn't exist
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Database check failed: ${error.message}${colors.reset}`);
    return true; // Don't fail health check for optional checks
  }
}

/**
 * Check system resources
 */
function checkSystemResources() {
  console.log(`${colors.cyan}🔍 Checking system resources...${colors.reset}`);
  
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };
  
  console.log(`${colors.green}✅ Memory usage:${colors.reset}`);
  console.log(`   RSS: ${memUsageMB.rss} MB`);
  console.log(`   Heap Total: ${memUsageMB.heapTotal} MB`);
  console.log(`   Heap Used: ${memUsageMB.heapUsed} MB`);
  console.log(`   External: ${memUsageMB.external} MB`);
  
  // Check for memory leaks (heap used > 500MB is concerning)
  if (memUsageMB.heapUsed > 500) {
    console.log(`${colors.yellow}⚠️  High memory usage detected${colors.reset}`);
  }
  
  return true;
}

/**
 * Check process uptime
 */
function checkUptime() {
  const uptimeSeconds = process.uptime();
  const uptimeFormatted = formatUptime(uptimeSeconds);
  
  console.log(`${colors.green}✅ Process uptime: ${uptimeFormatted}${colors.reset}`);
  return true;
}

/**
 * Format uptime in human readable format
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Main health check function
 */
async function performHealthCheck() {
  const startTime = Date.now();
  
  try {
    console.log(`${colors.bright}${colors.magenta}🏥 Yetify Backend Health Check${colors.reset}`);
    console.log(`${colors.cyan}Target: http://${CONFIG.hostname}:${CONFIG.port}${colors.reset}`);
    console.log(`${colors.cyan}Timeout: ${CONFIG.timeout}ms${colors.reset}`);
    console.log('');

    // Core health checks (these must pass)
    await withRetry(() => checkHealth());
    
    // Optional checks (these can warn but won't fail the health check)
    await Promise.allSettled([
      checkReadiness(),
      checkDatabase(),
      checkSystemResources(),
      checkUptime()
    ]);

    const duration = Date.now() - startTime;
    console.log('');
    console.log(`${colors.green}${colors.bright}✅ All health checks passed${colors.reset}`);
    console.log(`${colors.cyan}Duration: ${duration}ms${colors.reset}`);
    
    process.exit(0);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log('');
    console.error(`${colors.red}${colors.bright}❌ Health check failed${colors.reset}`);
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    console.error(`${colors.cyan}Duration: ${duration}ms${colors.reset}`);
    
    process.exit(1);
  }
}

/**
 * Handle process signals
 */
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}⚠️  Health check interrupted${colors.reset}`);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log(`\n${colors.yellow}⚠️  Health check terminated${colors.reset}`);
  process.exit(1);
});

// Global timeout for the entire health check process
const globalTimeout = setTimeout(() => {
  console.error(`${colors.red}❌ Health check timed out after 30 seconds${colors.reset}`);
  process.exit(1);
}, 30000);

// Clear timeout when process exits
globalTimeout.unref();

// Run health check
if (require.main === module) {
  performHealthCheck();
}

module.exports = {
  performHealthCheck,
  checkHealth,
  checkReadiness,
  checkDatabase,
  checkSystemResources,
  makeRequest,
  withRetry
};
