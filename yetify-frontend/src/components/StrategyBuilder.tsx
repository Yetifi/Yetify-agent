'use client';

import { useState } from 'react';

interface StrategyPlan {
  id?: string;
  goal: string;
  chains: string[];
  protocols: string[];
  steps: Array<{
    action: string;
    protocol: string;
    asset: string;
    expectedApy?: number;
    amount?: string;
  }>;
  riskLevel: string;
  estimatedApy?: number;
  estimatedTvl?: string;
  confidence?: number;
  reasoning?: string;
  warnings?: string[];
}

export default function StrategyBuilder() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategyPlan, setStrategyPlan] = useState<StrategyPlan | null>(null);

  const handleGenerateStrategy = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    
    try {
      // Call backend API instead of local mock
      const response = await fetch('http://localhost:3001/api/v1/test/strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate strategy');
      }

      const data = await response.json();
      
      if (data.success) {
        setStrategyPlan(data.strategy);
      } else {
        alert('Failed to generate strategy. Please try again.');
      }
    } catch (error) {
      console.error('Strategy generation error:', error);
      alert('Error generating strategy. Please check your connection and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const executeStrategy = () => {
    alert('Strategy execution would be implemented here - connecting to wallet and smart contracts');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            🧠 AI Strategy Builder
          </h2>
          <p className="text-gray-600 text-lg">
            Describe your yield goals in natural language, and our AI will create an executable DeFi strategy.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="strategy-prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Strategy Prompt
            </label>
            <textarea
              id="strategy-prompt"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Example: 'Maximize my ETH yield with low risk across multiple chains' or 'Get the best stablecoin returns while maintaining liquidity'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <button
            onClick={handleGenerateStrategy}
            disabled={!prompt.trim() || isGenerating}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-8 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Strategy...
              </span>
            ) : (
              '✨ Generate AI Strategy'
            )}
          </button>
        </div>

        {strategyPlan && (
          <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-gray-900">🧠 AI Generated Strategy</h3>
              {strategyPlan.confidence && (
                <div className="text-right">
                  <div className="text-sm text-gray-500">Confidence</div>
                  <div className="text-lg font-semibold text-green-600">{strategyPlan.confidence}%</div>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="md:col-span-2">
                <h4 className="font-medium text-gray-700 mb-2">Goal</h4>
                <p className="text-gray-600">{strategyPlan.goal}</p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Expected APY</h4>
                <div className="text-2xl font-bold text-green-600">
                  {strategyPlan.estimatedApy ? `${strategyPlan.estimatedApy.toFixed(2)}%` : 'N/A'}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Risk Level</h4>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  strategyPlan.riskLevel === 'Low' ? 'bg-green-100 text-green-800' :
                  strategyPlan.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {strategyPlan.riskLevel} Risk
                </span>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Chains</h4>
                <div className="flex flex-wrap gap-2">
                  {strategyPlan.chains.map((chain, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {chain}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Protocols</h4>
                <div className="flex flex-wrap gap-2">
                  {strategyPlan.protocols.map((protocol, index) => (
                    <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                      {protocol}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {strategyPlan.reasoning && (
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">AI Reasoning</h4>
                <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded-lg">{strategyPlan.reasoning}</p>
              </div>
            )}

            <div className="mb-6">
              <h4 className="font-medium text-gray-700 mb-3">Execution Steps</h4>
              <div className="space-y-3">
                {strategyPlan.steps.map((step, index) => (
                  <div key={index} className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 mb-1">{step.action}</div>
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Protocol:</span> {step.protocol} | 
                          <span className="font-medium"> Asset:</span> {step.asset}
                        </div>
                        {step.expectedApy && (
                          <div className="text-sm">
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                              {step.expectedApy.toFixed(2)}% APY
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {strategyPlan.warnings && strategyPlan.warnings.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">⚠️ Risk Warnings</h4>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <ul className="text-sm text-yellow-800 space-y-1">
                    {strategyPlan.warnings.map((warning, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-yellow-600 mr-2">•</span>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={executeStrategy}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                🚀 Execute Strategy
              </button>
              <button
                onClick={() => setStrategyPlan(null)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
