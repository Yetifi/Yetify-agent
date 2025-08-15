# **Yetify: The Prompt-to-Strategy AI Agent**

Yetify is a powerful, AI-powered yield agent designed to simplify DeFi strategies. Users can type a simple prompt, and the system will automatically generate, deploy, and manage an executable multi-chain DeFi strategy, all without manual intervention.

### Blurb --
> Yetify is an AI-powered, multi-chain yield agent that turns your natural language prompts into executable DeFi strategies. Powered by LLMs, real-time market data, and secure cross-chain execution, Yetify scouts the best opportunities, deploys assets automatically, and optimizes yields while you sleep—no coding required.

## **1️⃣ Core Vision**

The primary goal of Yetify is to transform the complex world of decentralized finance into a simple, prompt-based experience. The Minimum Viable Product (MVP) will focus on three key areas:

* **Transforming Natural Language:** Convert simple prompts into structured, executable yield strategies.  
* **Automating Execution:** Automatically deploy and manage these strategies across various supported blockchains.  
* **Continuous Optimization:** Monitor and actively optimize positions based on real-time market changes.

## **2️⃣ Core Architecture**

The system is composed of several key layers to handle everything from user input to on-chain execution and monitoring.

### Frontend **💻**

* **Prompt-based Strategy Builder:** A user interface for entering natural language prompts like "Maximize my ETH yield with low risk". The system will then display a strategy plan preview that is editable before execution.  
* **Wallet Connection:** Securely connect to user wallets via NEAR Wallet, MetaMask, and WalletConnect.  
* **Strategy Dashboard:** A dashboard to track live strategies, including APY, TVL (Total Value Locked), and risk scores. Users can pause, withdraw, or edit their strategies on the fly.

### Backend **⚙️**

* **LLM Strategy Engine:** The core AI agent powered by models like Gemini, GPT, or Claude.  
  * Converts user prompts into a structured JSON plan.  
  * Uses **RAG (Retrieval-Augmented Generation)** to inject live protocol, APY, and security data into the LLM.  
  * **Example JSON Plan:**  
    {  
      "goal": "Maximize ETH yield",  
      "chains": ["Ethereum", "Arbitrum"],  
      "protocols": ["Aave", "Lido"],  
      "steps": [  
        {"action": "deposit", "protocol": "Lido", "asset": "ETH"},  
        {"action": "stake", "protocol": "Aave", "asset": "stETH"}  
      ],  
      "riskLevel": "Low"  
    }

* **Execution Layer:**  
  * Vault smart contracts on NEAR and EVM-compatible chains.  
  * Utilizes **NEAR Intents** for automated and scheduled actions.  
  * Secure agent execution in a TEE (Trusted Execution Environment) like Phala or Shade Agents.  
  * Cross-chain asset movement is handled by bridging APIs (Wormhole, Axelar).  
* **Monitoring Layer:**  
  * Integrates price feeds from Chainlink and Pyth.  
  * Performs APY recalculations at regular intervals.  
  * Triggers auto-rebalancing actions based on signals from the LLM.

### Developer Tools **🛠️**

* **CLI:** A command-line interface for developers to create, deploy, and monitor strategies.  
* **REST API:** An API to integrate Yetify's yield discovery and automation features into external applications.

## **3️⃣ MVP Build Steps**

### Phase 1 — Core Build

* Deploy a basic vault contract.  
* Integrate the LLM to output a prompt-to-strategy JSON.  
* Build the CLI and a basic dashboard.  
* Support initial strategies on NEAR and Ethereum.

### Phase 2 — AI + Multi-Chain Expansion

* Add logic for multi-chain execution.  
* Implement RAG for live yield data injection.  
* Add execution within a secure enclave (TEE).

### Phase 3 — No-Code Strategy Builder & Marketplace

* Develop a drag-and-drop, no-code UI for strategy building.  
* Implement public strategy sharing and cloning features.  
* Integrate community-based risk scoring.

## **4️⃣ Stack Recommendation**

* **Frontend:** Next.js, Tailwind, Wagmi, NEAR API JS  
* **Backend:** Node.js, Express, GraphQL  
* **AI Layer:** Gemini API, LangChain, Vector DB (Pinecone / Weaviate)  
* **Smart Contracts:** Rust (NEAR), Solidity (Ethereum/EVM)  
* **Automation:** NEAR Intents, TEE Agents (Phala / iExec)  
* **Data Feeds:** Chainlink, Pyth  
* **Bridging:** Near-intent

## **5️⃣ Quick Wins**

* Start with low-risk stablecoin and ETH strategies.  
* Ensure the prompt → plan → preview → execute flow is transparent and easy for users to follow.  
* Release the CLI and a minimal dashboard early to gather feedback.  
* Add analytics and backtesting functionality in a later phase.

---

## Development Setup

Built on NEAR Foundation and Blockchain

### Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
