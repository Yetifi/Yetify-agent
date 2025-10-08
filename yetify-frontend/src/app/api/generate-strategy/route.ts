import { NextRequest, NextResponse } from 'next/server';

interface StrategyRequest {
  prompt: string;
  userAddress?: string;
  riskTolerance?: 'low' | 'medium' | 'high';
}

interface StrategyResponse {
  goal: string;
  chains: string[];
  protocols: string[];
  steps: Array<{
    action: string;
    protocol: string;
    asset: string;
    amount?: string;
    expectedApy?: number;
  }>;
  riskLevel: string;
  estimatedApy: number;
  estimatedTvl: string;
  executionTime: string;
}

// Proxy to backend API for real AI strategy generation
const generateStrategy = async (prompt: string, userAddress?: string): Promise<StrategyResponse> => {
  try {
    const backendResponse = await fetch('http://localhost:3001/api/v1/test/generate-strategy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        userAddress
      }),
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend API failed: ${backendResponse.status}`);
    }

    const data = await backendResponse.json();
    
    if (data.success && data.strategy) {
      // Transform backend response to match frontend interface
      return {
        goal: data.strategy.goal,
        chains: data.strategy.chains,
        protocols: data.strategy.protocols,
        steps: data.strategy.steps,
        riskLevel: data.strategy.riskLevel,
        estimatedApy: data.strategy.estimatedApy,
        estimatedTvl: data.strategy.estimatedTvl,
        executionTime: data.strategy.executionTime
      };
    } else {
      throw new Error('Invalid backend response');
    }
  } catch (error) {
    console.error('Backend API failed, using fallback:', error);
    
    // Fallback to simple mock if backend fails
    return {
      goal: prompt,
      chains: ['NEAR', 'Ethereum'],
      protocols: ['Ref Finance', 'Lido', 'Aave'],
      steps: [
        { action: 'stake', protocol: 'Lido', asset: 'ETH', expectedApy: 4.2 },
        { action: 'deposit', protocol: 'Aave', asset: 'USDC', expectedApy: 6.8 },
        { action: 'yield_farm', protocol: 'Ref Finance', asset: 'NEAR', expectedApy: 15.1 }
      ],
      riskLevel: 'Medium',
      estimatedApy: 8.7,
      estimatedTvl: '$1,500',
      executionTime: '~3 minutes'
    };
  }
};

export async function POST(request: NextRequest) {
  try {
    const body: StrategyRequest = await request.json();
    
    if (!body.prompt || body.prompt.trim().length < 10) {
      return NextResponse.json(
        { error: 'Prompt must be at least 10 characters long' },
        { status: 400 }
      );
    }

    const strategy = await generateStrategy(body.prompt, body.userAddress);

    return NextResponse.json({
      success: true,
      strategy,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Strategy generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate strategy' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Yetify AI Strategy Generation API',
    version: '1.0.0',
    endpoints: {
      'POST /api/generate-strategy': 'Generate AI strategy from prompt',
    }
  });
}
