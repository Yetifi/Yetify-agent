'use client';

import { useState } from 'react';
import StrategyBuilder from '@/components/StrategyBuilder';
import StrategyDashboard from '@/components/StrategyDashboard';
import Layout from '@/components/Layout';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'builder' | 'dashboard'>('builder');

  return (
    <Layout>
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
      <div className="flex-1 pb-12">
        {activeTab === 'builder' ? <StrategyBuilder /> : <StrategyDashboard />}
      </div>
    </Layout>
  );
}
