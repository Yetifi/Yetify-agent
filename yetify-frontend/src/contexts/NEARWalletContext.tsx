'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { NEARWalletService, NEARWalletState } from '../services/NEARWalletService';
import { getSavedStrategies } from '../utils/strategyStorage';

// User creation helper function for both NEAR and ETH wallets
async function createUserIfNeeded(walletAddress: string, walletType: 'near' | 'metamask' = 'near'): Promise<void> {
  try {
    // First check if user already exists to avoid unnecessary API calls
    try {
      const checkResponse = await fetch(`/api/v1/users/${walletAddress}/api-keys`);
      if (checkResponse.ok) {
        return;
      }
    } catch {
      // Ignore check error, proceed with creation
    }
    
    const response = await fetch('/api/v1/users/api-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        apiKeys: { 
          openRouter: undefined,
          groq: undefined 
        } // Empty API keys, user will add them later in settings
      }),
    });

    if (!response.ok) {
      console.warn(`User creation failed for ${walletType}:`, response.status);
    }
  } catch (error) {
    console.error(`User creation error for ${walletType}:`, error);
  }
}

interface NEARWalletContextType {
  nearWallet: NEARWalletState;
  connectNear: () => Promise<void>;
  disconnectNear: () => Promise<void>;
  isConnecting: boolean;
  nearService: NEARWalletService | null;
}

const NEARWalletContext = createContext<NEARWalletContextType | undefined>(undefined);

interface NEARWalletProviderProps {
  children: ReactNode;
}

export function NEARWalletProvider({ children }: NEARWalletProviderProps) {
  const [nearWallet, setNearWallet] = useState<NEARWalletState>({
    isConnected: false,
    accountId: null,
    balance: null,
    network: 'testnet'
  });
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Shared NEAR service instance (only in browser)
  const [nearService] = useState(() => {
    if (typeof window !== 'undefined') {
      const service = new NEARWalletService('testnet');
      // Set up callback for wallet state changes
      service.setStateChangeCallback((newState: NEARWalletState) => {
        setNearWallet(newState);
        
        // Create user if newly connected
        if (newState.isConnected && newState.accountId) {
          createUserIfNeeded(newState.accountId, 'near');
        }
      });
      return service;
    }
    return null;
  });

  // Check for existing connection on mount and URL changes
  useEffect(() => {
    checkExistingConnection();
  }, []);

  // Also check when URL changes (for callback)
  useEffect(() => {
    const handleLocationChange = () => {
      checkExistingConnection();
    };

    // Listen for URL changes
    window.addEventListener('popstate', handleLocationChange);
    
    // Also check on URL parameter changes
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('account_id')) {
      checkExistingConnection();
    }

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const checkExistingConnection = async () => {
    try {
      // Check for NEAR wallet callback first
      const urlParams = new URLSearchParams(window.location.search);
      const accountId = urlParams.get('account_id');
      
      if (accountId) {
        const nearWalletService = new NEARWalletService('testnet');
        const callbackState = await nearWalletService.handleWalletCallback();
        if (callbackState) {
          setNearWallet(callbackState);
          // Create user for NEAR wallet
          if (callbackState.accountId) {
            await createUserIfNeeded(callbackState.accountId, 'near');
          }
        }
        return;
      }

      // Check for existing NEAR connection in localStorage only for UI state
      const nearWalletService = new NEARWalletService('testnet');
      const isConnected = await nearWalletService.isWalletConnected();
      
      if (isConnected) {
        const accountId = await nearWalletService.getConnectedAccountId();
        if (accountId) {
          const walletState = await nearWalletService.connectWallet(accountId);
          setNearWallet(walletState);
          // Do NOT create user automatically - only on manual connection
        }
      }
    } catch (error) {
      console.error('Failed to check existing NEAR wallet connection:', error);
    }
  };

  const connectNear = async () => {
    if (isConnecting || !nearService) {
      return;
    }
    
    try {
      setIsConnecting(true);

      // Check if wallet is already connected
      const isConnected = await nearService.isWalletConnected();
      
      if (isConnected) {
        // Get existing connection state
        const walletState = await nearService.getWalletState();
        setNearWallet(walletState);
        if (walletState.accountId) {
          await createUserIfNeeded(walletState.accountId, 'near');
        }
        return;
      }

      // Check for wallet redirect callback
      const callbackState = await nearService.handleWalletCallback();
      if (callbackState) {
        setNearWallet(callbackState);
        // Create user only on manual connect callback
        if (callbackState.accountId) {
          await createUserIfNeeded(callbackState.accountId, 'near');
        }
        return;
      }

      // Redirect to NEAR wallet for new connection
      await nearService.connectWithWalletRedirect();
      
    } catch (error) {
      console.error('NEAR connection failed:', error);
      alert(`NEAR connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectNear = async () => {
    if (!nearService) return;
    
    try {
      await nearService.disconnectWallet();
      
      setNearWallet({
        isConnected: false,
        accountId: null,
        balance: null,
        network: 'testnet'
      });
      
      console.log('NEAR wallet disconnected');
    } catch (error) {
      console.error('NEAR wallet disconnect failed:', error);
      // Still update UI state even if disconnect fails
      setNearWallet({
        isConnected: false,
        accountId: null,
        balance: null,
        network: 'testnet'
      });
    }
  };

  // Auto-check for wallet callback on page load
  useEffect(() => {
    const checkWalletCallback = async () => {
      if (!nearService) return;
      
      
      try {
        // Check for transaction success first
        const urlParams = new URLSearchParams(window.location.search);
        const transactionHashes = urlParams.get('transactionHashes');
        
        if (transactionHashes) {
          
          // Find the strategy with "redirected_to_wallet" hash and update it
          const strategies = getSavedStrategies();
          const pendingStrategy = strategies.find(s => 
            s.executionHistory?.some(h => h.transactionHash === 'redirected_to_wallet')
          );
          
          if (pendingStrategy) {
            // Update with real transaction hash
            const updatedStrategies = strategies.map(s => {
              if (s.id === pendingStrategy.id) {
                const updatedHistory = s.executionHistory?.map(h => 
                  h.transactionHash === 'redirected_to_wallet' 
                    ? { ...h, transactionHash: transactionHashes }
                    : h
                ) || [];
                return { ...s, executionHistory: updatedHistory };
              }
              return s;
            });
            
            localStorage.setItem('yetify_saved_strategies', JSON.stringify(updatedStrategies));
          }
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        // Handle wallet connection callback if present
        const callbackState = await nearService.handleWalletCallback();
        if (callbackState) {
          setNearWallet(callbackState);
          if (callbackState.accountId) {
            await createUserIfNeeded(callbackState.accountId, 'near');
          }
          return;
        }
        
        // Check existing connection
        const isConnected = await nearService.isWalletConnected();
        if (isConnected) {
          const accountId = await nearService.getConnectedAccountId();
          if (accountId) {
            const walletState = await nearService.connectWallet(accountId);
            setNearWallet(walletState);
            // Do NOT create user automatically - only on manual connection
            return;
          }
        }
        
      } catch (error) {
        console.error('Auto-connection failed:', error);
      }
    };
    
    checkWalletCallback();
  }, [nearService]);

  return (
    <NEARWalletContext.Provider
      value={{
        nearWallet,
        connectNear,
        disconnectNear,
        isConnecting,
        nearService
      }}
    >
      {children}
    </NEARWalletContext.Provider>
  );
}

export function useNEARWallet() {
  const context = useContext(NEARWalletContext);
  if (context === undefined) {
    throw new Error('useNEARWallet must be used within a NEARWalletProvider');
  }
  return context;
}