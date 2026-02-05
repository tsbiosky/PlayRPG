from PIL import Image, ImageFilter
import os
from image_edit import remove_background

def process_logo():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    logo_path = os.path.join(base_dir, 'logo.jpg')
    logo_png_path = os.path.join(base_dir, 'logo.png')
    
    if os.path.exists(logo_path):
        print(f"Processing {logo_path}...")
        # First convert to PNG to support transparency
        img = Image.open(logo_path).convert("RGBA")
        img.save(logo_png_path)
        
        # Use the improved remove_background function
        remove_background(logo_png_path)
        print(f"Logo background removed and saved to {logo_png_path}")
    else:
        print(f"Error: {logo_path} not found.")

if __name__ == "__main__":
    process_logo()
