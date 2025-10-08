import { NextRequest, NextResponse } from 'next/server';
import { KeyPair } from '@near-js/crypto';
import { KeyPairSigner } from '@near-js/signers';
import { JsonRpcProvider } from '@near-js/providers';
import { Account } from '@near-js/accounts';

export async function POST(request: NextRequest) {
  try {
    const { strategy } = await request.json();

    if (!strategy) {
      return NextResponse.json(
        { error: 'Missing strategy parameter' },
        { status: 400 }
      );
    }

    console.log('Storing complete strategy on NEAR blockchain:', strategy);

    // Convert strategy object to JSON string for contract call with proper field mapping
    const strategyJson = JSON.stringify({
      id: strategy.id,
      goal: strategy.goal,
      chains: strategy.chains || [],
      protocols: strategy.protocols || [],
      steps: (strategy.steps || []).map((step: Record<string, unknown>) => ({
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
      creator: 'strategy-storage-yetify.testnet',
      created_at: Date.now()
    });

    // NEAR API-JS approach 
    try {
      // Get the service account private key from environment
      const privateKey = process.env.NEAR_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('NEAR_PRIVATE_KEY environment variable not set');
      }

      const accountId = 'strategy-storage-yetify.testnet';

      // Create KeyPair from private key string (modern approach)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const keyPair = KeyPair.fromString(privateKey as any);

      // Create KeyPairSigner directly (this is the correct modern signer)
      const signer = new KeyPairSigner(keyPair);

      // Create JSON RPC Provider
      const provider = new JsonRpcProvider({
        url: 'https://rpc.testnet.near.org'
      });

      // Create Account directly (no need for deprecated Connection)
      const account = new Account(accountId, provider, signer);

      // Call contract method using functionCall
      const result = await account.functionCall({
        contractId: 'strategy-storage-yetify.testnet',
        methodName: 'store_complete_strategy',
        args: { strategy_json: strategyJson },
        gas: BigInt('30000000000000'), // 30 Tgas
        attachedDeposit: BigInt('0'),
      });

      const transactionHash = result.transaction.hash;
      
      console.log('NEAR transaction successful:', transactionHash);

      // Store successful on-chain data to database
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
      await fetch(`${backendUrl}/api/v1/strategies/update-onchain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategyId: strategy.id,
          onChainData: {
            isStored: true,
            contractAccount: 'strategy-storage-yetify.testnet',
            transactionHash: transactionHash,
            storedAt: new Date(),
            storedData: {
              creator: 'strategy-storage-yetify.testnet',
              created_at: Date.now(),
              completeStrategyJson: strategyJson
            }
          }
        })
      }).catch(err => console.log('Database update failed:', err));

      return NextResponse.json({
        success: true,
        transactionHash,
        message: 'Complete strategy stored successfully',
        explorerUrl: `https://testnet.nearblocks.io/txns/${transactionHash}`,
      });

    } catch (nearError: unknown) {
      console.error('NEAR API call failed:', nearError);
      
      return NextResponse.json(
        { error: 'Failed to submit transaction', details: (nearError as Error)?.message || 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}