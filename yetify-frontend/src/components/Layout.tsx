'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Home } from 'lucide-react';
import WalletConnection from '@/components/WalletConnection';
import PortfolioValue from '@/components/PortfolioValue';
import NoSSR from '@/components/NoSSR';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const isSettingsPage = pathname === '/settings';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex flex-col">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-800/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
                <div className="text-3xl font-bold">
                  <span className="text-white">
                    Yetify
                  </span>
                </div>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full border border-blue-500/30">
                  AI-Powered Yield Agent
                </span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <NoSSR fallback={<div className="bg-slate-600 animate-pulse rounded px-4 py-2 w-24 h-6"></div>}>
                <PortfolioValue />
              </NoSSR>
              
              {/* Navigation Icons */}
              <div className="flex items-center space-x-2">
                {!isSettingsPage && (
                  <Link 
                    href="/settings" 
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <Settings className="w-5 h-5" />
                    <span className="hidden sm:inline text-sm">Settings</span>
                  </Link>
                )}
                
                {isSettingsPage && (
                  <Link 
                    href="/" 
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <Home className="w-5 h-5" />
                    <span className="hidden sm:inline text-sm">Home</span>
                  </Link>
                )}
              </div>
              
              <NoSSR fallback={<div className="bg-slate-600 animate-pulse rounded px-4 py-2 w-32 h-10"></div>}>
                <WalletConnection />
              </NoSSR>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with padding for fixed header */}
      <main className="flex-1 pt-20">
        {children}
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