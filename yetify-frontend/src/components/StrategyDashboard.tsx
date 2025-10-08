"use client";

import { useState, useEffect } from "react";
import {
  getSavedStrategies,
  SavedStrategy,
  deleteStrategy,
  addExecutionRecord,
} from "@/utils/strategyStorage";
import { NEARWalletService } from "@/services/NEARWalletService";
import { useNEARWallet } from "@/contexts/NEARWalletContext";
import SuccessModal from "@/components/SuccessModal";

export default function StrategyDashboard() {
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "saved" | "executing" | "completed" | "failed"
  >("all");
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    transactionHash: string;
    strategyId: string;
  } | null>(null);

  // NEAR Wallet context - use shared service instance
  const { nearWallet, connectNear, nearService } = useNEARWallet();

  // Load saved strategies on component mount
  useEffect(() => {
    const strategies = getSavedStrategies();
    setSavedStrategies(strategies);
  }, []);

  // Refresh strategies when URL changes (after transaction)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const transactionHashes = urlParams.get('transactionHashes');
    
    if (transactionHashes) {
      // Refresh strategies after transaction completion
      setTimeout(() => {
        const strategies = getSavedStrategies();
        setSavedStrategies(strategies);
      }, 1000);
    }
  }, []);

  // Filter strategies based on selected filter
  const filteredStrategies = savedStrategies.filter((strategy) => {
    if (selectedFilter === "all") return true;
    return strategy.status === selectedFilter;
  });

  const handleDeleteStrategy = (id: string) => {
    if (confirm("Are you sure you want to delete this strategy?")) {
      deleteStrategy(id);
      setSavedStrategies((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleExecuteStrategy = async (strategy: SavedStrategy) => {
    // Check if NEAR wallet is connected and service is available
    if (!nearWallet?.isConnected || !nearWallet?.accountId || !nearService) {
      alert('Please connect your NEAR wallet first to store strategies on-chain.');
      return;
    }

    setIsConnecting(true);
    try {
      // Store complete strategy on NEAR blockchain using user's wallet
      const transactionHash = await nearService.storeCompleteStrategy(strategy);

      // Only update database if blockchain storage was successful
      addExecutionRecord(strategy.id, {
        status: "completed",
        transactionHash: transactionHash,
        timestamp: new Date(),
      });

      // Reload strategies to reflect changes
      const strategies = getSavedStrategies();
      setSavedStrategies(strategies);

      // Show success modal instead of alert
      setSuccessData({
        transactionHash,
        strategyId: strategy.id,
      });
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Failed to execute strategy:", error);

      // Just show error, don't change anything in database
      alert(
        `Failed to store strategy on blockchain:\n\n${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusColor = (status: SavedStrategy["status"]) => {
    switch (status) {
      case "saved":
        return "bg-slate-500/20 text-gray-300 border border-slate-500/30";
      case "executing":
        return "bg-blue-500/20 text-blue-300 border border-blue-500/30";
      case "completed":
        return "bg-green-500/20 text-green-300 border border-green-500/30";
      case "failed":
        return "bg-red-500/20 text-red-300 border border-red-500/30";
      default:
        return "bg-slate-500/20 text-gray-300 border border-slate-500/30";
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case "low":
        return "text-green-400";
      case "medium":
        return "text-yellow-400";
      case "high":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">
          Strategy Dashboard
        </h2>
        <p className="text-gray-300 text-lg mb-2">
          Monitor and manage your saved DeFi strategies.
        </p>
        <div className="flex items-center space-x-2 text-sm">
          <span className="inline-flex items-center px-2 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded-full">
            🟢 Connected to NEAR Testnet (strategy-storage-yetify.testnet)
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-slate-700/50 p-6">
          <div className="text-2xl font-bold text-white">
            {savedStrategies.length}
          </div>
          <div className="text-sm text-gray-400">Total Strategies</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-slate-700/50 p-6">
          <div className="text-2xl font-bold text-green-400">
            {savedStrategies.filter((s) => s.status === "saved").length}
          </div>
          <div className="text-sm text-gray-400">Ready to Execute</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-slate-700/50 p-6">
          <div className="text-2xl font-bold text-blue-400">
            {savedStrategies.filter((s) => s.status === "executing").length}
          </div>
          <div className="text-sm text-gray-400">Currently Executing</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-slate-700/50 p-6">
          <div className="text-2xl font-bold text-green-400">
            {savedStrategies.filter((s) => s.status === "completed").length}
          </div>
          <div className="text-sm text-gray-400">Completed</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-slate-800/30 p-1 rounded-lg w-fit backdrop-blur-sm">
          {(["all", "saved", "executing", "completed", "failed"] as const).map(
            (filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-6 py-2 rounded-md font-medium transition-all capitalize ${
                  selectedFilter === filter
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                {filter}
              </button>
            )
          )}
        </div>
      </div>

      {/* Strategies List */}
      {filteredStrategies.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-slate-700/50 p-12 text-center">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-white mb-2">
            No Strategies Found
          </h3>
          <p className="text-gray-300 mb-4">
            {selectedFilter === "all"
              ? "Create your first strategy using the Strategy Builder."
              : `No strategies with status "${selectedFilter}" found.`}
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
            <div
              key={strategy.id}
              className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-slate-700/50 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {strategy.name}
                  </h3>
                  <p className="text-gray-300 mb-3">{strategy.goal}</p>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center">
                      <span className="text-gray-400">Status:</span>
                      <span
                        className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          strategy.status
                        )}`}
                      >
                        {strategy.status}
                      </span>
                    </div>

                    <div className="flex items-center">
                      <span className="text-gray-400">Risk:</span>
                      <span
                        className={`ml-2 font-medium ${getRiskColor(
                          strategy.riskLevel
                        )}`}
                      >
                        {strategy.riskLevel}
                      </span>
                    </div>

                    {strategy.estimatedApy && (
                      <div className="flex items-center">
                        <span className="text-gray-400">Est. APY:</span>
                        <span className="ml-2 font-medium text-green-400">
                          {strategy.estimatedApy.toFixed(2)}%
                        </span>
                      </div>
                    )}

                    <div className="flex items-center">
                      <span className="text-gray-400">Created:</span>
                      <span className="ml-2 text-gray-300">
                        {formatDate(strategy.createdAt)}
                      </span>
                    </div>

                    {strategy.executionHistory &&
                      strategy.executionHistory.length > 0 &&
                      strategy.executionHistory[0].transactionHash && (
                        <div className="flex items-center">
                          <span className="text-gray-400">TX Hash:</span>
                          <a
                            href={`https://testnet.nearblocks.io/txns/${strategy.executionHistory[0].transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-400 hover:text-blue-300 font-mono text-sm truncate max-w-[100px]"
                            title={strategy.executionHistory[0].transactionHash}
                          >
                            {strategy.executionHistory[0].transactionHash.substring(
                              0,
                              8
                            )}
                            ...
                          </a>
                        </div>
                      )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {(strategy.status === "saved" ||
                    strategy.status === "failed") && (
                    <div className="flex flex-col items-end space-y-1">
                      {!nearWallet?.isConnected ? (
                        <div>
                          <button
                            onClick={() => connectNear()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                          >
                            🔗 Connect NEAR Wallet
                          </button>
                          <div className="text-xs text-gray-400 mt-1">
                            Required for on-chain storage
                          </div>
                        </div>
                      ) : (
                        <div>
                          <button
                            onClick={() => handleExecuteStrategy(strategy)}
                            disabled={isConnecting}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isConnecting ? "Signing Transaction..." : "Sign & Store on NEAR"}
                          </button>
                          <div className="text-xs text-gray-400 mt-1">
                            Connected: {nearWallet.accountId?.substring(0, 10)}...
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => handleDeleteStrategy(strategy.id)}
                    className="text-red-600 hover:text-red-800 p-2"
                    title="Delete strategy"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Strategy Details */}
              <div className="border-t border-slate-600/50 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      Chains
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {strategy.chains.map((chain, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-xs"
                        >
                          {chain}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      Protocols
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {strategy.protocols.map((protocol, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-xs"
                        >
                          {protocol}
                        </span>
                      ))}
                    </div>
                  </div>

                  {strategy.tags && strategy.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {strategy.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-slate-500/20 text-gray-300 border border-slate-500/30 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {strategy.steps && strategy.steps.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      Execution Steps
                    </h4>
                    <div className="text-sm text-gray-400">
                      {strategy.steps.length} step
                      {strategy.steps.length !== 1 ? "s" : ""} configured
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Success Modal */}
      {successData && (
        <SuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setSuccessData(null);
          }}
          transactionHash={successData.transactionHash}
          strategyId={successData.strategyId}
        />
      )}
    </div>
  );
}
