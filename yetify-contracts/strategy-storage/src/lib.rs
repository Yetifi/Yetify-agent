use near_sdk::{near_bindgen, AccountId, collections::UnorderedMap, BorshDeserialize, BorshSerialize};
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
    // Functions will be added step by step
}