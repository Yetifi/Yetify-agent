'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { NEARWalletService, NEARWalletState } from '../services/NEARWalletService';

// User creation helper function for both NEAR and ETH wallets
async function createUserIfNeeded(walletAddress: string, walletType: 'near' | 'metamask' = 'near'): Promise<void> {
  try {
    console.log(`🔧 NEARWalletContext: Creating/updating ${walletType} user for:`, walletAddress);
    
    // First check if user already exists to avoid unnecessary API calls
    try {
      const checkResponse = await fetch(`/api/v1/users/${walletAddress}/api-keys`);
      if (checkResponse.ok) {
        console.log('✅ NEARWalletContext: User already exists, skipping creation');
        return;
      }
    } catch (checkError) {
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

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ NEARWalletContext: ${walletType} user created/updated successfully:`, result);
    } else {
      console.warn(`⚠️ NEARWalletContext: ${walletType} user creation failed:`, response.status);
    }
  } catch (error) {
    console.error(`❌ NEARWalletContext: ${walletType} user creation error:`, error);
  }
}

interface NEARWalletContextType {
  nearWallet: NEARWalletState;
  connectNear: () => Promise<void>;
  disconnectNear: () => Promise<void>;
  isConnecting: boolean;
}

const NEARWalletContext = createContext<NEARWalletContextType | undefined>(undefined);

interface NEARWalletProviderProps {
  children: ReactNode;
}

export function NEARWalletProvider({ children }: NEARWalletProviderProps) {
  console.log('🔥 NEARWalletProvider: Provider initialized');
  const [nearWallet, setNearWallet] = useState<NEARWalletState>({
    isConnected: false,
    accountId: null,
    balance: null,
    network: 'testnet'
  });
  const [isConnecting, setIsConnecting] = useState(false);
  
  console.log('🔥 NEARWalletProvider: Current state:', nearWallet);

  // Check for existing connection on mount and URL changes
  useEffect(() => {
    console.log('NEARWalletContext: Component mounted or URL changed, checking connection...');
    checkExistingConnection();
  }, []);

  // Also check when URL changes (for callback)
  useEffect(() => {
    const handleLocationChange = () => {
      console.log('NEARWalletContext: URL changed, rechecking connection...');
      checkExistingConnection();
    };

    // Listen for URL changes
    window.addEventListener('popstate', handleLocationChange);
    
    // Also check on URL parameter changes
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('account_id')) {
      console.log('NEARWalletContext: Account ID detected in URL, processing callback...');
      checkExistingConnection();
    }

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const checkExistingConnection = async () => {
    try {
      console.log('NEARWalletContext: checkExistingConnection started');
      // Check for NEAR wallet callback first
      const urlParams = new URLSearchParams(window.location.search);
      const accountId = urlParams.get('account_id');
      console.log('NEARWalletContext: URL params check:', { accountId, url: window.location.href });
      
      if (accountId) {
        console.log('NEARWalletContext: Detecting NEAR wallet callback...', accountId);
        const nearWalletService = new NEARWalletService('testnet');
        const callbackState = await nearWalletService.handleWalletCallback();
        if (callbackState) {
          console.log('NEARWalletContext: NEAR wallet callback processed:', callbackState);
          setNearWallet(callbackState);
          // Create user for NEAR wallet
          if (callbackState.accountId) {
            await createUserIfNeeded(callbackState.accountId, 'near');
          }
        } else {
          console.log('NEARWalletContext: Callback processing returned null');
        }
        return;
      }

      // Check for existing NEAR connection
      const nearWalletService = new NEARWalletService('testnet');
      const isConnected = await nearWalletService.isWalletConnected();
      
      if (isConnected) {
        const accountId = await nearWalletService.getConnectedAccountId();
        if (accountId) {
          const walletState = await nearWalletService.connectWallet(accountId);
          setNearWallet(walletState);
          // Create user for existing NEAR wallet connection
          await createUserIfNeeded(accountId, 'near');
          console.log('Existing NEAR wallet connection restored:', walletState);
        }
      }
    } catch (error) {
      console.error('Failed to check existing NEAR wallet connection:', error);
    }
  };

  const connectNear = async () => {
    if (isConnecting) return;
    
    try {
      console.log('🚀 NEARWalletContext: connectNear started');
      setIsConnecting(true);
      
      const nearWalletService = new NEARWalletService('testnet');

      // Check if wallet is already connected
      const isConnected = await nearWalletService.isWalletConnected();
      
      if (isConnected) {
        // Get existing connection
        const accountId = await nearWalletService.getConnectedAccountId();
        if (accountId) {
          const walletState = await nearWalletService.connectWallet(accountId);
          console.log('✅ NEARWalletContext: Updating state with existing connection:', walletState);
          setNearWallet(walletState);
          console.log('NEAR wallet already connected:', walletState);
          return;
        }
      }

      // Check for wallet redirect callback
      const callbackState = await nearWalletService.handleWalletCallback();
      if (callbackState) {
        console.log('✅ NEARWalletContext: Updating state with callback result:', callbackState);
        setNearWallet(callbackState);
        console.log('NEAR wallet callback handled:', callbackState);
        return;
      }

      // Redirect to NEAR wallet for new connection
      console.log('Redirecting to NEAR wallet...');
      await nearWalletService.connectWithWalletRedirect();
      
    } catch (error) {
      console.error('NEAR connection failed:', error);
      alert(`NEAR connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectNear = async () => {
    try {
      const nearWalletService = new NEARWalletService('testnet');
      await nearWalletService.disconnectWallet();
      
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

  return (
    <NEARWalletContext.Provider
      value={{
        nearWallet,
        connectNear,
        disconnectNear,
        isConnecting
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