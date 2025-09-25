import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    // Use NEAR CLI to call the contract with complete strategy data
    // Use temporary file approach to avoid shell escaping issues
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    
    const tempFile = path.join(os.tmpdir(), `strategy-${Date.now()}.json`);
    // Wrap strategy JSON as parameter for contract method
    const wrappedJson = JSON.stringify({ strategy_json: strategyJson });
    fs.writeFileSync(tempFile, wrappedJson);
    
    const command = `near contract call-function as-transaction test-storage-yetify.testnet store_complete_strategy json-args "$(cat ${tempFile})" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as test-storage-yetify.testnet network-config testnet sign-with-keychain send && rm ${tempFile}`;
    
    console.log('Executing command:', command);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 second timeout
        cwd: process.cwd()
      });

      console.log('NEAR CLI stdout:', stdout);
      if (stderr) {
        console.log('NEAR CLI stderr:', stderr);
      }

      // Extract transaction hash from output (check both stdout and stderr)
      const combinedOutput = stdout + stderr;
      const hashMatch = combinedOutput.match(/Transaction ID: ([A-Za-z0-9]+)/);
      const explorerMatch = combinedOutput.match(/https:\/\/explorer\.testnet\.near\.org\/transactions\/([A-Za-z0-9]+)/);
      
      const transactionHash = hashMatch?.[1] || explorerMatch?.[1] || null;
      
      if (!transactionHash) {
        console.error('Could not extract transaction hash from NEAR CLI output');
        throw new Error('Transaction hash not found in CLI output');
      }

      // Store successful on-chain data to database
      await fetch('http://localhost:3001/api/v1/strategies/update-onchain', {
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
        output: stdout
      });

    } catch (execError: unknown) {
      console.error('NEAR CLI execution failed:', execError);
      
      // Extract transaction hash even from failed execution
      const stderr = (execError as { stderr?: string })?.stderr || '';
      const hashMatch = stderr.match(/Transaction ID: ([A-Za-z0-9]+)/);
      const explorerMatch = stderr.match(/https:\/\/explorer\.testnet\.near\.org\/transactions\/([A-Za-z0-9]+)/);
      
      const transactionHash = hashMatch?.[1] || explorerMatch?.[1];
      
      if (transactionHash) {
        return NextResponse.json({
          success: false,
          transactionHash,
          message: 'Transaction submitted but contract call failed',
          error: 'CompilationError(PrepareError(Deserialization))',
          explorerUrl: `https://testnet.nearblocks.io/txns/${transactionHash}`
        });
      }
      
      // If no transaction hash found, it's a real error
      return NextResponse.json(
        { error: 'Failed to submit transaction', details: (execError as Error)?.message || 'Unknown error' },
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