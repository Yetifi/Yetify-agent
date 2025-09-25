'use client';

import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { formatEther } from 'viem';
import { useEffect } from 'react';
import { useNEARWallet } from '../contexts/NEARWalletContext';

// User creation helper function for ETH wallets
async function createUserIfNeeded(walletAddress: string, walletType: 'near' | 'metamask'): Promise<void> {
  try {
    console.log(`🔧 WalletConnection: Creating/updating ${walletType} user for:`, walletAddress);
    
    // First check if user already exists to avoid unnecessary API calls
    try {
      const checkResponse = await fetch(`/api/v1/users/${walletAddress}/api-keys`);
      if (checkResponse.ok) {
        console.log('✅ WalletConnection: User already exists, skipping creation');
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
      console.log(`✅ WalletConnection: ${walletType} user created/updated successfully:`, result);
    } else {
      console.warn(`⚠️ WalletConnection: ${walletType} user creation failed:`, response.status);
    }
  } catch (error) {
    console.error(`❌ WalletConnection: ${walletType} user creation error:`, error);
  }
}

export default function WalletConnection() {
  // Wagmi hooks for Ethereum wallets
  const { address, isConnected, chain } = useAccount();
  const { data: balance } = useBalance({ address });
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();

  // NEAR wallet from context
  const { nearWallet, connectNear, disconnectNear, isConnecting } = useNEARWallet();

  // Debug NEAR wallet state
  console.log('🔍 WalletConnection - NEAR wallet state:', nearWallet);
  console.log('🔍 WalletConnection - isConnecting:', isConnecting);

  // Create user when ETH wallet connects
  useEffect(() => {
    if (address && isConnected) {
      console.log('🔧 WalletConnection: ETH wallet connected, creating user for:', address);
      createUserIfNeeded(address, 'metamask');
    }
  }, [address, isConnected]);

  // Open Web3Modal for Ethereum wallet connections
  const connectEthereumWallet = async () => {
    try {
      await open();
    } catch (error) {
      console.error('Ethereum wallet connection failed:', error);
    }
  };

  const disconnectEthereumWallet = async () => {
    try {
      disconnect();
    } catch (error) {
      console.error('Ethereum wallet disconnect failed:', error);
    }
  };

  // disconnectNearWallet is now handled by context

  const formatAddress = (address: string) => {
    if (address.includes('.near')) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getChainName = (chainId: number | undefined) => {
    switch (chainId) {
      case 1: return 'Ethereum';
      case 11155111: return 'Sepolia';
      case 137: return 'Polygon';
      default: return 'Unknown';
    }
  };

  // Show connected wallets
  if (isConnected || nearWallet.isConnected) {
    return (
      <div className="flex items-center space-x-2">
        {/* Ethereum Wallet */}
        {isConnected && address && (
          <div className="flex items-center space-x-3 border border-blue-200 bg-blue-50 text-blue-800 rounded-lg px-4 py-2">
            <div className="flex items-center space-x-2">
              <div>
                <div className="text-sm font-medium">
                  {getChainName(chain?.id)} - {formatAddress(address)}
                </div>
                <div className="text-xs opacity-75">
                  {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ${balance.symbol}` : '0 ETH'}
                </div>
              </div>
            </div>
            <button
              onClick={disconnectEthereumWallet}
              className="text-xs hover:opacity-80 font-medium"
            >
              Disconnect
            </button>
          </div>
        )}
        
        {/* NEAR Wallet */}
        {nearWallet.isConnected && nearWallet.accountId && (
          <div className="flex items-center space-x-3 border border-green-200 bg-green-50 text-green-800 rounded-lg px-4 py-2">
            <div className="flex items-center space-x-2">
              <div>
                <div className="text-sm font-medium">
                  NEAR - {formatAddress(nearWallet.accountId)}
                </div>
                <div className="text-xs opacity-75">
                  {nearWallet.balance || '0 NEAR'}
                </div>
              </div>
            </div>
            <button
              onClick={disconnectNear}
              className="text-xs hover:opacity-80 font-medium"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex space-x-3">
      <button
        onClick={connectEthereumWallet}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
      >
        Connect Ethereum
      </button>

      <button
        onClick={connectNear}
        disabled={isConnecting}
        className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:from-green-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConnecting ? 'Connecting...' : 'Connect NEAR'}
      </button>
    </div>
  );
}