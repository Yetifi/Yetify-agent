# Development Setup Guide

This comprehensive guide will help you set up the Yetify project for local development. The project consists of a backend service and a frontend application.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
  - Verify installation: `node --version` and `npm --version`
- **npm** (comes with Node.js) or **yarn**
- **Git** - [Download here](https://git-scm.com/)
  - Verify installation: `git --version`
- **Docker** (for backend services) - [Download here](https://www.docker.com/)
  - Verify installation: `docker --version` and `docker-compose --version`

### Database Requirements

- **MongoDB** (v5.0 or higher) - [Download here](https://www.mongodb.com/try/download/community)
  - **Alternative**: Use Docker MongoDB container (recommended for development)
- **MongoDB Compass** (optional but recommended) - [Download here](https://www.mongodb.com/try/download/compass)

### System Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Ubuntu 18.04+
- **RAM**: Minimum 8GB (16GB recommended)
- **Disk Space**: At least 5GB free space
- **Network**: Stable internet connection for package downloads

## Project Structure

```
Yetify-agent/
├── yetify-backend/     # Backend API service (Node.js/TypeScript)
│   ├── src/           # Source code
│   ├── tests/         # Test files
│   ├── docker-compose.yml # Database configuration
│   └── package.json   # Backend dependencies
├── yetify-frontend/    # Frontend Next.js application
│   ├── src/           # Source code
│   ├── components/    # React components
│   └── package.json   # Frontend dependencies
└── docs/              # Project documentation
```

## Step-by-Step Setup Process

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/your-username/Yetify-agent.git

# Navigate to the project directory
cd Yetify-agent

# Verify the clone was successful
ls -la
```

### 2. Verify Prerequisites

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm version
npm --version

# Check Git version
git --version

# Check Docker version
docker --version
docker-compose --version

# Check MongoDB version (if installed locally)
mongod --version
```

## Backend Setup

### 1. Navigate to Backend Directory

```bash
cd yetify-backend
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Database Configuration

#### Option A: Using Docker (Recommended)

The backend includes a `docker-compose.yml` file for easy database setup:

```bash
# Start MongoDB container
docker-compose up -d

# Verify MongoDB is running
docker ps

# Check MongoDB logs
docker-compose logs mongodb
```

#### Option B: Local MongoDB Installation

If you prefer to install MongoDB locally:

1. **Install MongoDB Community Edition:**
   - **Windows**: Download and run the installer from MongoDB website
   - **macOS**: `brew install mongodb-community`
   - **Ubuntu**: Follow [MongoDB installation guide](https://docs.mongodb.com/manual/installation/)

2. **Start MongoDB Service:**
   ```bash
   # Windows (run as administrator)
   net start MongoDB
   
   # macOS
   brew services start mongodb-community
   
   # Ubuntu
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

3. **Verify MongoDB Connection:**
   ```bash
   # Connect to MongoDB shell
   mongosh
   
   # Or test connection
   mongo --eval "db.runCommand('ping')"
   ```

### 4. Environment Variables Setup

Create a `.env` file in the `yetify-backend` directory:

```bash
# Copy the example environment file (if it exists)
cp .env.example .env
```

**Note:** If no `.env.example` exists, create a `.env` file with the following variables:

```env
# Server Configuration
PORT=4000
NODE_ENV=development
HOST=localhost

# Database Configuration
DATABASE_URL=mongodb://localhost:27017/yetify_dev
MONGODB_URI=mongodb://localhost:27017/yetify_dev
DB_NAME=yetify_dev

# MongoDB Connection Options
MONGODB_OPTIONS="retryWrites=true&w=majority"

# API Keys (add your actual keys)
OPENAI_API_KEY=your_openai_api_key_here
ALCHEMY_API_KEY=your_alchemy_api_key_here

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=debug
```

### 5. Database Initialization

```bash
# Create database and collections (if needed)
mongosh --eval "
  use yetify_dev
  db.createCollection('strategies')
  db.createCollection('executions')
  db.createCollection('users')
  print('Database initialized successfully')
"
```

### 6. Run Backend Development Server

```bash
# Development mode with hot reload
npm run dev

# Or build and run
npm run build
npm start

# Check if server is running
curl http://localhost:4000/health
```

The backend will be available at `http://localhost:4000`

## Frontend Setup

### 1. Navigate to Frontend Directory

```bash
cd yetify-frontend
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Environment Configuration

Create a `.env.local` file in the `yetify-frontend` directory:

```env
# Backend API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_API_VERSION=v1

# Environment
NODE_ENV=development

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_DEBUG=true

# External Services
NEXT_PUBLIC_ALCHEMY_NETWORK=mainnet
```

### 4. Run Frontend Development Server

```bash
# Start development server
npm run dev

# Verify frontend is running
curl http://localhost:3000
```

The frontend will be available at `http://localhost:3000`

## Running Both Services

### Option 1: Separate Terminals (Recommended for Development)

1. **Terminal 1** (Backend):
   ```bash
   cd yetify-backend
   npm run dev
   ```

2. **Terminal 2** (Frontend):
   ```bash
   cd yetify-frontend
   npm run dev
   ```

### Option 2: Using Concurrently

You can run both services simultaneously using the `concurrently` package. Add this to your root `package.json`:

```json
{
  "scripts": {
    "dev": "concurrently \"cd yetify-backend && npm run dev\" \"cd yetify-frontend && npm run dev\"",
    "dev:backend": "cd yetify-backend && npm run dev",
    "dev:frontend": "cd yetify-frontend && npm run dev",
    "install:all": "npm install && cd yetify-backend && npm install && cd ../yetify-frontend && npm install"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}
```

Then run both services with:
```bash
npm run dev
```

## Development Workflow

### 1. Code Changes

- **Backend**: Changes will automatically reload when using `npm run dev`
- **Frontend**: Changes will hot-reload in the browser
- **TypeScript**: Compilation errors will be shown in the terminal

### 2. Testing

Run tests for both services:

**Backend Tests:**
```bash
cd yetify-backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- StrategyEngine.test.ts
```

**Frontend Tests:**
```bash
cd yetify-frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### 3. Building for Production

**Backend:**
```bash
cd yetify-backend

# Build the project
npm run build

# Start production server
npm start

# Check build output
ls -la dist/
```

**Frontend:**
```bash
cd yetify-frontend

# Build the project
npm run build

# Start production server
npm start

# Check build output
ls -la .next/
```

## Troubleshooting Common Issues

### 1. Prerequisites Issues

**Node.js Version Problems:**
```bash
# Check current version
node --version

# If version is too old, update Node.js
# Windows: Download from nodejs.org
# macOS: brew update && brew upgrade node
# Ubuntu: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
```

**npm Issues:**
```bash
# Clear npm cache
npm cache clean --force

# Update npm to latest version
npm install -g npm@latest

# Check for corrupted packages
npm audit fix
```

**Git Issues:**
```bash
# Verify Git configuration
git config --list

# Set up Git if not configured
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 2. Database Connection Issues

**MongoDB Connection Failed:**
```bash
# Check if MongoDB is running
docker ps | grep mongodb

# Restart MongoDB container
docker-compose restart mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Test connection manually
mongosh mongodb://localhost:27017/yetify_dev
```

**Port Already in Use:**
```bash
# Check what's using port 27017
netstat -ano | findstr :27017  # Windows
lsof -i :27017                 # macOS/Linux

# Kill the process or change MongoDB port
# In docker-compose.yml, change ports: "27018:27017"
```

### 3. Backend Issues

**Port Already in Use (4000):**
```bash
# Check what's using port 4000
netstat -ano | findstr :4000  # Windows
lsof -i :4000                 # macOS/Linux

# Change port in .env file
PORT=4001
```

**Dependency Issues:**
```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for version conflicts
npm ls
```

**TypeScript Errors:**
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Update TypeScript
npm install typescript@latest

# Check tsconfig.json
cat tsconfig.json
```

### 4. Frontend Issues

**Port Already in Use (3000):**
```bash
# Check what's using port 3000
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # macOS/Linux

# Change port in package.json or use -p flag
npm run dev -- -p 3001
```

**Build Errors:**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npx tsc --noEmit
```

### 5. Docker Issues

**Docker Not Running:**
```bash
# Start Docker Desktop (Windows/macOS)
# Or start Docker service (Linux)
sudo systemctl start docker

# Verify Docker is running
docker info
```

**Container Issues:**
```bash
# Stop all containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Rebuild containers
docker-compose up --build -d

# Check container status
docker-compose ps
```

### 6. Network and CORS Issues

**CORS Errors:**
```bash
# Check backend CORS configuration
# Ensure CORS_ORIGIN in .env matches frontend URL

# Test API endpoint directly
curl -H "Origin: http://localhost:3000" http://localhost:4000/api/health
```

**API Connection Issues:**
```bash
# Test backend health endpoint
curl http://localhost:4000/health

# Check network connectivity
ping localhost

# Verify firewall settings
```

## Getting Help

### Documentation Resources

- **Project README**: Check the main README.md file
- **Component Documentation**: Review component files for usage examples
- **API Documentation**: Check GraphQL schema and resolvers
- **Test Files**: Review test files for expected behavior patterns

### Debugging Tools

**Backend Debugging:**
```bash
# Enable debug logging
DEBUG=* npm run dev

# Use Node.js debugger
node --inspect src/index.ts

# Check environment variables
node -e "console.log(process.env)"
```

**Frontend Debugging:**
- Use browser DevTools (F12)
- Install React DevTools extension
- Check browser console for errors
- Use Next.js built-in debugging

**Database Debugging:**
```bash
# Connect to MongoDB shell
mongosh mongodb://localhost:27017/yetify_dev

# Check collections and data
show collections
db.strategies.find().limit(5)
```

## Additional Development Tools

### Code Quality

- **ESLint**: Code linting and formatting
  ```bash
  npm run lint        # Check for issues
  npm run lint:fix    # Fix auto-fixable issues
  ```
- **Prettier**: Code formatting (if configured)
  ```bash
  npm run format      # Format code
  npm run format:check # Check formatting
  ```
- **TypeScript**: Type checking and IntelliSense
  ```bash
  npx tsc --noEmit    # Type check without emitting
  ```

### Development Utilities

- **nodemon**: Auto-restart backend on changes
- **concurrently**: Run multiple commands simultaneously
- **cross-env**: Set environment variables cross-platform

## Verification Checklist

Before starting development, ensure you can:

- [ ] Clone the repository successfully
- [ ] Install all dependencies without errors
- [ ] Start MongoDB (local or Docker)
- [ ] Configure environment variables
- [ ] Start backend server on port 4000
- [ ] Start frontend server on port 3000
- [ ] Access both services in browser
- [ ] Run tests successfully
- [ ] Build both services without errors

## Next Steps

Once you have the development environment set up:

1. **Explore the Codebase**: Familiarize yourself with the project structure
2. **Review Components**: Check existing React components and backend services
3. **Study Tests**: Understand expected behavior through test files
4. **Check API**: Review GraphQL schema and available endpoints
5. **Start Contributing**: Pick an issue or feature to work on

## Support and Community

If you encounter issues not covered in this guide:

1. **Check Issues**: Search existing GitHub issues
2. **Create Issue**: Report new bugs or request features
3. **Discussion**: Use GitHub Discussions for questions
4. **Documentation**: Contribute improvements to this guide

## Quick Reference Commands

```bash
# Start everything
npm run dev

# Backend only
cd yetify-backend && npm run dev

# Frontend only
cd yetify-frontend && npm run dev

# Database
docker-compose up -d

# Tests
npm test

# Build
npm run build
```

Happy coding! 🚀

---

**Note**: This guide is maintained by the Yetify development team. If you find any issues or have suggestions for improvements, please create an issue or submit a pull request. 