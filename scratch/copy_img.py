import shutil
import os

src = "/Users/dncnguyen/.gemini/antigravity/brain/51371769-ba67-4de9-bdf3-3201f906418b/vmm_runner_background_1782536094660.png"
dst = "/Users/dncnguyen/Antigravity/DNC Operator/vmm26/runner.png"

os.makedirs(os.path.dirname(dst), exist_ok=True)
try:
    shutil.copy2(src, dst)
    print("Success")
except Exception as e:
    print(f"Error: {e}")
