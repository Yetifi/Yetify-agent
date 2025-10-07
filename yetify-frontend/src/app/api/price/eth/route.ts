import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      {
        headers: {
          'Accept': 'application/json',
        },
        // Cache for 5 minutes to reduce API calls
        next: { revalidate: 300 }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data?.ethereum?.usd) {
      return NextResponse.json({ 
        price: data.ethereum.usd,
        timestamp: Date.now()
      });
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('ETH price fetch error:', error);
    // Return fallback price
    return NextResponse.json({ 
      price: 3500,
      timestamp: Date.now(),
      fallback: true
    });
  }
}