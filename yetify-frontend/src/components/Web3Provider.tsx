'use client';

import { WagmiProvider, useAccount, createConfig, http } from 'wagmi';
import { mainnet, sepolia, polygon } from 'wagmi/chains';
import { metaMask, injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect } from 'react';
import { NEARWalletProvider } from '../contexts/NEARWalletContext';

// Simple wagmi config without any external services
const config = createConfig({
  chains: [mainnet, sepolia, polygon],
  connectors: [
    metaMask(),
    injected(), // Fallback for other wallets
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
  },
});

const queryClient = new QueryClient();

// User creation helper function for ETH wallets
async function createUserIfNeeded(walletAddress: string, walletType: 'near' | 'metamask'): Promise<void> {
  try {
    console.log(`🔧 Web3Provider: Creating/updating ${walletType} user for:`, walletAddress);
    
    // First check if user already exists to avoid unnecessary API calls
    try {
      const checkResponse = await fetch(`/api/v1/users/${walletAddress}/api-keys`);
      if (checkResponse.ok) {
        console.log('✅ Web3Provider: User already exists, skipping creation');
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

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Web3Provider: ${walletType} user created/updated successfully:`, result);
    } else {
      console.warn(`⚠️ Web3Provider: ${walletType} user creation failed:`, response.status);
    }
  } catch (error) {
    console.error(`❌ Web3Provider: ${walletType} user creation error:`, error);
  }
}

// Component to handle manual ETH wallet connections
function EthWalletHandler() {
  const { address, isConnected } = useAccount();

  useEffect(() => {
    // Only create user on manual connection (when user clicks connect)
    // This will trigger when Web3Modal connection is established
    if (address && isConnected) {
      // Add a small delay to ensure this is from manual connection
      const timer = setTimeout(() => {
        createUserIfNeeded(address, 'metamask');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [address, isConnected]);

  return null;
}

interface Web3ProviderProps {
  children: ReactNode;
}

export default function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <EthWalletHandler />
        <NEARWalletProvider>
          {children}
        </NEARWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}