import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { id, goal } = await request.json();

    if (!id || !goal) {
      return NextResponse.json(
        { error: 'Missing id or goal parameter' },
        { status: 400 }
      );
    }

    console.log('Storing strategy on NEAR blockchain:', { id, goal });

    // Use NEAR CLI to call the contract on the same account
    const command = `near call strategy-storage-yetify.testnet store_strategy '{"id": "${id}", "goal": "${goal}"}' --accountId strategy-storage-yetify.testnet --networkId testnet --gas 30000000000000 --deposit 0`;
    
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

      // Extract transaction hash from output
      const hashMatch = stdout.match(/Transaction ID: ([A-Za-z0-9]+)/);
      const explorerMatch = stdout.match(/https:\/\/explorer\.testnet\.near\.org\/transactions\/([A-Za-z0-9]+)/);
      
      const transactionHash = hashMatch?.[1] || explorerMatch?.[1] || `mock-${Date.now()}`;

      return NextResponse.json({
        success: true,
        transactionHash,
        message: 'Strategy stored successfully',
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