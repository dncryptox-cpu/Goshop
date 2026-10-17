#!/usr/bin/env python3
"""Ghép qlkh/index.html từ src/ rồi build CSS Tailwind tĩnh.

Sửa giao diện ở src/shell.html, src/modules/*.html, src/modals/*.html; sửa logic ở js/modules/*.js.
Sau đó chạy:  python3 qlkh/build.py   (cần Node/npx để build CSS)
"""
import glob, os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')

# Thứ tự nạp JS: core trước, các module sau (thứ tự không quan trọng vì gộp thành 1 object).
JS_MODULES = ['core', 'auth', 'data', 'dashboard', 'pnl', 'refunds', 'manual', 'datagoc',
              'famspot', 'famrenew', 'pricing', 'twofa', 'promo']

ROOT_RE = re.compile(r'^(\s*)<div x-show="([^"]+)"\s+x-cloak(.*)$')


def wrap_module(html, name):
    """Đổi thẻ gốc x-show của module thành <template x-if>: module chưa mở thì không render DOM."""
    lines = html.rstrip('\n').split('\n')
    for i, line in enumerate(lines):
        if line.strip().startswith('<!--') or not line.strip():
            continue
        m = ROOT_RE.match(line)
        if not m:
            sys.exit(f'[{name}] dòng gốc không đúng dạng <div x-show="..." x-cloak ...>: {line.strip()[:80]}')
        indent, expr, rest = m.groups()
        lines[i] = f'{indent}<template x-if="{expr}">\n{indent}<div{rest}'
        lines.append(f'{indent}</template>')
        return '\n'.join(lines)
    sys.exit(f'[{name}] rỗng')


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def main():
    version = time.strftime('%y%m%d%H%M')
    shell = read(os.path.join(SRC, 'shell.html'))
    modules = '\n'.join(wrap_module(read(p), os.path.basename(p))
                        for p in sorted(glob.glob(os.path.join(SRC, 'modules', '*.html'))))
    modals = '\n'.join(read(p) for p in sorted(glob.glob(os.path.join(SRC, 'modals', '*.html'))))
    scripts = '\n'.join(f'    <script defer src="js/modules/{m}.js?v={version}"></script>' for m in JS_MODULES)
    for m in JS_MODULES:
        if not os.path.exists(os.path.join(ROOT, 'js', 'modules', m + '.js')):
            sys.exit(f'thiếu js/modules/{m}.js')
    out = (shell.replace('{{MODULES}}', modules)
                .replace('{{MODALS}}', modals)
                .replace('{{MODULE_SCRIPTS}}', scripts)
                .replace('{{VERSION}}', version))
    with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
        f.write('<!-- File được sinh từ qlkh/src bằng build.py — đừng sửa trực tiếp. -->\n' + out)
    print('index.html', len(out) // 1024, 'KB')

    if '--no-css' not in sys.argv:
        for cfg in sorted(glob.glob(os.path.join(ROOT, 'tailwind', '*.config.js'))):
            name = os.path.basename(cfg).replace('.config.js', '')
            subprocess.run(['npx', '--yes', 'tailwindcss@3.4.19', '-c', cfg,
                            '-i', os.path.join(ROOT, 'tailwind', f'{name}.input.css'),
                            '-o', os.path.join(ROOT, 'css', f'{name}.css'), '--minify'],
                           check=True, cwd=ROOT)


if __name__ == '__main__':
    main()
