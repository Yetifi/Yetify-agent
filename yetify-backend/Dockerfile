# Multi-stage Docker build for Yetify Backend
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache python3 make g++ git

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS builder
ENV NODE_ENV=development

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tests/ ./tests/

# Build TypeScript
RUN npm run build

# Test stage
FROM builder AS tester
ENV NODE_ENV=test
RUN npm run test:ci

# Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S yetify -u 1001 -G nodejs

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=yetify:nodejs /app/dist ./dist

# Copy necessary runtime files
COPY --chown=yetify:nodejs healthcheck.js ./
# scripts/ folder removed - not needed for production

# Create logs directory with proper permissions
RUN mkdir -p logs && \
    chown -R yetify:nodejs logs && \
    chmod 755 logs

# Security: Packages not needed in production stage (clean base image)

# Switch to non-root user
USER yetify

# Expose application port
EXPOSE 3001

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node healthcheck.js || exit 1

# Optimize for production
ENV NODE_ENV=production
ENV NPM_CONFIG_PRODUCTION=true

# Use production process manager
CMD ["node", "dist/index.js"]

# Metadata
LABEL maintainer="Yetify Team <dev@yetify.ai>"
LABEL version="1.0.0"
LABEL description="Yetify AI-powered DeFi yield strategy backend"
LABEL org.opencontainers.image.source="https://github.com/Yetifi/Yetify-agent"
