/* eslint-disable @typescript-eslint/no-explicit-any */
import { setupWalletSelector, WalletSelector } from "@near-wallet-selector/core";
import { setupModal, WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { providers } from 'near-api-js';

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
  private selector: WalletSelector | null = null;
  private modal: WalletSelectorModal | null = null;
  private network: 'testnet' | 'mainnet';
  private initialized = false;
  private stateChangeCallback: ((state: NEARWalletState) => void) | null = null;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.network = network;
    // Don't call initialization in constructor since it's async
    // It will be called when needed
  }

  /**
   * Set callback to be called when wallet state changes
   */
  setStateChangeCallback(callback: (state: NEARWalletState) => void) {
    this.stateChangeCallback = callback;
  }

  /**
   * Handle wallet state changes
   */
  private async handleStateChange() {
    try {
      const newState = await this.getWalletState();
      if (this.stateChangeCallback) {
        this.stateChangeCallback(newState);
      }
    } catch (error) {
      console.error('Error handling state change:', error);
    }
  }

  private async initializeWalletSelector() {
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      this.selector = await setupWalletSelector({
        network: this.network,
        modules: [
          setupMyNearWallet()
        ]
      });
      
      this.modal = setupModal(this.selector, {
        contractId: 'strategy-storage-yetify.testnet'
      });
      
      // Subscribe to wallet state changes
      this.selector.store.observable.subscribe(() => {
        if (this.stateChangeCallback) {
          this.handleStateChange();
        }
      });
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize wallet selector:', error);
      this.initialized = false;
    }
  }

  /**
   * Check if wallet is already connected
   */
  async isWalletConnected(): Promise<boolean> {
    try {
      if (!this.initialized || !this.selector) {
        await this.initializeWalletSelector();
      }
      
      const wallet = await this.selector?.wallet();
      const accounts = await wallet?.getAccounts();
      return !!(accounts && accounts.length > 0);
    } catch {
      return false;
    }
  }

  /**
   * Get currently connected account ID
   */
  async getConnectedAccountId(): Promise<string | null> {
    try {
      if (!this.initialized || !this.selector) {
        await this.initializeWalletSelector();
      }
      
      const wallet = await this.selector?.wallet();
      const accounts = await wallet?.getAccounts();
      return accounts && accounts.length > 0 ? accounts[0].accountId : null;
    } catch {
      return null;
    }
  }

  /**
   * Get wallet state from current connection
   */
  async getWalletState(): Promise<NEARWalletState> {
    if (!this.initialized || !this.selector) {
      await this.initializeWalletSelector();
    }
    
    if (!this.selector) {
      return {
        isConnected: false,
        accountId: null,
        balance: null,
        network: this.network
      };
    }

    try {
      const wallet = await this.selector.wallet();
      const accounts = await wallet.getAccounts();
      const isConnected = accounts && accounts.length > 0;
      const accountId = isConnected ? accounts[0].accountId : null;
      
      let balance = null;
      if (isConnected && accountId) {
        try {
          const provider = new providers.JsonRpcProvider({ 
            url: this.network === 'testnet' 
              ? 'https://rpc.testnet.near.org'
              : 'https://rpc.mainnet.near.org'
          });
          
          const accountBalance = await provider.query({
            request_type: 'view_account',
            finality: 'final',
            account_id: accountId
          }) as any;
          
          const nearAmount = (BigInt(accountBalance.amount) / BigInt('1000000000000000000000000')).toString();
          balance = `${nearAmount} NEAR`;
        } catch (error) {
          console.warn('Failed to get balance:', error);
          balance = '0 NEAR';
        }
      }

      return {
        isConnected,
        accountId,
        balance,
        network: this.network
      };
    } catch {
      return {
        isConnected: false,
        accountId: null,
        balance: null,
        network: this.network
      };
    }
  }

  /**
   * Connect using NEAR Wallet Selector modal
   */
  async connectWithWalletRedirect(): Promise<void> {
    if (!this.initialized || !this.modal) {
      await this.initializeWalletSelector();
    }
    
    if (!this.modal) {
      throw new Error('Failed to initialize wallet selector');
    }

    this.modal.show();
  }

  /**
   * Handle redirect callback from NEAR Wallet
   */
  async handleWalletCallback(): Promise<NEARWalletState | null> {
    const urlParams = new URLSearchParams(window.location.search);
    const transactionHashes = urlParams.get('transactionHashes');
    
    // Check for transaction success callback
    if (transactionHashes) {
      // Clean URL and return null (transaction completed, no wallet state change needed)
      window.history.replaceState({}, document.title, window.location.pathname);
      return null;
    }

    // With Wallet Selector, connection is handled automatically
    // Only return state if there's actually a callback parameter or if we're connected
    const hasCallback = urlParams.has('account_id') || urlParams.has('public_key') || transactionHashes;
    
    if (hasCallback) {
      return await this.getWalletState();
    }
    
    // No callback, return null so normal connection flow continues
    return null;
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(): Promise<void> {
    try {
      if (this.selector) {
        const wallet = await this.selector.wallet();
        await wallet.signOut();
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  }



  /**
   * Store complete strategy on-chain using Wallet Selector
   */
  async storeCompleteStrategy(strategy: any): Promise<string> {
    if (!this.initialized || !this.selector) {
      throw new Error('Wallet selector not initialized');
    }

    const wallet = await this.selector.wallet();
    const accounts = await wallet.getAccounts();
    
    if (!accounts || accounts.length === 0) {
      throw new Error('NEAR wallet not connected. Please connect your wallet first.');
    }

    const senderId = accounts[0].accountId;

    try {
      // Convert strategy object to JSON string for contract call
      const strategyJson = JSON.stringify({
        id: strategy.id,
        goal: strategy.goal,
        chains: strategy.chains || [],
        protocols: strategy.protocols || [],
        steps: (strategy.steps || []).map((step: any) => ({
          action: step.action,
          protocol: step.protocol,
          asset: step.asset,
          expected_apy: step.expectedApy || step.expected_apy,
          amount: step.amount
        })),
        risk_level: strategy.riskLevel || strategy.risk_level || 'medium',
        estimated_apy: strategy.estimatedApy || strategy.estimated_apy,
        estimated_tvl: strategy.estimatedTvl || strategy.estimated_tvl,
        confidence: strategy.confidence,
        reasoning: strategy.reasoning,
        warnings: strategy.warnings,
        creator: senderId,
        created_at: Date.now()
      });

      const contractId = 'strategy-storage-yetify.testnet';
      const methodName = 'store_complete_strategy';
      const args = { strategy_json: strategyJson };
      
      const result = await wallet.signAndSendTransaction({
        receiverId: contractId,
        actions: [
          {
            type: 'FunctionCall',
            params: {
              methodName,
              args,
              gas: '100000000000000',
              deposit: '100000000000000000000000' // 0.1 NEAR in yoctoNEAR
            }
          }
        ]
      });

      return result?.transaction?.hash || 'transaction_signed';
    } catch (error) {
      throw new Error(`Failed to store strategy on blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  /**
   * Get account info from RPC
   */
  async getAccountInfo(accountId: string): Promise<AccountInfo> {
    const provider = new providers.JsonRpcProvider({ 
      url: this.network === 'testnet' 
        ? 'https://rpc.testnet.near.org'
        : 'https://rpc.mainnet.near.org'
    });
    
    const result = await provider.query({
      request_type: 'view_account',
      finality: 'final',
      account_id: accountId
    }) as any;
    
    return {
      account_id: accountId,
      amount: result.amount,
      locked: result.locked,
      code_hash: result.code_hash,
      storage_usage: result.storage_usage
    };
  }

  /**
   * Connect wallet method for compatibility
   */
  async connectWallet(): Promise<NEARWalletState> {
    return this.getWalletState();
  }
}