import { Request, Response } from 'express';
import { User } from '../utils/database';
import logger from '../utils/logger';

export interface UpdateApiKeysRequest {
  walletAddress: string;
  apiKeys: {
    openRouter?: string;
    groq?: string;
  };
}

export interface GetApiKeysRequest {
  walletAddress: string;
}

export class UserController {
  
  /**
   * Update user API keys
   */
  async updateApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress, apiKeys }: UpdateApiKeysRequest = req.body;

      if (!walletAddress) {
        res.status(400).json({ error: 'Wallet address is required' });
        return;
      }

      if (!apiKeys || ((!apiKeys.openRouter) && (!apiKeys.groq))) {
        res.status(400).json({ error: 'At least one API key is required' });
        return;
      }

      // Find or create user
      let user = await User.findOne({ walletAddress });
      
      if (!user) {
        // Create new user if doesn't exist
        user = new User({
          walletAddress,
          walletType: 'metamask', // Default, can be updated later
          apiKeys: {
            openRouter: apiKeys.openRouter || null,
            groq: apiKeys.groq || null
          }
        });
      } else {
        // Update existing user
        user.apiKeys = {
          openRouter: apiKeys.openRouter || user.apiKeys?.openRouter || null,
          groq: apiKeys.groq || user.apiKeys?.groq || null
        };
      }

      await user.save();

      logger.info('User API keys updated', { 
        walletAddress: walletAddress.slice(0, 10) + '...',
        hasOpenRouter: !!apiKeys.openRouter,
        hasGroq: !!apiKeys.groq
      });

      res.json({
        success: true,
        message: 'API keys updated successfully',
        user: {
          walletAddress: user.walletAddress,
          hasOpenRouter: !!user.apiKeys?.openRouter,
          hasGroq: !!user.apiKeys?.groq
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
          message: 'User not found'
        });
        return;
      }

      res.json({
        walletAddress: user.walletAddress,
        hasOpenRouter: !!user.apiKeys?.openRouter,
        hasGroq: !!user.apiKeys?.groq
      });

    } catch (error) {
      logger.error('Error getting API keys:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get user API key for internal service usage
   */
  async getUserApiKey(walletAddress: string, keyType: 'openRouter' | 'groq'): Promise<string | null> {
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
        openRouter: null,
        groq: null
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