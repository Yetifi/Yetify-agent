'use client';

import { useState, useEffect } from 'react';
import { getSavedStrategies, SavedStrategy, deleteStrategy, updateStrategy } from '@/utils/strategyStorage';

export default function StrategyDashboard() {
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'saved' | 'executing' | 'completed' | 'failed'>('all');

  // Load saved strategies on component mount
  useEffect(() => {
    const strategies = getSavedStrategies();
    setSavedStrategies(strategies);
  }, []);

  // Filter strategies based on selected filter
  const filteredStrategies = savedStrategies.filter(strategy => {
    if (selectedFilter === 'all') return true;
    return strategy.status === selectedFilter;
  });

  const handleDeleteStrategy = (id: string) => {
    if (confirm('Are you sure you want to delete this strategy?')) {
      deleteStrategy(id);
      setSavedStrategies(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleExecuteStrategy = (strategy: SavedStrategy) => {
    // Update status to executing
    updateStrategy(strategy.id, { status: 'executing' });
    setSavedStrategies(prev => 
      prev.map(s => s.id === strategy.id ? { ...s, status: 'executing' } : s)
    );
    
    // Simulate execution (in real app, this would call smart contracts)
    alert(`Executing strategy: ${strategy.name}\n\nThis would connect to your wallet and execute the DeFi strategy.`);
  };

  const getStatusColor = (status: SavedStrategy['status']) => {
    switch (status) {
      case 'saved':
        return 'bg-gray-100 text-gray-800';
      case 'executing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'low':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'high':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date));
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Strategy Dashboard
        </h2>
        <p className="text-gray-600 text-lg">
          Monitor and manage your saved DeFi strategies.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-gray-900">{savedStrategies.length}</div>
          <div className="text-sm text-gray-600">Total Strategies</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-green-600">
            {savedStrategies.filter(s => s.status === 'saved').length}
          </div>
          <div className="text-sm text-gray-600">Ready to Execute</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-blue-600">
            {savedStrategies.filter(s => s.status === 'executing').length}
          </div>
          <div className="text-sm text-gray-600">Currently Executing</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-green-600">
            {savedStrategies.filter(s => s.status === 'completed').length}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(['all', 'saved', 'executing', 'completed', 'failed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-6 py-2 rounded-md font-medium transition-all capitalize ${
                selectedFilter === filter
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Strategies List */}
      {filteredStrategies.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Strategies Found</h3>
          <p className="text-gray-600 mb-4">
            {selectedFilter === 'all' 
              ? 'Create your first strategy using the Strategy Builder.'
              : `No strategies with status "${selectedFilter}" found.`
            }
          </p>
          <button
            onClick={() => window.location.reload()} // In real app, navigate to builder
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Strategy
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredStrategies.map((strategy) => (
            <div key={strategy.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{strategy.name}</h3>
                  <p className="text-gray-600 mb-3">{strategy.goal}</p>
                  
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center">
                      <span className="text-gray-500">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(strategy.status)}`}>
                        {strategy.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-gray-500">Risk:</span>
                      <span className={`ml-2 font-medium ${getRiskColor(strategy.riskLevel)}`}>
                        {strategy.riskLevel}
                      </span>
                    </div>
                    
                    {strategy.estimatedApy && (
                      <div className="flex items-center">
                        <span className="text-gray-500">Est. APY:</span>
                        <span className="ml-2 font-medium text-green-600">
                          {strategy.estimatedApy.toFixed(2)}%
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center">
                      <span className="text-gray-500">Created:</span>
                      <span className="ml-2 text-gray-700">
                        {formatDate(strategy.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {strategy.status === 'saved' && (
                    <button
                      onClick={() => handleExecuteStrategy(strategy)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      Execute Now
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDeleteStrategy(strategy.id)}
                    className="text-red-600 hover:text-red-800 p-2"
                    title="Delete strategy"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              {/* Strategy Details */}
              <div className="border-t border-gray-100 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Chains</h4>
                    <div className="flex flex-wrap gap-1">
                      {strategy.chains.map((chain, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {chain}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Protocols</h4>
                    <div className="flex flex-wrap gap-1">
                      {strategy.protocols.map((protocol, index) => (
                        <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                          {protocol}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {strategy.tags && strategy.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {strategy.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {strategy.steps && strategy.steps.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Execution Steps</h4>
                    <div className="text-sm text-gray-600">
                      {strategy.steps.length} step{strategy.steps.length !== 1 ? 's' : ''} configured
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}