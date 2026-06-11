import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

def replacer_in_attr(match):
    attr_start = match.group(1) # 'class="' or ':class="'
    attr_val = match.group(2)
    attr_end = match.group(3) # '"'
    
    def token_repl(m):
        c = m.group(0)
        # Backgrounds
        if c == 'bg-[#0B0F19]': return 'bg-[#F8FAFC]'
        elif c == 'md:bg-gray-900/20': return 'md:bg-white/70'
        elif c == 'bg-gray-900/10': return 'bg-white/50'
        elif c == 'bg-gray-950/60': return 'bg-white/80'
        elif c == 'bg-black/60': return 'bg-slate-900/30'
        elif c == 'bg-black/80': return 'bg-slate-900/40'
        elif c == 'bg-white/5': return 'bg-slate-900/5'
        elif c == 'hover:bg-white/5': return 'hover:bg-slate-900/5'
        elif c == 'bg-white/10': return 'bg-slate-900/10'
        elif c == 'hover:bg-white/10': return 'hover:bg-slate-900/10'
        elif c == 'bg-gray-800': return 'bg-slate-200'
        
        # Texts
        elif c == 'text-white': return 'text-slate-900'
        elif c == 'hover:text-white': return 'hover:text-slate-900'
        elif c == 'text-gray-300': return 'text-slate-700'
        elif c == 'text-gray-400': return 'text-slate-600'
        elif c == 'hover:text-gray-400': return 'hover:text-slate-600'
        elif c == 'text-gray-500': return 'text-slate-500'
        elif c == 'text-gray-600': return 'text-slate-400'
        
        # Borders
        elif c == 'border-white/5': return 'border-slate-900/5'
        elif c == 'border-gray-800': return 'border-slate-300'
        
        # Logo gradient
        elif c == 'from-white': return 'from-slate-800'
        elif c == 'to-gray-400': return 'to-slate-500'
        
        return c
        
    # Check if this attribute represents something that should keep text-white
    is_btn_or_badge = any(kw in attr_val for kw in [
        'bg-primary', 'from-primary', 'bg-red-500', 'bg-green-500', 
        'bg-orange-500', 'bg-blue-500', 'bg-indigo-500',
        "order.status === 'Active'", "order.status === 'Warning'", "order.status === 'Expired'"
    ])
    
    # We still need to replace other classes in btns but maybe leave text-white alone
    new_attr_val = re.sub(r'[\w/\[\]#:-]+', lambda m: token_repl(m) if (m.group(0) not in ['text-white', 'hover:text-white'] or not is_btn_or_badge) else m.group(0), attr_val)
    
    return f"{attr_start}{new_attr_val}{attr_end}"

new_content = re.sub(r'(class=[\'"]|:class=[\'"])(.*?)([\'"])', replacer_in_attr, content)

# CSS Replacements
css_from = '''        body {
            background: radial-gradient(circle at top right, rgba(255, 107, 0, 0.12), transparent 45%),
                radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.08), transparent 40%),
                #0B0F19;
            color: #F3F4F6;
            min-height: 100vh;
        }

        .glass-panel {
            background: rgba(17, 24, 39, 0.65);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .glass-card {
            background: rgba(31, 41, 55, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .glass-card:hover {
            border-color: rgba(255, 107, 0, 0.3);
            transform: translateY(-2px);
            background: rgba(31, 41, 55, 0.6);
        }'''

css_to = '''        body {
            background: radial-gradient(circle at top right, rgba(255, 107, 0, 0.08), transparent 45%),
                radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.06), transparent 40%),
                #F8FAFC;
            color: #1F2937;
            min-height: 100vh;
        }

        .glass-panel {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(0, 0, 0, 0.06);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
        }

        .glass-card {
            background: rgba(255, 255, 255, 0.5);
            border: 1px solid rgba(0, 0, 0, 0.04);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .glass-card:hover {
            border-color: rgba(255, 107, 0, 0.2);
            transform: translateY(-2px);
            background: rgba(255, 255, 255, 0.9);
            box-shadow: 0 10px 25px rgba(255, 107, 0, 0.05);
        }'''

if css_from in new_content:
    new_content = new_content.replace(css_from, css_to)
else:
    print("Warning: CSS from not found!")

# Scrollbar replacements
new_content = new_content.replace('background: rgba(11, 15, 25, 0.5);', 'background: rgba(0, 0, 0, 0.05);')
new_content = new_content.replace('background: rgba(255, 255, 255, 0.1);', 'background: rgba(0, 0, 0, 0.15);')

# Tailwind config glass border
new_content = new_content.replace("border: 'rgba(255, 255, 255, 0.08)'", "border: 'rgba(0, 0, 0, 0.06)'")

# Remaining stray bg-[#0B0F19]
new_content = new_content.replace('bg-[#0B0F19]', 'bg-[#F8FAFC]')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("Transformation complete.")
