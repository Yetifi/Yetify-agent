/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserLocalStorageKeyStore } from '@near-js/keystores-browser';
import { KeyPair } from '@near-js/crypto';
import { 
  getSignerFromKeystore, 
  getTestnetRpcProvider,
  getMainnetRpcProvider,
  view,
  transfer
} from '@near-js/client';

export interface NEARWalletState {
  isConnected: boolean;
  accountId: string | null;
  balance: string | null;
  network: 'testnet' | 'mainnet';
}

export interface AccountInfo {
  account_id: string;
  amount: string;
  locked: string;
  code_hash: string;
  storage_usage: number;
}

export class NEARWalletService {
  private keystore: BrowserLocalStorageKeyStore;
  private signer: any;
  private rpcProvider: any;
  private network: 'testnet' | 'mainnet';

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.network = network;
    this.keystore = new BrowserLocalStorageKeyStore();
    // Use alternative RPC to avoid rate limits
    this.rpcProvider = {
      query: async (params: any) => {
        const rpcUrl = network === 'testnet' 
          ? 'https://archival-rpc.testnet.near.org'
          : 'https://archival-rpc.mainnet.near.org';
        
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'query',
            params
          })
        });
        
        const result = await response.json();
        if (result.error) throw new Error(result.error.message);
        return result.result;
      }
    };
  }

  /**
   * Check if wallet is already connected
   */
  async isWalletConnected(): Promise<boolean> {
    try {
      // Check if any keys exist in localStorage for this network
      const accounts = await this.keystore.getAccounts(this.network);
      return accounts.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get currently connected account ID
   */
  async getConnectedAccountId(): Promise<string | null> {
    try {
      const accounts = await this.keystore.getAccounts(this.network);
      return accounts.length > 0 ? accounts[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Connect to NEAR wallet using account ID
   */
  async connectWallet(accountId: string): Promise<NEARWalletState> {
    try {
      // Validate account ID format
      if (!this.isValidAccountId(accountId)) {
        throw new Error('Invalid account ID format');
      }

      // Check if account exists on the network
      const accountInfo = await this.getAccountInfo(accountId);
      
      // Create signer for this account
      this.signer = getSignerFromKeystore(accountId, this.network, this.keystore);
      
      // Format balance
      const balance = this.formatNearAmount(accountInfo.amount);

      const walletState: NEARWalletState = {
        isConnected: true,
        accountId,
        balance: `${balance} NEAR`,
        network: this.network
      };

      return walletState;
    } catch (error) {
      console.error('NEAR wallet connection failed:', error);
      throw new Error(`Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Connect using NEAR Wallet redirect flow (for new users)
   */
  async connectWithWalletRedirect(contractId?: string): Promise<void> {
    const walletUrl = this.network === 'testnet' 
      ? 'https://testnet.mynearwallet.com'
      : 'https://app.mynearwallet.com';

    const currentUrl = window.location.origin;
    const redirectUrl = `${walletUrl}/login/?success_url=${encodeURIComponent(currentUrl)}&failure_url=${encodeURIComponent(currentUrl)}`;
    
    if (contractId) {
      window.location.href = `${redirectUrl}&contract_id=${contractId}`;
    } else {
      window.location.href = redirectUrl;
    }
  }

  /**
   * Handle redirect callback from NEAR Wallet
   */
  async handleWalletCallback(): Promise<NEARWalletState | null> {
    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get('account_id');
    const publicKey = urlParams.get('public_key') || urlParams.get('all_keys');

    console.log('🔧 NEARWalletService: Callback params:', { 
      accountId, 
      publicKey: publicKey?.substring(0, 20) + '...', 
      allParams: Object.fromEntries(urlParams.entries()) 
    });

    if (accountId && publicKey) {
      try {
        console.log('Processing NEAR wallet callback:', { accountId, publicKey: publicKey.substring(0, 20) + '...' });
        
        // Clean up URL FIRST to prevent redirect loop
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Create and store a keypair in localStorage for this account
        // This simulates a successful wallet connection
        try {
          // Create a dummy keypair for the account (in production this would be handled properly)
          const keyPair = KeyPair.fromRandom('ed25519');
          await this.keystore.setKey(this.network, accountId, keyPair);
          console.log('Stored keypair for account:', accountId);
        } catch (keystoreError) {
          console.warn('Failed to store keypair, continuing anyway:', keystoreError);
        }
        
        // Get account info and create wallet state
        console.log('🔧 NEARWalletService: Getting account info for:', accountId);
        const accountInfo = await this.getAccountInfo(accountId);
        console.log('🔧 NEARWalletService: Account info received:', accountInfo);
        const balance = this.formatNearAmount(accountInfo.amount);
        
        const walletState: NEARWalletState = {
          isConnected: true,
          accountId,
          balance: `${balance} NEAR`,
          network: this.network
        };
        
        return walletState;
      } catch (error) {
        console.error('❌ NEARWalletService: Failed to handle NEAR wallet callback:', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          accountId,
          publicKey: publicKey?.substring(0, 20) + '...'
        });
        // Clean URL even on error
        window.history.replaceState({}, document.title, window.location.pathname);
        return null;
      }
    }

    return null;
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(): Promise<void> {
    try {
      const accountId = await this.getConnectedAccountId();
      if (accountId) {
        await this.keystore.removeKey(this.network, accountId);
      }
      this.signer = null;
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  }

  /**
   * Get account information from NEAR network
   */
  async getAccountInfo(accountId: string): Promise<AccountInfo> {
    try {
      const response = await this.rpcProvider.query({
        request_type: 'view_account',
        finality: 'final',
        account_id: accountId,
      });
      return response as AccountInfo;
    } catch {
      throw new Error(`Account ${accountId} does not exist on ${this.network}`);
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string): Promise<string> {
    try {
      const accountInfo = await this.getAccountInfo(accountId);
      return this.formatNearAmount(accountInfo.amount);
    } catch {
      throw new Error(`Failed to get balance for ${accountId}`);
    }
  }

  /**
   * Send NEAR tokens
   */
  async sendNear(receiverId: string, amount: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const senderId = await this.getConnectedAccountId();
    if (!senderId) {
      throw new Error('No connected account');
    }

    try {
      const amountInYocto = this.parseNearAmount(amount);
      
      const result = await transfer({
        sender: senderId,
        receiver: receiverId,
        amount: BigInt(amountInYocto),
        deps: {
          rpcProvider: this.rpcProvider,
          signer: this.signer,
        }
      });

      return result.outcome.transaction.hash;
    } catch (error) {
      throw new Error(`Failed to send NEAR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call a view method on a smart contract
   */
  async callViewMethod<T>(
    contractId: string, 
    methodName: string, 
    args: Record<string, unknown> = {}
  ): Promise<T> {
    try {
      const result = await view({
        account: contractId,
        method: methodName,
        args,
        deps: { rpcProvider: this.rpcProvider }
      });
      return result as T;
    } catch (error) {
      throw new Error(`Failed to call view method: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store strategy on-chain using server-side call
   */
  async storeStrategy(id: string, goal: string): Promise<string> {
    try {
      console.log('Attempting to store strategy on NEAR blockchain:', {
        contractId: 'strategy-v2.testnet',
        signerAccount: 'strategy-storage-yetify.testnet',
        method: 'store_strategy',
        args: { id, goal }
      });

      // Call our backend API to handle the NEAR transaction
      const response = await fetch('/api/store-strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, goal }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API call failed: ${error}`);
      }

      const result = await response.json();
      
      // Even if contract call failed, we got a transaction hash
      if (result.transactionHash) {
        return result.transactionHash;
      }
      
      throw new Error(result.error || 'Unknown error');
    } catch (error) {
      console.error('Failed to store strategy:', error);
      throw new Error(`Failed to store strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store complete strategy on-chain using server-side call
   */
  async storeCompleteStrategy(strategy: any): Promise<string> {
    try {
      console.log('Attempting to store complete strategy on NEAR blockchain:', {
        contractId: 'strategy-storage-yetify.testnet',
        method: 'store_complete_strategy',
        strategyData: strategy
      });

      // Call our backend API to handle the NEAR transaction
      const response = await fetch('/api/store-complete-strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strategy }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API call failed: ${error}`);
      }

      const result = await response.json();
      
      // Even if contract call failed, we got a transaction hash
      if (result.transactionHash) {
        return result.transactionHash;
      }
      
      throw new Error(result.error || 'Unknown error');
    } catch (error) {
      console.error('Failed to store complete strategy:', error);
      throw new Error(`Failed to store complete strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * Validate NEAR account ID format
   */
  private isValidAccountId(accountId: string): boolean {
    // NEAR account ID validation - supports .near, .testnet, and mainnet implicit accounts
    const nearAccountRegex = /^[a-z0-9._-]+\.(near|testnet)$|^[a-f0-9]{64}$/;
    return nearAccountRegex.test(accountId);
  }

  /**
   * Format yoctoNEAR to NEAR
   */
  private formatNearAmount(yoctoNear: string): string {
    const nearAmount = BigInt(yoctoNear) / BigInt('1000000000000000000000000');
    return nearAmount.toString();
  }

  /**
   * Parse NEAR amount to yoctoNEAR
   */
  private parseNearAmount(nearAmount: string): string {
    const yoctoNear = BigInt(Math.floor(parseFloat(nearAmount) * 1000000)) * BigInt('1000000000000000000');
    return yoctoNear.toString();
  }

  /**
   * Get current network
   */
  getNetwork(): 'testnet' | 'mainnet' {
    return this.network;
  }

  /**
   * Switch network (requires reconnection)
   */
  switchNetwork(network: 'testnet' | 'mainnet'): NEARWalletService {
    return new NEARWalletService(network);
  }

  /**
   * Check if running in browser environment
   */
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }
}