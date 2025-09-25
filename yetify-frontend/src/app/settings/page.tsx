'use client';

import { useAccount } from 'wagmi';
import { useNEARWallet } from '@/contexts/NEARWalletContext';
import SettingsPage from '@/components/SettingsPage';
import Layout from '@/components/Layout';

export default function Settings() {
  // Get wallet address from Web3 providers
  const { address: ethAddress } = useAccount();
  const { nearWallet } = useNEARWallet();
  
  // Prioritize NEAR wallet, fallback to ETH wallet
  const walletAddress = nearWallet.accountId || ethAddress || null;

  console.log('🔧 Settings: Wallet addresses detected:', {
    nearAddress: nearWallet.accountId,
    ethAddress,
    selectedAddress: walletAddress
  });

  return (
    <Layout>
      <SettingsPage walletAddress={walletAddress} />
    </Layout>
  );
}