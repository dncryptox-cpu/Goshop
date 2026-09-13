import re

with open('/tmp/old_index.html', 'r', encoding='utf-8') as f:
    old_content = f.read()

with open('trading/index.html', 'r', encoding='utf-8') as f:
    current_content = f.read()

start_marker = "    <script>\n        function tradingApp() {"
end_marker = "</body>\n</html>"

old_script_block = old_content[old_content.find(start_marker) : old_content.rfind(end_marker)]
current_before = current_content[:current_content.find(start_marker)]
current_after = current_content[current_content.rfind(end_marker):]

new_content = current_before + old_script_block + current_after

with open('trading/index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("Restored Alpine JS block successfully.")
