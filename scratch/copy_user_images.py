import shutil
import os

# Source directory where the Gemini app uploads are saved
src_dir = '/Users/dncnguyen/.gemini/antigravity/brain/51371769-ba67-4de9-bdf3-3201f906418b'
dst_dir = 'vmm100/assets'

os.makedirs(dst_dir, exist_ok=True)

# Map the uploaded images to meaningful filenames
mapping = {
    'media__1782536934250.jpg': 'dlut_night_flask.jpg',
    'media__1782536934331.jpg': 'dlut_night_water.jpg',
    'media__1782536934345.jpg': 'vmm_finish_badge1.jpg',
    'media__1782536934377.jpg': 'vmm_running_badge.jpg',
    'media__1782536934385.jpg': 'vmm_finish_badge2.jpg'
}

print("Starting to copy photos...")
for src_name, dst_name in mapping.items():
    src_path = os.path.join(src_dir, src_name)
    dst_path = os.path.join(dst_dir, dst_name)
    
    if os.path.exists(src_path):
        try:
            shutil.copy2(src_path, dst_path)
            print(f"✓ Copied: {src_name} -> {dst_path}")
        except Exception as e:
            print(f"✗ Failed to copy {src_name}: {e}")
    else:
        print(f"⚠ Warning: Source file does not exist at {src_path}")

# Copy the primary night shot to be the website background image
primary_bg_src = os.path.join(dst_dir, 'dlut_night_flask.jpg')
primary_bg_dst = 'vmm100/runner.jpg'

if os.path.exists(primary_bg_src):
    try:
        shutil.copy2(primary_bg_src, primary_bg_dst)
        print(f"✓ Set primary background: {primary_bg_dst}")
    except Exception as e:
        print(f"✗ Failed to set primary background: {e}")
else:
    print("⚠ Warning: Primary background image source does not exist.")

print("\nFinished processing photos.")
