import re

with open('/tmp/old_index.html', 'r', encoding='utf-8') as f:
    old_content = f.read()

with open('trading/index.html', 'r', encoding='utf-8') as f:
    current_content = f.read()

# Extract the script block from old_content
old_script = re.search(r'(<script>.*?</script>)', old_content, flags=re.DOTALL).group(1)

# Replace the script block in current_content
new_content = re.sub(r'<script>.*?</script>', old_script, current_content, flags=re.DOTALL)

with open('trading/index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("Restored JS from 0790b60 successfully.")
