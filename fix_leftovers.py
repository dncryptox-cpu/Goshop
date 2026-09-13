import re

with open('trading/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix HTML leftovers: find the <main> block start, and the KPI SUMMARY, and remove the broken button in between
content = re.sub(
    r'(<main class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-4 sm:py-8 space-y-5 sm:space-y-8 pb-safe">)[\s\S]*?(<!-- KPI SUMMARY)',
    r'\1\n\n        \2',
    content
)

# Remove the backtest notice again if it's there
content = re.sub(r'<!-- BACKTEST MODE NOTICE -->[\s\S]*?<!-- AI SMART ASSISTANT PANEL', '<!-- AI SMART ASSISTANT PANEL', content)

# Remove x-show="currentView !== 'BACKTEST'" from KPI SUMMARY
content = content.replace('<div x-show="currentView !== \'BACKTEST\'" class="hidden sm:grid sm:grid-cols-2 md:grid-cols-4 gap-4">', '<div class="hidden sm:grid sm:grid-cols-2 md:grid-cols-4 gap-4">')

# Remove tradingMode variables
content = re.sub(r"tradingMode:\s*'LIVE',\s*// 'LIVE' hoặc 'BACKTEST'", "", content)
content = re.sub(r"const savedMode = localStorage\.getItem\(`dnc_mode_\$\{u\}`\) \|\| 'LIVE';\s*this\.tradingMode = savedMode;", "", content)
content = re.sub(r"if \(savedMode === 'BACKTEST'\) \{[\s\S]*?\} else \{([\s\S]*?)\}", r"\1", content)
content = re.sub(r"if \(viewName === 'BACKTEST'\) \{[\s\S]*?\}", "", content)
content = re.sub(r"this\.switchTradingMode\('BACKTEST'\);", "", content)

# One more fix, the `backtestSubTab` logic? Just remove it
content = re.sub(r"backtestSubTab:\s*'JOURNAL',.*", "", content)

with open('trading/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed leftovers")
