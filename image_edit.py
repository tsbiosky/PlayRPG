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

def normalize_sprite_sheet(image_path, frames=4, frame_size=128, columns=2, rows=2, output_path=None):
    """
    Normalize a sprite sheet into a single row of fixed-size frames.
    - Finds the non-transparent bounding box
    - Splits into N frames
    - Resizes each frame to frame_size x frame_size
    """
    if output_path is None:
        output_path = image_path

    img = Image.open(image_path).convert("RGBA")
    bbox = img.getbbox()
    if not bbox:
        print(f"No content found in {image_path}")
        return

    cropped = img.crop(bbox)
    width, height = cropped.size
    frame_width = width / columns
    frame_height = height / rows

    sheet = Image.new(
        "RGBA",
        (frame_size * columns, frame_size * rows),
        (0, 0, 0, 0),
    )
    for index in range(frames):
        col = index % columns
        row = index // columns
        if row >= rows:
            break
        left = int(round(col * frame_width))
        right = int(round((col + 1) * frame_width))
        top = int(round(row * frame_height))
        bottom = int(round((row + 1) * frame_height))
        frame = cropped.crop((left, top, right, bottom))
        frame = frame.resize((frame_size, frame_size), Image.NEAREST)
        sheet.paste(frame, (col * frame_size, row * frame_size))

    sheet.save(output_path)
    print(f"Normalized sprite sheet saved to {output_path}")
