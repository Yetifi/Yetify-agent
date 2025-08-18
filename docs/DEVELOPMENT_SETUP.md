# Development Setup Guide

This guide will help you set up the Yetify project for local development. The project consists of a backend service and a frontend application.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Git** - [Download here](https://git-scm.com/)
- **Docker** (for backend services) - [Download here](https://www.docker.com/)

## Project Structure

```
Yetify-agent/
├── yetify-backend/     # Backend API service
├── yetify-frontend/    # Frontend Next.js application
└── docs/              # Project documentation
```

## Backend Setup

### 1. Navigate to Backend Directory

```bash
cd yetify-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the `yetify-backend` directory:

```bash
# Copy the example environment file
cp .env.example .env
```

**Note:** If no `.env.example` exists, create a `.env` file with the following variables:

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Database Configuration
DATABASE_URL=your_database_connection_string

# API Keys (add your actual keys)
OPENAI_API_KEY=your_openai_api_key
ALCHEMY_API_KEY=your_alchemy_api_key

# JWT Secret
JWT_SECRET=your_jwt_secret_key
```

### 4. Database Setup

The backend uses Docker for database services. Start the database:

```bash
docker-compose up -d
```

### 5. Run Backend Development Server

```bash
# Development mode with hot reload
npm run dev

# Or build and run
npm run build
npm start
```

The backend will be available at `http://localhost:4000`

## Frontend Setup

### 1. Navigate to Frontend Directory

```bash
cd yetify-frontend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the `yetify-frontend` directory:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:4000

# Environment
NODE_ENV=development
```

### 4. Run Frontend Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Running Both Services

### Option 1: Separate Terminals

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

### Option 2: Using Concurrently (Recommended)

You can run both services simultaneously using the `concurrently` package. Add this to your root `package.json`:

```json
{
  "scripts": {
    "dev": "concurrently \"cd yetify-backend && npm run dev\" \"cd yetify-frontend && npm run dev\"",
    "dev:backend": "cd yetify-backend && npm run dev",
    "dev:frontend": "cd yetify-frontend && npm run dev"
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

- Backend changes will automatically reload when using `npm run dev`
- Frontend changes will hot-reload in the browser
- TypeScript compilation errors will be shown in the terminal

### 2. Testing

Run tests for both services:

**Backend Tests:**
```bash
cd yetify-backend
npm test
```

**Frontend Tests:**
```bash
cd yetify-frontend
npm test
```

### 3. Building for Production

**Backend:**
```bash
cd yetify-backend
npm run build
```

**Frontend:**
```bash
cd yetify-frontend
npm run build
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Backend: Change `PORT` in `.env` file
   - Frontend: Change port in `package.json` scripts or use `-p` flag

2. **Database Connection Issues**
   - Ensure Docker is running
   - Check `docker-compose.yml` configuration
   - Verify database credentials in `.env`

3. **Dependency Issues**
   - Delete `node_modules` and `package-lock.json`
   - Run `npm install` again

4. **TypeScript Errors**
   - Check `tsconfig.json` configuration
   - Ensure all dependencies are properly installed

### Getting Help

- Check the project's README files
- Review the test files for usage examples
- Check the GraphQL schema for API structure
- Review the component files for frontend patterns

## Additional Development Tools

### Code Quality

- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting (if configured)
- **TypeScript**: Type checking and IntelliSense

### Debugging

- **Backend**: Use `console.log` or Node.js debugger
- **Frontend**: Use browser DevTools and React DevTools

## Next Steps

Once you have the development environment set up:

1. Explore the codebase structure
2. Review the existing components and services
3. Check out the test files to understand expected behavior
4. Start implementing your features!

## Support

If you encounter issues not covered in this guide:

1. Check the project's issue tracker
2. Review the project documentation
3. Ask questions in the project's discussion forum

Happy coding! 🚀 