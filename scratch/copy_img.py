import shutil
import os

src = "/Users/dncnguyen/Antigravity/DNC Operator/vmm100/runner.png"
dst = "/Users/dncnguyen/Antigravity/DNC Operator/vmm26/runner.png"

os.makedirs(os.path.dirname(dst), exist_ok=True)
try:
    shutil.copy2(src, dst)
    print("Success")
except Exception as e:
    print(f"Error: {e}")
