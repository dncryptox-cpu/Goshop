#!/bin/sh
# godnc.com (trang gốc) = bản sao của trading/index.html. Sửa trading/index.html rồi chạy: sh trading/sync_root.sh
cd "$(dirname "$0")/.." && sed '1a <!-- BẢN SAO TỰ ĐỘNG của trading/index.html — đừng sửa file này, sửa trading/index.html rồi chạy trading/sync_root.sh -->' trading/index.html > index.html && echo "Đã đồng bộ index.html ← trading/index.html"
