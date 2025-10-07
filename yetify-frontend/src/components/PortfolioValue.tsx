'use client';

import { useAccount, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { useEffect, useState } from 'react';

export default function PortfolioValue() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const [ethPrice, setEthPrice] = useState<number | null>(null);

  // Fetch ETH price via Next.js API route (avoids CORS)
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('/api/price/eth');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data?.price) {
          setEthPrice(data.price);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.warn('Failed to fetch ETH price, using fallback:', error);
        setEthPrice(3500); // Fallback price
      }
    };

    // Set initial fallback immediately to prevent errors
    setEthPrice(3500);
    
    // Then try to fetch real price
    setTimeout(fetchEthPrice, 1000);
    
    const interval = setInterval(fetchEthPrice, 300000); // Update every 5 minutes

    return () => clearInterval(interval);
  }, []);

  const formatPortfolioValue = (): string => {
    if (!isConnected || !balance || !ethPrice) {
      return '$0.00';
    }

    const ethAmount = parseFloat(formatEther(balance.value));
    const usdValue = ethAmount * ethPrice;

    return `$${usdValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getBalanceText = (): string => {
    if (!isConnected) {
      return 'Connect wallet to view';
    }
    
    if (!balance) {
      return 'Loading...';
    }

    const ethAmount = parseFloat(formatEther(balance.value));
    return `${ethAmount.toFixed(4)} ${balance.symbol}`;
  };

  return (
    <div className="text-sm text-gray-300">
      <div>
        Total Portfolio: <span className="font-semibold text-white">{formatPortfolioValue()}</span>
      </div>
      {isConnected && balance && (
        <div className="text-xs text-gray-400 mt-1">
          {getBalanceText()}
        </div>
      )}
    </div>
  );
}