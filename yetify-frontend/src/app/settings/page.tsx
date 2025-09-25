'use client';

import { useState, useEffect } from 'react';
import SettingsPage from '@/components/SettingsPage';

export default function Settings() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    // Get wallet address from localStorage or Web3 provider
    // This is a simplified implementation - in production you'd use your Web3 context
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      setWalletAddress(savedAddress);
    }
  }, []);

  return <SettingsPage walletAddress={walletAddress} />;
}