'use client';

import { useState, useEffect } from 'react';
import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { formatEther } from 'viem';

interface NEARWalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
}

export default function WalletConnection() {
  // Wagmi hooks for Ethereum wallets
  const { address, isConnected, chain } = useAccount();
  const { data: balance } = useBalance({ address });
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();

  // NEAR wallet state
  const [nearWallet, setNearWallet] = useState<NEARWalletState>({
    isConnected: false,
    address: null,
    balance: null
  });

  const [showNearModal, setShowNearModal] = useState(false);
  const [isConnectingNear, setIsConnectingNear] = useState(false);

  const connectNear = async () => {
    try {
      setIsConnectingNear(true);
      
      // Import NEAR wallet service dynamically to avoid SSR issues
      const { NEARWalletService } = await import('../services/NEARWalletService');
      const nearWalletService = new NEARWalletService('testnet');

      // Check if wallet is already connected
      const isConnected = await nearWalletService.isWalletConnected();
      
      if (isConnected) {
        // Get existing connection
        const accountId = await nearWalletService.getConnectedAccountId();
        if (accountId) {
          const walletState = await nearWalletService.connectWallet(accountId);
          setNearWallet({
            isConnected: walletState.isConnected,
            address: walletState.accountId,
            balance: walletState.balance
          });
          setShowNearModal(false);
          return;
        }
      }

      // Check for wallet redirect callback
      const callbackState = await nearWalletService.handleWalletCallback();
      if (callbackState) {
        setNearWallet({
          isConnected: callbackState.isConnected,
          address: callbackState.accountId,
          balance: callbackState.balance
        });
        setShowNearModal(false);
        return;
      }

      // Redirect to NEAR wallet for new connection
      await nearWalletService.connectWithWalletRedirect();
      
    } catch (error) {
      console.error('NEAR connection failed:', error);
      alert(`NEAR connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnectingNear(false);
    }
  };

  // Check for existing NEAR wallet connection on component mount
  useEffect(() => {
    const checkExistingNearConnection = async () => {
      try {
        // Check for NEAR wallet callback first
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('account_id')) {
          await connectNear();
          return;
        }

        // Check for existing NEAR connection
        const { NEARWalletService } = await import('../services/NEARWalletService');
        const nearWalletService = new NEARWalletService('testnet');
        const isConnected = await nearWalletService.isWalletConnected();
        
        if (isConnected) {
          const accountId = await nearWalletService.getConnectedAccountId();
          if (accountId) {
            const walletState = await nearWalletService.connectWallet(accountId);
            setNearWallet({
              isConnected: walletState.isConnected,
              address: walletState.accountId,
              balance: walletState.balance
            });
          }
        }
      } catch (error) {
        console.error('Failed to check existing NEAR wallet connection:', error);
      }
    };

    checkExistingNearConnection();
  }, []);

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

  const disconnectNearWallet = async () => {
    try {
      // Disconnect NEAR wallet
      const { NEARWalletService } = await import('../services/NEARWalletService');
      const nearWalletService = new NEARWalletService('testnet');
      await nearWalletService.disconnectWallet();
      
      setNearWallet({
        isConnected: false,
        address: null,
        balance: null
      });
    } catch (error) {
      console.error('NEAR wallet disconnect failed:', error);
      // Still update UI state even if disconnect fails
      setNearWallet({
        isConnected: false,
        address: null,
        balance: null
      });
    }
  };

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
        {nearWallet.isConnected && nearWallet.address && (
          <div className="flex items-center space-x-3 border border-green-200 bg-green-50 text-green-800 rounded-lg px-4 py-2">
            <div className="flex items-center space-x-2">
              <div>
                <div className="text-sm font-medium">
                  NEAR - {formatAddress(nearWallet.address)}
                </div>
                <div className="text-xs opacity-75">
                  {nearWallet.balance || '0 NEAR'}
                </div>
              </div>
            </div>
            <button
              onClick={disconnectNearWallet}
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
    <>
      <div className="flex items-center space-x-2">
        <button
          onClick={connectEthereumWallet}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          Connect Ethereum
        </button>
        
        <button
          onClick={() => setShowNearModal(true)}
          className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:from-green-700 hover:to-teal-700 transition-all"
        >
          Connect NEAR
        </button>
      </div>

      {showNearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Connect NEAR Wallet</h3>
              <button
                onClick={() => setShowNearModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={connectNear}
                disabled={isConnectingNear}
                className="w-full flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <span className="text-lg font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">N</span>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">NEAR Wallet</div>
                  <div className="text-sm text-gray-500">Connect to NEAR Protocol</div>
                </div>
                {isConnectingNear && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                By connecting a wallet, you agree to our{' '}
                <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}