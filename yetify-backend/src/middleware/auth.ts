import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { User } from '../utils/database';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    walletAddress: string;
    walletType: string;
    isAdmin?: boolean;
  };
}

export interface JWTPayload {
  userId: string;
  walletAddress: string;
  walletType: string;
  iat: number;
  exp: number;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
      return;
    }

    const decoded = verifyToken(token);
    const user = await validateUser(decoded.userId);
    
    if (!user) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid user'
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      walletAddress: user.walletAddress,
      walletType: user.walletType,
      isAdmin: user.walletAddress === process.env.ADMIN_WALLET_ADDRESS
    };

    // Update last active timestamp
    await User.findByIdAndUpdate(user._id, { lastActive: new Date() });

    logger.security('User authenticated', {
      userId: req.user.id,
      walletAddress: req.user.walletAddress,
      endpoint: req.path
    });

    next();
  } catch (error) {
    logger.security('Authentication failed', {
      error: (error as Error).message,
      endpoint: req.path,
      ip: req.ip
    });

    res.status(401).json({
      error: 'Authentication failed',
      message: (error as Error).message
    });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const decoded = verifyToken(token);
      const user = await validateUser(decoded.userId);
      
      if (user) {
        req.user = {
          id: user._id.toString(),
          walletAddress: user.walletAddress,
          walletType: user.walletType,
          isAdmin: user.walletAddress === process.env.ADMIN_WALLET_ADDRESS
        };
      }
    }

    next();
  } catch (error) {
    // For optional auth, continue without user if token is invalid
    logger.warn('Optional auth failed, continuing without user', (error as Error).message);
    next();
  }
};

export const adminOnly = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isAdmin) {
    logger.security('Admin access denied', {
      userId: req.user?.id,
      endpoint: req.path
    });

    res.status(403).json({
      error: 'Access denied',
      message: 'Admin privileges required'
    });
    return;
  }

  next();
};

export const generateToken = (user: any): string => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user._id.toString(),
    walletAddress: user.walletAddress,
    walletType: user.walletType
  };

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  
  return jwt.sign(payload, jwtSecret, {
    expiresIn: '7d',
    issuer: 'yetify-backend',
    audience: 'yetify-frontend'
  });
};

export const refreshToken = async (token: string): Promise<string> => {
  try {
    const decoded = verifyToken(token);
    const user = await validateUser(decoded.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return generateToken(user);
  } catch (error) {
    throw new Error('Token refresh failed: ' + (error as Error).message);
  }
};

export const revokeToken = async (token: string): Promise<void> => {
  // In production, add token to blacklist in Redis
  // For now, just log the revocation
  logger.security('Token revoked', { token: token.substring(0, 20) + '...' });
};

const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Also check for token in cookies
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    return cookieToken;
  }
  
  return null;
};

const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
  } catch (error) {
    if ((error as any).name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if ((error as any).name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
};

const validateUser = async (userId: string): Promise<any> => {
  try {
    const user = await User.findById(userId);
    return user;
  } catch (error) {
    logger.error('User validation failed:', error);
    return null;
  }
};

// Wallet signature verification for Web3 authentication
export const verifyWalletSignature = (
  walletAddress: string,
  signature: string,
  message: string,
  walletType: 'metamask' | 'near' | 'walletconnect'
): boolean => {
  try {
    switch (walletType) {
      case 'metamask':
      case 'walletconnect':
        return verifyEthereumSignature(walletAddress, signature, message);
      case 'near':
        return verifyNearSignature(walletAddress, signature, message);
      default:
        return false;
    }
  } catch (error) {
    logger.error('Signature verification failed:', error);
    return false;
  }
};

const verifyEthereumSignature = (
  walletAddress: string,
  signature: string,
  message: string
): boolean => {
  // Mock verification - in production, use ethers.js to verify signature
  // const recoveredAddress = ethers.utils.verifyMessage(message, signature);
  // return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  
  // For demo purposes, return true if basic format checks pass
  return signature.length > 100 && walletAddress.startsWith('0x');
};

const verifyNearSignature = (
  walletAddress: string,
  signature: string,
  message: string
): boolean => {
  // Mock verification - in production, use NEAR SDK to verify signature
  // For demo purposes, return true if basic format checks pass
  return signature.length > 50 && walletAddress.endsWith('.near');
};

// Rate limiting by user
export const createUserRateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userId = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    
    const userRequests = requests.get(userId);
    
    if (!userRequests || now > userRequests.resetTime) {
      requests.set(userId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }
    
    if (userRequests.count >= maxRequests) {
      logger.security('Rate limit exceeded', {
        userId,
        count: userRequests.count,
        endpoint: req.path
      });

      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
      });
      return;
    }
    
    userRequests.count++;
    next();
  };
};

export default authMiddleware;
