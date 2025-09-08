'use client';

import { useState } from 'react';
import StrategyBuilder from '@/components/StrategyBuilder';
import StrategyDashboard from '@/components/StrategyDashboard';
import WalletConnection from '@/components/WalletConnection';
import PortfolioValue from '@/components/PortfolioValue';
import NoSSR from '@/components/NoSSR';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'builder' | 'dashboard'>('builder');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-3xl font-bold">
                <span className="text-white">
                  Yetify
                </span>
              </div>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full border border-blue-500/30">
                AI-Powered Yield Agent
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <NoSSR fallback={<div className="bg-slate-600 animate-pulse rounded px-4 py-2 w-24 h-6"></div>}>
                <PortfolioValue />
              </NoSSR>
              <NoSSR fallback={<div className="bg-slate-600 animate-pulse rounded px-4 py-2 w-32 h-10"></div>}>
                <WalletConnection />
              </NoSSR>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex space-x-1 bg-slate-800/30 p-1 rounded-lg w-fit backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-6 py-3 rounded-md font-medium transition-all ${
              activeTab === 'builder'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Strategy Builder
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 rounded-md font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-slate-700/50'
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
