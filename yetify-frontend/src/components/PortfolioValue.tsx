'use client';

import { useAccount, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { useEffect, useState } from 'react';

export default function PortfolioValue() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const [ethPrice, setEthPrice] = useState<number | null>(null);

  // Fetch ETH price (simple implementation)
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        setEthPrice(data.ethereum.usd);
      } catch (error) {
        console.error('Failed to fetch ETH price:', error);
        setEthPrice(3000); // Fallback price
      }
    };

    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, 60000); // Update every minute

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