'use client';

import { useState } from 'react';
import StrategyBuilder from '@/components/StrategyBuilder';
import StrategyDashboard from '@/components/StrategyDashboard';
import WalletConnection from '@/components/WalletConnection';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'builder' | 'dashboard'>('builder');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-3xl font-bold">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Yetify
                </span>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                AI-Powered Yield Agent
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Total Portfolio: <span className="font-semibold text-gray-900">$66,480</span>
              </div>
              <WalletConnection />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-6 py-3 rounded-md font-medium transition-all ${
              activeTab === 'builder'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Strategy Builder
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 rounded-md font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 pb-12">
        {activeTab === 'builder' ? <StrategyBuilder /> : <StrategyDashboard />}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4">Yetify - AI-Powered DeFi Strategies</h3>
            <p className="text-gray-400 mb-6">
              Transform natural language prompts into executable yield strategies across multiple blockchains.
            </p>
            <div className="flex justify-center space-x-6 text-sm text-gray-400">
              <span>Built on NEAR Foundation</span>
              <span>•</span>
              <span>Multi-Chain Support</span>
              <span>•</span>
              <span>Secure TEE Execution</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
