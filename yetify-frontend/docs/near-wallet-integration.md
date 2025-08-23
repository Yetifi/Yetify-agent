# NEAR Wallet Integration Documentation

## Overview
This document provides comprehensive guidance for integrating NEAR wallet functionality using the modern modular NEAR API JS packages. The integration enables users to connect their NEAR wallets, sign transactions, and interact with NEAR smart contracts.

## Modern NEAR API JS Migration

### Package Structure
The NEAR API JS has migrated from a monolithic package to modular packages for better tree-shaking and maintainability.

#### Required Packages
```bash
npm install @near-js/client @near-js/keystores-browser @near-js/crypto @near-js/providers @near-js/accounts
```

#### Package Breakdown
- `@near-js/client` - High-level client functions
- `@near-js/keystores-browser` - Browser-specific key storage
- `@near-js/crypto` - Cryptographic utilities
- `@near-js/providers` - RPC providers for blockchain communication
- `@near-js/accounts` - Account management utilities

## Core Integration Patterns

### 1. Keystore Initialization
```typescript
import { BrowserLocalStorageKeyStore } from '@near-js/keystores-browser';

// Initialize browser-based keystore
const keystore = new BrowserLocalStorageKeyStore();
```

### 2. Message Signer Setup
```typescript
import { getSignerFromKeystore } from '@near-js/client';

// Create signer from keystore
const signer = getSignerFromKeystore('account.near', 'mainnet', keystore);

// Alternative: Create signer from private key
import { getSignerFromPrivateKey } from '@near-js/client';
const signer = getSignerFromPrivateKey('ed25519:...');
```

### 3. RPC Provider Configuration
```typescript
import { getProviderByNetwork, getTestnetRpcProvider, getMainnetRpcProvider } from '@near-js/client';

// Network-based provider (recommended)
const rpcProvider = getProviderByNetwork('testnet');

// Testnet shortcut
const testnetProvider = getTestnetRpcProvider();

// Mainnet shortcut  
const mainnetProvider = getMainnetRpcProvider();

// Custom endpoints
import { getProviderByEndpoints } from '@near-js/client';
const customProvider = getProviderByEndpoints('https://rpc.tld', 'https://fallback-rpc.tld');
```

### 4. Access Key Management
```typescript
import { getAccessKeySigner, getAccessKeys } from '@near-js/client';

// Initialize access key signer with caching
const accessKeySigner = getAccessKeySigner({
  account: 'account.near',
  deps: {
    signer,
    rpcProvider: getMainnetRpcProvider()
  }
});

// Retrieve account access keys
const { fullAccessKeys, functionCallAccessKeys } = await getAccessKeys({
  account: 'account.testnet',
  deps: { rpcProvider: getTestnetRpcProvider() }
});
```

## Transaction Operations

### 1. Simple Token Transfer
```typescript
import { transfer } from '@near-js/client';

await transfer({
  sender: 'account.testnet',
  receiver: 'receiver.testnet',
  amount: 1000n, // in yoctoNear
  deps: {
    rpcProvider: getTestnetRpcProvider(),
    signer,
  }
});
```

### 2. Multi-Action Transactions
```typescript
import { SignedTransactionComposer } from '@near-js/client';
import { KeyPairEd25519 } from '@near-js/crypto';

const oldPublicKey = await signer.getPublicKey();
const newKeyPair = KeyPairEd25519.fromRandom();

const composer = SignedTransactionComposer.init({
  sender: 'account.testnet',
  receiver: 'receiver.testnet',
  deps: {
    signer,
    rpcProvider: getMainnetRpcProvider(),
  }
});

// Chain multiple actions in single transaction
await composer
  .addFullAccessKey(newKeyPair.publicKey)
  .deleteKey(oldPublicKey.toString())
  .signAndSend();

// Update keystore with new key
keystore.setKey('testnet', 'account.testnet', newKeyPair);
```

## Smart Contract Interaction

### 1. View Methods (Read-only)
```typescript
import { callViewMethod, view } from '@near-js/client';

// Full response object
const response = await callViewMethod({
  account: 'guest-book.testnet',
  method: 'getMessages',
  deps: { rpcProvider: getTestnetRpcProvider() }
});

// Parsed response with type safety
interface GuestBookMessage {
  premium: boolean;
  sender: string;
  text: string;
}

const data = await view<GuestBookMessage[]>({
  account: 'guest-book.testnet',
  method: 'getMessages',
  deps: { rpcProvider: getTestnetRpcProvider() }
});
```

### 2. Change Methods (State-changing)
```typescript
// Function calls are part of transaction composition
const composer = SignedTransactionComposer.init({
  sender: 'account.testnet',
  receiver: 'contract.testnet',
  deps: { signer, rpcProvider: getTestnetRpcProvider() }
});

await composer
  .functionCall('method_name', { args: 'value' }, BigInt(30000000000000), BigInt(0))
  .signAndSend();
```

## Wallet Connection Patterns

### 1. Detection and Initialization
```typescript
class NEARWalletService {
  private keystore: BrowserLocalStorageKeyStore;
  private signer: any;
  private rpcProvider: any;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.keystore = new BrowserLocalStorageKeyStore();
    this.rpcProvider = getProviderByNetwork(network);
  }

  async isWalletConnected(): Promise<boolean> {
    try {
      const keys = await this.keystore.getKeys();
      return keys.length > 0;
    } catch {
      return false;
    }
  }
}
```

### 2. Account Connection Flow
```typescript
async connectWallet(accountId: string): Promise<{address: string, balance: string}> {
  try {
    // Create or retrieve signer
    this.signer = getSignerFromKeystore(accountId, 'testnet', this.keystore);
    
    // Verify account exists and get balance
    const account = await this.getAccountInfo(accountId);
    
    return {
      address: accountId,
      balance: `${this.formatNearAmount(account.amount)} NEAR`
    };
  } catch (error) {
    throw new Error(`Failed to connect wallet: ${error.message}`);
  }
}
```

### 3. Balance and Account Information
```typescript
async getAccountInfo(accountId: string) {
  const response = await this.rpcProvider.query({
    request_type: 'view_account',
    finality: 'final',
    account_id: accountId,
  });
  return response;
}

formatNearAmount(yoctoNear: string): string {
  return (BigInt(yoctoNear) / BigInt('1000000000000000000000000')).toString();
}
```

## Biometric Authentication (Optional)

For enhanced security, NEAR supports biometric authentication:

```bash
npm install @near-js/biometric-ed25519
```

```typescript
import { createKey, getKeys } from '@near-js/biometric-ed25519';

// Register biometric key
const key = await createKey(userName);

// Retrieve biometric keys
const keys = await getKeys(userName);
```

## Error Handling

### Common Error Patterns
```typescript
import { TypedError } from '@near-js/types';
import { parseRpcError } from '@near-js/utils';

try {
  await walletOperation();
} catch (error) {
  if (error instanceof TypedError) {
    console.error('NEAR API Error:', error.type, error.message);
  } else {
    const parsedError = parseRpcError(error);
    console.error('RPC Error:', parsedError);
  }
}
```

### Network-Specific Error Handling
```typescript
async connectWithRetry(accountId: string, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.connectWallet(accountId);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      console.warn(`Connection attempt ${attempt} failed:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

## Best Practices

### 1. Network Configuration
- Use `testnet` for development and testing
- Switch to `mainnet` only for production
- Always validate network consistency across components

### 2. Key Management
- Never expose private keys in client-side code
- Use BrowserLocalStorageKeyStore for web applications
- Implement proper key rotation for production applications

### 3. Transaction Safety
- Always validate transaction parameters
- Use appropriate gas limits for complex operations
- Implement transaction confirmation UI patterns

### 4. Performance Optimization
- Cache RPC providers and signers when possible
- Use access key signers for better performance
- Implement proper loading states for async operations

## Integration Checklist

- [ ] Install required NEAR packages
- [ ] Configure network-appropriate RPC provider
- [ ] Initialize browser keystore
- [ ] Implement wallet connection flow
- [ ] Add account balance display
- [ ] Handle connection errors gracefully
- [ ] Test with both testnet and mainnet
- [ ] Implement transaction signing
- [ ] Add disconnection functionality
- [ ] Validate security best practices

## Troubleshooting

### Common Issues
1. **Keystore not persisting**: Ensure browser allows localStorage
2. **RPC connection failures**: Check network configuration and fallback providers
3. **Signer initialization errors**: Verify account ID format and network consistency
4. **Transaction failures**: Validate gas limits and account permissions

### Debug Utilities
```typescript
// Log keystore contents (development only)
console.log('Stored keys:', await keystore.getKeys());

// Verify RPC connectivity
const networkInfo = await rpcProvider.status();
console.log('Network status:', networkInfo);
```

This documentation provides the foundation for implementing production-ready NEAR wallet integration using the modern modular NEAR API JS packages.