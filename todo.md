# Yetify-Agent Contract Development TODO

## Mevcut Durum
- 5/8 contract fonksiyonu tamamland1
- Eksik fonksiyonlar: update_strategy, delete_strategy, get_strategies_by_creator, get_all_strategies
- Feature branch: feature/mvp-core-implementation

## 6-Step Development Process

### 1. Issue Aç1lacak
- GitHub'da "Implement advanced contract functions" issue'sunu olu_tur
- Missing functions listesini ekle:
  - update_strategy (ownership validation ile)
  - delete_strategy (ownership validation ile) 
  - get_strategies_by_creator (query function)
  - get_all_strategies (query function)
- Acceptance criteria tan1mla
- Labels ekle: enhancement, blockchain, contract

### 2. Kod Yaz1lacak
- Reference implementation'dan (/docs/.yetify-contracts/) kod kopyala
- 4 missing function'1 strategy-storage/src/lib.rs'e ekle
- Ownership validation logic'i implement et
- Error handling ve logging ekle
- Serde serialization düzenle

### 3. Commitler Ad1m Ad1m At1lacak
```
Commit 1: "add update_strategy function with ownership validation"
Commit 2: "add delete_strategy function with ownership validation"  
Commit 3: "add get_strategies_by_creator query function"
Commit 4: "add get_all_strategies query function"
```

### 4. PR Aç1lacak
- Feature branch'den main'e PR olu_tur
- Title: "feat: implement advanced contract functions"
- Description: completed functions listesi
- Issue'yu link et (#issue_number)
- Breaking changes olmad11n1 belirt

### 5. Review Yap1lacak
- Code review süreci
- Contract test sonuçlar1 kontrol et
- Deployment test yap
- Function'lar1 tek tek test et

### 6. Issue Kapat1l1p Merge Yap1lacak
- PR'1 approve et
- Issue'yu close et
- Feature branch'i main'e merge et
- Tag version art1r
- Contract deployment plan1 haz1rla

## Expected Outcome
- 8/8 contract fonksiyonu complete
- 4 meaningful commit
- 1 closed issue  
- 1 merged PR
- GitHub activity boost for NEAR Protocol Rewards