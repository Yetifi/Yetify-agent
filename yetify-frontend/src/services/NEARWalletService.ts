/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserLocalStorageKeyStore } from '@near-js/keystores-browser';
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
    this.rpcProvider = network === 'testnet' 
      ? getTestnetRpcProvider() 
      : getMainnetRpcProvider();
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
    const publicKey = urlParams.get('public_key');

    if (accountId && publicKey) {
      try {
        // Store the key in keystore (simplified - in production you'd get the full key)
        // This is a mock implementation - real implementation would handle the key properly
        const walletState = await this.connectWallet(accountId);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        return walletState;
      } catch (error) {
        console.error('Failed to handle wallet callback:', error);
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
   * Validate NEAR account ID format
   */
  private isValidAccountId(accountId: string): boolean {
    // NEAR account ID validation
    const nearAccountRegex = /^[a-z0-9._-]+\.near$|^[a-f0-9]{64}$/;
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