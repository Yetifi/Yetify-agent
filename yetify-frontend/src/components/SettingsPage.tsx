'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Key, Save, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

interface ApiKeys {
  openRouter: string;
  groq: string;
}

interface SettingsPageProps {
  walletAddress: string | null;
}

export default function SettingsPage({ walletAddress }: SettingsPageProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    openRouter: '',
    groq: ''
  });
  const [showOpenRouter, setShowOpenRouter] = useState(false);
  const [showGroq, setShowGroq] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasKeys, setHasKeys] = useState({ openRouter: false, groq: false });

  const loadApiKeyStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/users/${walletAddress}/api-keys`);
      if (response.ok) {
        const data = await response.json();
        setHasKeys({
          openRouter: data.hasOpenRouter,
          groq: data.hasGroq
        });
      }
    } catch (error) {
      console.error('Failed to load API key status:', error);
    }
  }, [walletAddress]);

  // Load existing API key status
  useEffect(() => {
    if (walletAddress) {
      loadApiKeyStatus();
    }
  }, [walletAddress, loadApiKeyStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!walletAddress) {
      setMessage({ type: 'error', text: 'Please connect your wallet first' });
      return;
    }

    if (!apiKeys.openRouter && !apiKeys.groq) {
      setMessage({ type: 'error', text: 'Please provide at least one API key' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/users/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          apiKeys: {
            openRouter: apiKeys.openRouter || undefined,
            groq: apiKeys.groq || undefined
          }
        }),
      });

      if (response.ok) {
        await response.json();
        setMessage({ type: 'success', text: 'API keys saved successfully!' });
        setHasKeys({
          openRouter: !!apiKeys.openRouter,
          groq: !!apiKeys.groq
        });
        // Clear input fields after successful save
        setApiKeys({ openRouter: '', groq: '' });
      } else {
        const errorText = await response.text();
        setMessage({ type: 'error', text: `Failed to save API keys: ${errorText}` });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!walletAddress) return;

    if (!window.confirm('Are you sure you want to delete all your API keys? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/users/${walletAddress}/api-keys`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'API keys deleted successfully!' });
        setHasKeys({ openRouter: false, groq: false });
        setApiKeys({ openRouter: '', groq: '' });
      } else {
        const errorText = await response.text();
        setMessage({ type: 'error', text: `Failed to delete API keys: ${errorText}` });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <Key className="w-8 h-8 text-blue-400 mr-3" />
            <h1 className="text-4xl font-bold text-white">API Settings</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Configure your AI API keys for personalized strategy generation
          </p>
        </motion.div>

        {/* Wallet Connection Status */}
        {!walletAddress && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-6 text-center"
          >
            <AlertCircle className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-yellow-300">Please connect your wallet to manage API keys</p>
          </motion.div>
        )}

        {/* Current Status */}
        {walletAddress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6 mb-6"
          >
            <h3 className="text-xl font-semibold text-white mb-4">Current Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">OpenRouter API Key:</span>
                <div className="flex items-center">
                  {hasKeys.openRouter ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                      <span className="text-green-400">Configured</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                      <span className="text-red-400">Not Set</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Groq API Key:</span>
                <div className="flex items-center">
                  {hasKeys.groq ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                      <span className="text-green-400">Configured</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                      <span className="text-red-400">Not Set</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* API Key Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OpenRouter API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                OpenRouter API Key
              </label>
              <div className="relative">
                <input
                  type={showOpenRouter ? 'text' : 'password'}
                  value={apiKeys.openRouter}
                  onChange={(e) => setApiKeys(prev => ({ ...prev, openRouter: e.target.value }))}
                  placeholder="sk-or-v1-..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenRouter(!showOpenRouter)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showOpenRouter ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Get your API key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">openrouter.ai</a>
              </p>
            </div>

            {/* Groq API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Groq API Key
              </label>
              <div className="relative">
                <input
                  type={showGroq ? 'text' : 'password'}
                  value={apiKeys.groq}
                  onChange={(e) => setApiKeys(prev => ({ ...prev, groq: e.target.value }))}
                  placeholder="gsk_..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowGroq(!showGroq)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showGroq ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Get your API key from <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.groq.com</a>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || !walletAddress}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Save API Keys
                  </>
                )}
              </button>

              {(hasKeys.openRouter || hasKeys.groq) && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Delete All
                </button>
              )}
            </div>
          </form>

          {/* Message Display */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 p-4 rounded-lg flex items-center ${
                message.type === 'success' 
                  ? 'bg-green-500/20 border border-green-500/30 text-green-300' 
                  : 'bg-red-500/20 border border-red-500/30 text-red-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-2" />
              )}
              {message.text}
            </motion.div>
          )}
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 bg-white/5 rounded-lg border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-3">Why API Keys?</h3>
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Use your own AI API keys for better rate limits and personalized usage</p>
            <p>• Your keys are stored securely and only used for your strategy generation</p>
            <p>• Fallback to default keys if no personal keys are provided</p>
            <p>• Delete your keys anytime to stop using personal API access</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}