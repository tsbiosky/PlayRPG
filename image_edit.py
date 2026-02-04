from PIL import Image

def remove_background(image_path, output_path=None):
    """
    Removes white/near-white background from an image.
    """
    if output_path is None:
        output_path = image_path
        
    img = Image.open(image_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        # Check if pixel is near white (adjust threshold if needed)
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(output_path)
    print(f"Background removed from {image_path}")

def crop_to_content(image_path, output_path=None):
    """
    Crops the image to its non-transparent bounding box.
    """
    if output_path is None:
        output_path = image_path
        
    img = Image.open(image_path).convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        img.save(output_path)
        print(f"Cropped {image_path} to content")
    else:
        print(f"No content found in {image_path}")

def normalize_sprite_sheet(image_path, frames=9, frame_size=128, columns=3, rows=3, output_path=None):
    """
    Normalize a sprite sheet into a standard RPG format.
    - Divides the image into a grid.
    - For each cell, finds the character and centers it in a fixed-size frame.
    """
    if output_path is None:
        output_path = image_path

    img = Image.open(image_path).convert("RGBA")
    
    # Instead of cropping the whole image, we divide the original image into the grid
    # This assumes the LLM followed the grid instructions roughly.
    width, height = img.size
    cell_width = width / columns
    cell_height = height / rows

    # Create new sheet
    sheet = Image.new(
        "RGBA",
        (frame_size * columns, frame_size * rows),
        (0, 0, 0, 0),
    )

    for r in range(rows):
        for c in range(columns):
            # Define the source cell
            left = int(round(c * cell_width))
            right = int(round((c + 1) * cell_width))
            top = int(round(r * cell_height))
            bottom = int(round((r + 1) * cell_height))
            
            cell = img.crop((left, top, right, bottom))
            
            # Find the character within this cell
            cell_bbox = cell.getbbox()
            if cell_bbox:
                char_crop = cell.crop(cell_bbox)
                
                # Resize character to fit frame while maintaining aspect ratio
                # We want the character to be roughly 80-90% of the frame height
                target_h = int(frame_size * 0.9)
                ratio = target_h / char_crop.height
                target_w = int(char_crop.width * ratio)
                
                char_resized = char_crop.resize((target_w, target_h), Image.NEAREST)
                
                # Paste character centered in the frame
                paste_x = (c * frame_size) + (frame_size - target_w) // 2
                paste_y = (r * frame_size) + (frame_size - target_h) // 2
                sheet.paste(char_resized, (paste_x, paste_y), char_resized)
            else:
                print(f"No content found in cell ({r}, {c})")

    sheet.save(output_path)
    print(f"Robust normalized sprite sheet saved to {output_path}")
