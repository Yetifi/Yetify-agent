use near_sdk::{near_bindgen, AccountId};
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
#[derive(Default)]
pub struct YetifyStrategyStorage {
    // Contract state will be added incrementally
}

#[near_bindgen]
impl YetifyStrategyStorage {
    // Functions will be added step by step
}