'use client';

import { useState, useEffect } from 'react';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  walletType: 'metamask' | 'near' | 'walletconnect' | null;
}

export default function WalletConnection() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
    walletType: null
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const connectMetaMask = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        setIsConnecting(true);
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        
        const balance = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [accounts[0], 'latest'],
        });

        // Convert balance from wei to ETH (simplified)
        const ethBalance = (parseInt(balance, 16) / Math.pow(10, 18)).toFixed(4);

        setWalletState({
          isConnected: true,
          address: accounts[0],
          balance: `${ethBalance} ETH`,
          walletType: 'metamask'
        });
        setShowModal(false);
      } catch (error) {
        console.error('MetaMask connection failed:', error);
      } finally {
        setIsConnecting(false);
      }
    } else {
      alert('MetaMask not detected. Please install MetaMask extension.');
    }
  };

  const connectNear = async () => {
    try {
      setIsConnecting(true);
      // Simulate NEAR connection - In production, use @near-wallet-selector/core
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setWalletState({
        isConnected: true,
        address: 'user.near',
        balance: '125.43 NEAR',
        walletType: 'near'
      });
      setShowModal(false);
    } catch (error) {
      console.error('NEAR connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWalletConnect = async () => {
    try {
      setIsConnecting(true);
      // Simulate WalletConnect - In production, use @walletconnect/web3-provider
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setWalletState({
        isConnected: true,
        address: '0x742d35Cc6097C8f4f5b2E3894C5B6545AE2A1234',
        balance: '45.23 ETH',
        walletType: 'walletconnect'
      });
      setShowModal(false);
    } catch (error) {
      console.error('WalletConnect failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setWalletState({
      isConnected: false,
      address: null,
      balance: null,
      walletType: null
    });
  };

  const formatAddress = (address: string) => {
    if (address.includes('.near')) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getWalletIcon = (type: string) => {
    switch (type) {
      case 'metamask':
        return '🦊';
      case 'near':
        return '🌕';
      case 'walletconnect':
        return '🔗';
      default:
        return '💳';
    }
  };

  if (walletState.isConnected) {
    return (
      <div className="flex items-center space-x-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getWalletIcon(walletState.walletType!)}</span>
          <div>
            <div className="text-sm font-medium text-green-800">
              {formatAddress(walletState.address!)}
            </div>
            <div className="text-xs text-green-600">
              {walletState.balance}
            </div>
          </div>
        </div>
        <button
          onClick={disconnect}
          className="text-xs text-green-700 hover:text-green-900 font-medium"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
      >
        Connect Wallet
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Connect Wallet</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={connectMetaMask}
                disabled={isConnecting}
                className="w-full flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <span className="text-2xl">🦊</span>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">MetaMask</div>
                  <div className="text-sm text-gray-500">Connect using browser extension</div>
                </div>
                {isConnecting && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
              </button>

              <button
                onClick={connectNear}
                disabled={isConnecting}
                className="w-full flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <span className="text-2xl">🌕</span>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">NEAR Wallet</div>
                  <div className="text-sm text-gray-500">Connect to NEAR Protocol</div>
                </div>
                {isConnecting && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
              </button>

              <button
                onClick={connectWalletConnect}
                disabled={isConnecting}
                className="w-full flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <span className="text-2xl">🔗</span>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">WalletConnect</div>
                  <div className="text-sm text-gray-500">Connect via QR code</div>
                </div>
                {isConnecting && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
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

declare global {
  interface Window {
    ethereum?: any;
  }
}
