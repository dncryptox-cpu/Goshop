import re
with open('trading/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove VIEW 5
content = re.sub(r'<!-- VIEW 5: BACKTEST \(VỐN RIÊNG\) -->.*?<!-- BOTTOM NAV BAR - Mobile Only -->', '<!-- BOTTOM NAV BAR - Mobile Only -->', content, flags=re.DOTALL)

# Remove BACKTEST MODE NOTICE
content = re.sub(r'<!-- BACKTEST MODE NOTICE -->.*?<!-- MAIN LAYOUT -->', '<!-- MAIN LAYOUT -->', content, flags=re.DOTALL)

with open('trading/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Cleaned VIEW 5 and BACKTEST NOTICE")
