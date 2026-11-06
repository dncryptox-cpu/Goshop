import re
with open('trading/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace tradingMode: 'LIVE', // 'LIVE' hoặc 'BACKTEST' -> tradingMode: 'LIVE', (we can actually just remove it, but let's keep it safe by just removing references)
content = re.sub(r'this\.tradingMode === \'BACKTEST\' \? `dnc_backtest_trades_\$\{u\}` : ', '', content)
content = re.sub(r"if \(this\.tradingMode === 'BACKTEST'\) return;", "", content)
content = re.sub(r"if \(!this\.traderUsername \|\| this\.tradingMode === 'BACKTEST'\) return;", "if (!this.traderUsername) return;", content)
content = re.sub(r"if \(this\.tradingMode === 'BACKTEST'\) \{[\s\S]*?\} else \{([\s\S]*?)\}", r"\1", content)
content = re.sub(r"const storageKey = this\.tradingMode === 'BACKTEST' \? `dnc_backtest_capital_\$\{u\}` : `dnc_capital_\$\{u\}`;", "const storageKey = `dnc_capital_${u}`;", content)

with open('trading/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Cleaned JS variables")
