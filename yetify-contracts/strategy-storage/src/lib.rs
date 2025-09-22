use near_sdk::{near, env, AccountId, serde_json};
use near_sdk::store::UnorderedMap;

#[near(serializers = [borsh, json])]
#[derive(Default, Clone)]
pub struct StrategyStep {
    pub action: String,
    pub protocol: String,
    pub asset: String,
    pub expected_apy: Option<f64>,
    pub amount: Option<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct StrategyData {
    pub id: String,
    pub goal: String,
    pub chains: Vec<String>,
    pub protocols: Vec<String>,
    pub steps: Vec<StrategyStep>,
    pub risk_level: String,
    pub estimated_apy: Option<f64>,
    pub estimated_tvl: Option<String>,
    pub confidence: Option<f64>,
    pub reasoning: Option<String>,
    pub warnings: Option<Vec<String>>,
    pub creator: AccountId,
    pub created_at: u64,
}

impl Default for StrategyData {
    fn default() -> Self {
        Self {
            id: String::new(),
            goal: String::new(),
            chains: Vec::new(),
            protocols: Vec::new(),
            steps: Vec::new(),
            risk_level: "medium".to_string(),
            estimated_apy: None,
            estimated_tvl: None,
            confidence: None,
            reasoning: None,
            warnings: None,
            creator: "default.testnet".parse().unwrap(),
            created_at: 0,
        }
    }
}

#[near(contract_state)]
#[derive(Default)]
pub struct YetifyStrategyStorage {
    strategies: HashMap<String, StrategyData>,
    strategy_count: u64,
}

#[near]
impl YetifyStrategyStorage {
    #[payable]
    pub fn store_complete_strategy(&mut self, strategy_json: String) -> String {
        let creator = env::predecessor_account_id();
        let timestamp = env::block_timestamp_ms();
        
        // Parse the JSON strategy data with better error handling
        let mut strategy_data: StrategyData = match serde_json::from_str(&strategy_json) {
            Ok(data) => data,
            Err(err) => {
                env::log_str(&format!("JSON Parse Error: {}", err));
                env::log_str(&format!("Input JSON: {}", strategy_json));
                return format!("Error: Failed to parse strategy JSON - {}", err);
            }
        };
        
        // Validate required fields
        if strategy_data.id.is_empty() {
            return "Error: Strategy ID is required".to_string();
        }
        
        // Set additional metadata
        strategy_data.creator = creator;
        strategy_data.created_at = timestamp;
        
        // Store the complete strategy data
        let strategy_id = strategy_data.id.clone();
        self.strategies.insert(strategy_id.clone(), strategy_data);
        self.strategy_count += 1;
        
        format!("Complete strategy '{}' stored successfully! Total strategies: {}", strategy_id, self.strategy_count)
    }

    #[payable]
    pub fn store_strategy(&mut self, id: String, goal: String) -> String {
        let creator = env::predecessor_account_id();
        let timestamp = env::block_timestamp_ms();
        
        let strategy_data = StrategyData {
            id: id.clone(),
            goal,
            chains: vec![],
            protocols: vec![],
            steps: vec![],
            risk_level: "medium".to_string(),
            estimated_apy: None,
            estimated_tvl: None,
            confidence: None,
            reasoning: None,
            warnings: None,
            creator,
            created_at: timestamp,
        };
        
        self.strategies.insert(id.clone(), strategy_data);
        self.strategy_count += 1;
        
        format!("Strategy '{}' stored successfully!", id)
    }

    pub fn get_strategy(&self, id: String) -> Option<StrategyData> {
        self.strategies.get(&id).cloned()
    }

    pub fn total_strategies(&self) -> u64 {
        self.strategy_count
    }

    pub fn get_contract_info(&self) -> String {
        format!("Yetify Strategy Storage - Total strategies: {}", self.strategy_count)
    }

    #[payable]
    pub fn update_strategy(&mut self, strategy_json: String) -> String {
        let caller = env::predecessor_account_id();
        
        // Parse the JSON strategy data
        let mut strategy_data: StrategyData = match serde_json::from_str(&strategy_json) {
            Ok(data) => data,
            Err(err) => {
                env::log_str(&format!("JSON Parse Error: {}", err));
                return format!("Error: Failed to parse strategy JSON - {}", err);
            }
        };
        
        // Check if strategy exists
        let existing_strategy = match self.strategies.get(&strategy_data.id) {
            Some(strategy) => strategy,
            None => {
                return format!("Error: Strategy '{}' not found", strategy_data.id);
            }
        };
        
        // Verify ownership (only creator can update)
        if existing_strategy.creator != caller {
            return format!("Error: Only the strategy creator can update this strategy");
        }
        
        // Preserve original creator and created_at
        strategy_data.creator = existing_strategy.creator.clone();
        strategy_data.created_at = existing_strategy.created_at;
        
        // Update the strategy
        let strategy_id = strategy_data.id.clone();
        self.strategies.insert(strategy_id.clone(), strategy_data);
        
        format!("Strategy '{}' updated successfully!", strategy_id)
    }

    #[payable]
    pub fn delete_strategy(&mut self, id: String) -> String {
        let caller = env::predecessor_account_id();
        
        // Check if strategy exists
        let existing_strategy = match self.strategies.get(&id) {
            Some(strategy) => strategy,
            None => {
                return format!("Error: Strategy '{}' not found", id);
            }
        };
        
        // Verify ownership (only creator can delete)
        if existing_strategy.creator != caller {
            return format!("Error: Only the strategy creator can delete this strategy");
        }
        
        // Delete the strategy
        self.strategies.remove(&id);
        self.strategy_count -= 1;
        
        format!("Strategy '{}' deleted successfully! Total strategies: {}", id, self.strategy_count)
    }

    pub fn get_strategies_by_creator(&self, creator: AccountId) -> Vec<StrategyData> {
        self.strategies
            .values()
            .filter(|strategy| strategy.creator == creator)
            .cloned()
            .collect()
    }

    pub fn get_all_strategies(&self) -> Vec<StrategyData> {
        self.strategies.values().cloned().collect()
    }
}