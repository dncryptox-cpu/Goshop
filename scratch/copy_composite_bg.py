import shutil
import os

src = '/Users/dncnguyen/.gemini/antigravity/brain/51371769-ba67-4de9-bdf3-3201f906418b/vmm100_composite_bg_1782537371688.png'
dst = 'vmm100/runner.jpg'

if os.path.exists(src):
    try:
        shutil.copy2(src, dst)
        print("✓ Successfully copied the combined sports poster image to vmm100/runner.jpg!")
    except Exception as e:
        print(f"✗ Failed to copy image: {e}")
else:
    print(f"⚠ Source image not found at: {src}")
