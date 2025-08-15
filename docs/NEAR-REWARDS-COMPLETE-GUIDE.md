# NEAR Protocol Rewards - Sıfırdan Diamond Tier ($10,000) Rehberi

## 📊 Sistem Genel Bakış

NEAR Protocol Rewards, geliştiricilere katkılarına göre otomatik ödüller veren bir sistemdir.

### Puanlama Sistemi (0-100)
- **Off-Chain (GitHub)**: 80 puan
- **On-Chain (Blockchain)**: 20 puan

### Ödül Seviyeleri
| Puan Aralığı | Seviye | Ödül |
|--------------|--------|------|
| 85-100 | Diamond | $10,000 |
| 70-84 | Gold | $6,000 |
| 55-69 | Silver | $3,000 |
| 40-54 | Bronze | $1,000 |
| 20-39 | Contributor | $500 |
| 1-19 | Explorer | $100 |

---

## 🎯 ADIM 1: PROJE HAZIRLIGI

### 1.1 GitHub Repository Oluştur
```bash
# Yeni repo oluştur
git init my-near-project
cd my-near-project

# README.md ve temel dosyalar ekle
echo "# My NEAR Project" > README.md
echo "node_modules/" > .gitignore
```

### 1.2 NEAR Account Oluştur
```bash
# NEAR CLI yükle
npm install -g near-cli

# Mainnet account oluştur (MyNearWallet kullan)
# Örnek: myproject.near
```

### 1.3 Temel Proje Yapısı
```
my-near-project/
├── README.md
├── package.json
├── src/
│   └── index.ts
├── contracts/
│   └── hello-world/
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## 🏗️ ADIM 2: OFF-CHAIN METRİKLER (80 PUAN)

### 2.1 Commits (28 puan - Hedef: 100 commit)

**Strateji: Günlük Küçük Commitler**
```bash
# Günde 3-5 küçük commit yap (20 gün = 100 commit)
git add .
git commit -m "feat: add basic project structure"
git commit -m "docs: update README with project description"
git commit -m "refactor: improve code organization"
git commit -m "fix: resolve minor bug in function"
git commit -m "test: add unit tests for core functions"
```

**Commit Türleri:**
- `feat:` - Yeni özellik
- `fix:` - Bug fix
- `docs:` - Dokümantasyon
- `test:` - Test ekleme
- `refactor:` - Kod iyileştirme
- `style:` - Formatting
- `chore:` - Maintenance

### 2.2 Pull Requests (22 puan - Hedef: 25 PR)

**Strateji: Feature Branch Workflow**
```bash
# Her özellik için yeni branch
git checkout -b feature/user-authentication
# Değişiklik yap
git commit -m "feat: implement user authentication"
git push origin feature/user-authentication
# GitHub'da PR oluştur ve merge et
```

**PR Örnekleri:**
- Authentication system
- Database integration
- API endpoints
- Frontend components
- Testing framework
- Documentation updates
- Performance optimizations

### 2.3 Reviews (16 puan - Hedef: 30 review)

**Strateji: Community Participation**
- Diğer NEAR projelerini review et
- Open source katkılarda bulun
- Code review exchange programları katıl

### 2.4 Issues (14 puan - Hedef: 30 closed issue)

**Strateji: Planlı Issue Management**
```bash
# GitHub Issues oluştur ve kapat
- [ ] Setup project structure
- [ ] Implement core functionality
- [ ] Add documentation
- [ ] Write tests
- [ ] Performance optimization
```

---

## ⛓️ ADIM 3: ON-CHAIN METRİKLER (20 PUAN)

### 3.1 Transaction Volume (8 puan - Hedef: $10,000)

**Yaklaşım 1: Token Swaps**
```bash
# DEX swaps ile volume oluştur
near call v2.ref-finance.near swap \
  '{"actions": [{"pool_id": 0, "token_in": "wrap.near", "amount_in": "1000000000000000000000", "token_out": "usdc.factory.bridge.near", "min_amount_out": "0"}]}' \
  --accountId myproject.near \
  --amount 0.000000000000000000000001 \
  --gas 100000000000000
```

**Yaklaşım 2: Liquidity Operations**
```bash
# LP token ekleme/çıkarma
# Aurora bridge işlemleri
# NFT alım-satım
```

**Volume Stratejisi:**
- **Conservative**: 100x $100 swaps = $10,000
- **Aggressive**: 20x $500 swaps = $10,000
- **Mixed**: DEX + Bridge + LP operations

### 3.2 Smart Contract Calls (8 puan - Hedef: 500 call)

**Ultra-Cheap Call Strategy:**

**A) View Functions (En Ucuz - Gas Only)**
```bash
# Günde 50 view call = 10 günde 500 call
near view wrap.near ft_metadata '{}' --networkId mainnet
near view v2.ref-finance.near get_number_of_pools '{}' --networkId mainnet
near view meta-pool.near get_contract_info '{}' --networkId mainnet
near view token.v2.ref-finance.near ft_total_supply '{}' --networkId mainnet
```

**B) Ultra-Micro Transfers**
```bash
# Çok düşük maliyetli transfers
near send-near myproject.near target-wallet.near 0.0000000001 --networkId mainnet
# Maliyet: ~$0.001 per call
```

**C) Wrap/Unwrap Cycles**
```bash
# NEAR ↔ wNEAR döngüleri
near call wrap.near near_deposit '{}' --accountId myproject.near --amount 0.001 --networkId mainnet
near call wrap.near near_withdraw '{"amount":"1000000000000000000000"}' --accountId myproject.near --amount 0.000000000000000000000001 --networkId mainnet
```

**Call Distribution:**
- **View functions**: 300 calls (gas only)
- **Transfers**: 100 calls (~$0.10)
- **Wrap/unwrap**: 50 calls (~$0.50)
- **Other contracts**: 50 calls (~$1.00)

### 3.3 Unique Wallets (4 puan - Hedef: 100 wallet)

**Strateji: Multiple Wallet Creation**
```bash
# Kendi walletlarını oluştur
myproject.near
myproject-dev.near
myproject-test.near
myproject-01.near
myproject-02.near
# ... (100'e kadar)
```

**Wallet Interaction Plan:**
- Her wallet'e micro transfer (0.0001 NEAR)
- Cross-wallet testing operations
- Different wallet roles (admin, user, tester)

---

## 📋 ADIM 4: SİSTEME KAYIT

### 4.1 Protocol Rewards'a Başvuru
```json
// data.json'a eklenecek entry
{
  "project": "my-near-project",
  "wallet": "myproject.near",
  "website": "https://github.com/myusername/my-near-project",
  "repository": [
    "myusername/my-near-project"
  ]
}
```

### 4.2 GitHub'ta Pull Request
1. `near-horizon/near-protocol-rewards` repo'sunu fork et
2. `src/data.json` dosyasını düzenle
3. Projenin entry'sini ekle
4. Pull request oluştur

---

## ⚡ ADIM 5: HIZLI UYGULAMA STRATEJİSİ

### 5.1 30 Günlük Diamond Plan

**Hafta 1-2: Off-chain Foundation**
- **Gün 1-3**: Repository setup, initial commits
- **Gün 4-7**: 20 commit, 5 PR, 5 issue
- **Gün 8-14**: 30 commit, 10 PR, 10 issue

**Hafta 3: On-chain Preparation**
- **Gün 15-17**: Wallet setup, credentials
- **Gün 18-21**: View functions blitz (200 calls)

**Hafta 4: Final Push**
- **Gün 22-26**: Volume generation ($10,000)
- **Gün 27-30**: Complete remaining calls, final commits

### 5.2 Günlük Routine

**Morning (30 min):**
```bash
# 3 commits
git commit -m "feat: daily feature update"
git commit -m "docs: update documentation"
git commit -m "test: add daily tests"

# 10 view calls
near view wrap.near ft_metadata '{}' --networkId mainnet
# ... (10 different contracts)
```

**Evening (20 min):**
```bash
# 5 micro transfers
near send-near myproject.near target1.near 0.0000000001 --networkId mainnet
# ... (5 transfers)

# 1 PR merge
git merge feature/daily-feature
```

---

## 💰 MALİYET ANALİZİ

### Minimum Maliyet Stratejisi
| Metrik | Strateji | Maliyet |
|--------|----------|---------|
| 500 Calls | View functions + micro transfers | $2.00 |
| $10K Volume | 100x $100 swaps | $50.00 |
| 100 Wallets | Create + fund | $2.00 |
| **TOPLAM** | | **$54.00** |

**ROI: $10,000 / $54 = 185x**

---

## 🎯 ADIM 6: OTOMATİZASYON

### 6.1 Automated Commit Script
```javascript
// auto-commit.js
const { exec } = require('child_process');

const commitTypes = ['feat', 'fix', 'docs', 'test', 'refactor'];
const messages = [
  'improve user experience',
  'optimize performance',
  'add error handling',
  'update documentation',
  'refactor code structure'
];

function dailyCommits() {
  for (let i = 0; i < 3; i++) {
    const type = commitTypes[Math.floor(Math.random() * commitTypes.length)];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    exec(`git commit --allow-empty -m "${type}: ${msg}"`);
  }
}

dailyCommits();
```

### 6.2 Automated Call Script
```javascript
// auto-calls.js
const { exec } = require('child_process');

const contracts = [
  'wrap.near',
  'v2.ref-finance.near',
  'meta-pool.near',
  'token.v2.ref-finance.near'
];

function dailyCalls() {
  contracts.forEach(contract => {
    exec(`near view ${contract} ft_metadata '{}' --networkId mainnet`);
  });
}

dailyCalls();
```

---

## 📊 ADIM 7: PROGRESS TRACKING

### 7.1 Dashboard Monitoring
- **Official Dashboard**: Protocol Rewards platform
- **NearBlocks**: `https://nearblocks.io/token/exportdata?address=myproject.near`
- **GitHub Insights**: Repository activity

### 7.2 Progress Checklist

**Off-Chain Progress:**
- [ ] 25/100 commits
- [ ] 5/25 pull requests
- [ ] 10/30 reviews
- [ ] 8/30 issues

**On-Chain Progress:**
- [ ] 125/500 contract calls (25%)
- [ ] $2,500/$10,000 volume (25%)
- [ ] 25/100 unique wallets (25%)

**Current Score Estimate:**
- Off-chain: ~20/80 points
- On-chain: ~5/20 points
- **Total: ~25/100 (Bronze tier - $1,000)**

---

## 🚨 ADIM 8: YAKINLAR VE RİSKLER

### 8.1 Sık Yapılan Hatalar
- **Empty commits**: Anlamlı değişiklik olmadan commit
- **Spam calls**: Aynı contract'a tekrar tekrar call
- **Fake metrics**: Botting veya fake activity
- **Poor documentation**: README ve docs eksikliği

### 8.2 Best Practices
- **Quality over quantity**: Anlamlı contributions
- **Diverse activity**: Farklı türde operations
- **Community engagement**: Gerçek project building
- **Documentation**: Comprehensive project docs

### 8.3 Validation System
- Automated validators check data integrity
- Human review for suspicious patterns
- Community reporting system
- Regular audit processes

---

## 🎉 ADIM 9: DIAMOND TİER'A ULAŞMA

### 9.1 Final Sprint (Son 7 Gün)

**85+ Puan için gerekli:**
- **Off-chain**: 68/80 puan (85% completion)
- **On-chain**: 17/20 puan (85% completion)

**Daily targets:**
- 10 meaningful commits
- 2 PRs with substantial changes
- 3 issues closed
- 50 contract calls
- $1,000 transaction volume

### 9.2 Quality Assurance
- Code reviews by community
- Documentation completeness check
- Real project value demonstration
- Sustainable development practices

---

## 📞 ADIM 10: KAYNAK VE DESTEK

### 10.1 Faydalı Linkler
- **Official Docs**: [NEAR Protocol Rewards](https://github.com/near-horizon/near-protocol-rewards)
- **NEAR CLI**: [Documentation](https://docs.near.org/tools/near-cli)
- **GitHub**: [Repository](https://github.com/near-horizon/near-protocol-rewards)
- **NearBlocks**: [Explorer](https://nearblocks.io)

### 10.2 Community Resources
- **Discord**: NEAR Protocol community
- **Telegram**: Developer groups
- **Forum**: Official NEAR forum
- **Stack Overflow**: Technical questions

---

## 🏆 SONUÇ

**Diamond tier ($10,000) için tam strateji:**

1. **30 gün** süre
2. **$54** yatırım
3. **Günde 2 saat** çalışma
4. **Sistematik yaklaşım**
5. **Community involvement**

**Başarı faktörleri:**
- Consistency (düzenli activity)
- Quality (anlamlı contributions)
- Strategy (doğru metric targeting)
- Patience (sistem validation süreci)

**Expected outcome:**
- **185x ROI** 
- **Sürdürülebilir funding**
- **NEAR ecosystem recognition**
- **Developer network growth**

---

*Bu rehber, NEAR Protocol Rewards sisteminde maksimum başarı için optimize edilmiş bir stratejidir. Her adımı dikkatlice takip ederek Diamond tier'a ulaşabilir ve $10,000 ödülü kazanabilirsiniz.*