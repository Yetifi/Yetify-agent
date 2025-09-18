use near_sdk::{near_bindgen, AccountId, collections::UnorderedMap, BorshDeserialize, BorshSerialize, env};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct StrategyData {
    pub id: String,
    pub goal: String,
    pub chains: Vec<String>,
    pub protocols: Vec<String>,
    pub risk_level: String,
    pub creator: AccountId,
    pub created_at: u64,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct YetifyStrategyStorage {
    strategies: UnorderedMap<String, StrategyData>,
    strategy_count: u64,
}

impl Default for YetifyStrategyStorage {
    fn default() -> Self {
        Self {
            strategies: UnorderedMap::new(b"strategies"),
            strategy_count: 0,
        }
    }
}

#[near_bindgen]
impl YetifyStrategyStorage {
    pub fn store_strategy(&mut self, id: String, goal: String) -> String {
        let creator = env::predecessor_account_id();
        let timestamp = env::block_timestamp_ms();
        
        let strategy_data = StrategyData {
            id: id.clone(),
            goal,
            chains: vec![],
            protocols: vec![],
            risk_level: "medium".to_string(),
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
}