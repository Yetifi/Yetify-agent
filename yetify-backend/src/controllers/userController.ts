import { Request, Response } from 'express';
import { User } from '../utils/database';
import logger from '../utils/logger';

export interface UpdateApiKeysRequest {
  walletAddress: string;
  apiKeys: {
    openRouter?: string;
    groq?: string;
    gemini?: string;
  };
}

export interface GetApiKeysRequest {
  walletAddress: string;
}

export class UserController {
  
  /**
   * Detect wallet type based on address format
   * Supports both Metamask (ETH) and NEAR wallet addresses
   */
  private detectWalletType(walletAddress: string): 'metamask' | 'near' | 'walletconnect' {
    // NEAR wallet addresses end with .near or .testnet
    if (walletAddress.endsWith('.near') || walletAddress.endsWith('.testnet')) {
      return 'near';
    }
    // Ethereum addresses start with 0x and are 42 characters long
    if (walletAddress.startsWith('0x') && walletAddress.length === 42) {
      return 'metamask'; // Could also be walletconnect, but default to metamask
    }
    return 'metamask'; // Default fallback for unknown formats
  }
  
  /**
   * Update user API keys
   * Supports both Metamask and NEAR wallet addresses
   */
  async updateApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress, apiKeys }: UpdateApiKeysRequest = req.body;

      if (!walletAddress) {
        res.status(400).json({ error: 'Wallet address is required' });
        return;
      }

      if (!apiKeys || ((!apiKeys.openRouter) && (!apiKeys.groq) && (!apiKeys.gemini))) {
        res.status(400).json({ error: 'At least one API key is required' });
        return;
      }

      // Detect wallet type based on address format
      const walletType = this.detectWalletType(walletAddress);
      
      // Find or create user
      let user = await User.findOne({ walletAddress });
      
      if (!user) {
        // Create new user if doesn't exist
        user = new User({
          walletAddress,
          walletType,
          apiKeys: {
            openRouter: apiKeys.openRouter,
            groq: apiKeys.groq,
            gemini: apiKeys.gemini
          }
        });
      } else {
        // Update existing user API keys and wallet type
        user.apiKeys = {
          openRouter: apiKeys.openRouter || user.apiKeys?.openRouter,
          groq: apiKeys.groq || user.apiKeys?.groq,
          gemini: apiKeys.gemini || user.apiKeys?.gemini
        };
        // Update wallet type in case it was incorrectly set before
        user.walletType = walletType;
      }

      await user.save();

      logger.info('User API keys updated', { 
        walletAddress: walletAddress.slice(0, 10) + '...',
        hasOpenRouter: !!apiKeys.openRouter,
        hasGroq: !!apiKeys.groq,
        hasGemini: !!apiKeys.gemini
      });

      res.json({
        success: true,
        message: 'API keys updated successfully',
        user: {
          walletAddress: user.walletAddress,
          hasOpenRouter: !!user.apiKeys?.openRouter,
          hasGroq: !!user.apiKeys?.groq,
          hasGemini: !!user.apiKeys?.gemini
        }
      });

    } catch (error) {
      logger.error('Error updating API keys:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get user API keys status (without exposing actual keys)
   */
  async getApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress } = req.params;

      if (!walletAddress) {
        res.status(400).json({ error: 'Wallet address is required' });
        return;
      }

      const user = await User.findOne({ walletAddress });

      if (!user) {
        res.json({
          walletAddress,
          hasOpenRouter: false,
          hasGroq: false,
          hasGemini: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        walletAddress: user.walletAddress,
        hasOpenRouter: !!user.apiKeys?.openRouter,
        hasGroq: !!user.apiKeys?.groq,
        hasGemini: !!user.apiKeys?.gemini
      });

    } catch (error) {
      logger.error('Error getting API keys:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get user API key for internal service usage
   */
  async getUserApiKey(walletAddress: string, keyType: 'openRouter' | 'groq' | 'gemini'): Promise<string | null> {
    try {
      const user = await User.findOne({ walletAddress });
      
      if (!user || !user.apiKeys) {
        return null;
      }

      return user.apiKeys[keyType] || null;

    } catch (error) {
      logger.error('Error getting user API key:', error);
      return null;
    }
  }

  /**
   * Delete user API keys
   */
  async deleteApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress } = req.params;

      if (!walletAddress) {
        res.status(400).json({ error: 'Wallet address is required' });
        return;
      }

      const user = await User.findOne({ walletAddress });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      user.apiKeys = {
        openRouter: undefined,
        groq: undefined,
        gemini: undefined
      };

      await user.save();

      logger.info('User API keys deleted', { 
        walletAddress: walletAddress.slice(0, 10) + '...'
      });

      res.json({
        success: true,
        message: 'API keys deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting API keys:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new UserController();