import os
import json
import argparse
import shutil
from llm import GeminiClient
from image_edit import remove_background, crop_to_content, normalize_sprite_sheet
import prompt_hub
from PIL import Image
from google import genai
from google.genai import types
try:
    from bgm import generate_bgm
except Exception:
    generate_bgm = None

def main():
    parser = argparse.ArgumentParser(description='Generate RPG game assets from a story.')
    parser.add_argument('--storyname', type=str, help='Name of the story file (without .txt) to generate a game for.',default='game')
    args = parser.parse_args()

    # Setup folders
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    if args.storyname:
        story_filename = f"{args.storyname}.txt"
        output_folder_name = args.storyname
        
        # Source game dir (template)
        game_dir_source = os.path.join(base_dir, 'game')
        
        # Target game dir
        game_dir = os.path.join(base_dir, output_folder_name)
        assets_dir = os.path.join(game_dir, 'assets')
        
        # Create directories
        os.makedirs(assets_dir, exist_ok=True)
        
        # Copy template files if they don't exist in target
        if not os.path.exists(os.path.join(game_dir, 'game.js')):
            shutil.copy(os.path.join(game_dir_source, 'game.js'), os.path.join(game_dir, 'game.js'))
        if not os.path.exists(os.path.join(game_dir, 'index.html')):
            shutil.copy(os.path.join(game_dir_source, 'index.html'), os.path.join(game_dir, 'index.html'))

        # Copy audio assets if they exist
        walk_src = os.path.join(base_dir, 'walk.mp3')
        hit_src = os.path.join(base_dir, 'hit.wav')
        level_src = os.path.join(base_dir, 'level.mp3')
        default_bgm_src = os.path.join(base_dir, 'default_BGM.mp3')
        walk_dst = os.path.join(assets_dir, 'walk.mp3')
        hit_dst = os.path.join(assets_dir, 'hit.wav')
        level_dst = os.path.join(assets_dir, 'level.mp3')
        default_bgm_dst = os.path.join(assets_dir, 'default_BGM.mp3')
        if os.path.exists(walk_src) and not os.path.exists(walk_dst):
            shutil.copy(walk_src, walk_dst)
        if os.path.exists(hit_src) and not os.path.exists(hit_dst):
            shutil.copy(hit_src, hit_dst)
        if os.path.exists(level_src) and not os.path.exists(level_dst):
            shutil.copy(level_src, level_dst)
        if os.path.exists(default_bgm_src) and not os.path.exists(default_bgm_dst):
            shutil.copy(default_bgm_src, default_bgm_dst)
            
        print(f"Generating game for story '{args.storyname}' in {game_dir}")
        output_json_path = os.path.join(game_dir, "output.json")
        
    else:
        story_filename = 'story.txt'
        game_dir = os.path.join(base_dir, 'game')
        assets_dir = os.path.join(game_dir, 'assets')
        os.makedirs(assets_dir, exist_ok=True)
        output_json_path = os.path.join(base_dir, 'output.json')

    
    # Reference image path
    npc_ref_path = os.path.join(base_dir, 'npc_ref.webp')
    has_ref_image = os.path.exists(npc_ref_path)
    ref_images = [npc_ref_path] if has_ref_image else []
    if has_ref_image:
        print(f"Using reference image: {npc_ref_path}")

    client = GeminiClient()
    
    # 1. Read Story
    story_path = os.path.join(base_dir, story_filename)
    if not os.path.exists(story_path):
        print(f"Error: Story file '{story_filename}' not found.")
        return

    with open(story_path, 'r', encoding='utf-8') as f:
        story = f.read()

    # 2. Extract Story Data to output.json
    if not os.path.exists(output_json_path) or os.path.getsize(output_json_path) == 0:
        print("Extracting story data...")
        raw_data = client.generate_json(story, prompt_hub.prompt_npc)
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=4)
    else:
        with open(output_json_path, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)

    # 3. Generate Assets
    
    # BGM Generation (if prompt exists)
    bgm_prompt = raw_data.get('bgm')
    bgm_path = os.path.join(assets_dir, 'bgm.mp3')
    default_bgm_src = os.path.join(base_dir, 'default_BGM.mp3')
    if bgm_prompt and generate_bgm and not os.path.exists(bgm_path):
        print("Generating BGM...")
        try:
            ok = generate_bgm("generate a bgm for rpg game ,smooth and beatiful" + bgm_prompt, bgm_path)
            if not ok:
                raise RuntimeError("BGM generation returned false")
        except Exception as e:
            print(f"Failed to generate BGM: {e}")
            if os.path.exists(default_bgm_src):
                shutil.copy(default_bgm_src, bgm_path)
                print("Using default_BGM.mp3 as fallback.")
    elif not os.path.exists(bgm_path) and os.path.exists(default_bgm_src):
        shutil.copy(default_bgm_src, bgm_path)
        print("Using default_BGM.mp3 (no prompt or generation skipped).")
    
    # --- GLOBAL CHARACTERS ---
    player_data = raw_data.get('player', {})
    npc_list = raw_data.get('npc_list', [])
    minion_list = raw_data.get('minions', [])
    scenes = raw_data.get('scenes', [])
    
    # Backward compatibility if data is just a list (old format)
    if isinstance(raw_data, list):
        scenes = raw_data
        if len(scenes) > 0:
            player_data = scenes[0].get('player', {})
        npc_list = [] 

    # Deduplicate NPCs within scenes (Merge dialogues)
    for scene in scenes:
        if 'npc' in scene:
            merged_npcs = {}
            new_npc_list = []
            for npc in scene['npc']:
                name = npc.get('name')
                if not name:
                    continue
                
                if name in merged_npcs:
                    # Already exists, merge dialogue
                    existing_npc = merged_npcs[name]
                    if 'dialogue' in npc:
                        existing_npc.setdefault('dialogue', []).extend(npc['dialogue'])
                else:
                    # New NPC for this scene
                    merged_npcs[name] = npc
                    new_npc_list.append(npc)
            scene['npc'] = new_npc_list

    # Apply NPC stats from npc_list to scene NPCs
    npc_stats_map = {}
    for npc_def in npc_list:
        name = npc_def.get('name')
        if name:
            npc_stats_map[name] = {
                'hp': npc_def.get('hp'),
                'attack': npc_def.get('attack'),
                'defense': npc_def.get('defense')
            }

    for scene in scenes:
        for npc in scene.get('npc', []):
            name = npc.get('name')
            if name in npc_stats_map:
                stats = npc_stats_map[name]
                if stats.get('hp') is not None:
                    npc['hp'] = stats['hp']
                if stats.get('attack') is not None:
                    npc['attack'] = stats['attack']
                if stats.get('defense') is not None:
                    npc['defense'] = stats['defense']

    # Ensure all global NPCs appear somewhere
    if len(scenes) > 0:
        existing_npc_names = set()
        for scene in scenes:
            for npc in scene.get('npc', []):
                if npc.get('name'):
                    existing_npc_names.add(npc['name'])
        
        import random
        for npc_def in npc_list:
            name = npc_def.get('name')
            if name and name not in existing_npc_names:
                # Pick a random scene
                target_scene = random.choice(scenes)
                # Inject stats if missing from dialogue prompt output but present in npc_list
                npc_entry = {
                    "name": name,
                    "dialogue": [[name, "..."]],
                    "hp": npc_def.get('hp', 100),
                    "attack": npc_def.get('attack', 10),
                    "defense": npc_def.get('defense', 10)
                }
                target_scene.setdefault('npc', []).append(npc_entry)
                print(f"Adding silent NPC {name} to Scene {scenes.index(target_scene)}")
        
        # Inject Minions into Scenes
        if minion_list:
            minion_type = minion_list[0] # Assuming one type as per prompt recommendation or taking first
            for scene in scenes:
                # Add 3-10 minions
                count = random.randint(3, 10)
                scene.setdefault('minions', [])
                for i in range(count):
                    scene['minions'].append({
                        "name": f"{minion_type.get('name', 'Minion')} {i+1}",
                        "outfit": minion_type.get('outfit', 'Basic'),
                        "hp": minion_type.get('hp', 50),
                        "attack": minion_type.get('attack', 5),
                        "defense": minion_type.get('defense', 0),
                        "is_minion": True
                    })
    
    
    # 3a. Player Generation
    player_name = player_data.get('name', 'Hero')
    player_path = os.path.join(assets_dir, 'temp_stand.png')
    #player_running_path = os.path.join(assets_dir, 'player_running.png')
    
    if not os.path.exists(player_path):
        print(f"Generating multi-directional sprite sheet for {player_name}...")
        
        # 1. Generate STAND view (single pose) as base condition
        prompt_stand = prompt_hub.player_sprite_prompt_template_stand.format(
            name=player_name, outfit=player_data.get('outfit', 'Armor')
        )
        contents_stand = [prompt_stand]
        if has_ref_image:
            contents_stand.append(Image.open(npc_ref_path))

        res_stand = client.client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=contents_stand
        )
        path_stand = os.path.join(assets_dir, 'temp_stand.png')
        for part in res_stand.parts:
            if part.inline_data:
                part.as_image().save(path_stand)
        remove_background(path_stand)

        # 2. Generate RIGHT view (3 frames) with STAND as condition
        prompt_right = prompt_hub.player_sprite_prompt_template_right.format(
            name=player_name, outfit=player_data.get('outfit', 'Armor')
        )
        res_right = client.client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[prompt_right, Image.open(path_stand)]
        )
        path_right = os.path.join(assets_dir, 'temp_right.png')
        for part in res_right.parts:
            if part.inline_data:
                part.as_image().save(path_right)
        remove_background(path_right)

        # 3. Generate UP view (3 frames) with STAND as condition
        prompt_up = prompt_hub.player_sprite_prompt_template_up.format(
            name=player_name, outfit=player_data.get('outfit', 'Armor')
        )
        res_up = client.client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[prompt_up, Image.open(path_stand)]
        )
        path_up = os.path.join(assets_dir, 'temp_up.png')
        for part in res_up.parts:
            if part.inline_data:
                part.as_image().save(path_up)
        remove_background(path_up)

        # 4. Generate DOWN view (3 frames) with STAND as condition
        prompt_down = prompt_hub.player_sprite_prompt_template_down.format(
            name=player_name, outfit=player_data.get('outfit', 'Armor')
        )
        res_down = client.client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[prompt_down, Image.open(path_stand)]
        )
        path_down = os.path.join(assets_dir, 'temp_down.png')
        for part in res_down.parts:
            if part.inline_data:
                part.as_image().save(path_down)
        remove_background(path_down)

        # Combine into a 3x3 grid (Col 0: Down, Col 1: Up, Col 2: Right)
        # Each temp image is 1x3 (or similar), we need to extract 3 frames from each
        grid = Image.new("RGBA", (128 * 3, 128 * 3), (0, 0, 0, 0))
        
        def paste_column(source_path, col_idx, prefix):
            if not os.path.exists(source_path):
                print(f"Warning: Source path {source_path} not found.")
                return
            src = Image.open(source_path).convert("RGBA")
            sw, sh = src.size
            
            # Use a more robust way to find frames: 
            # 1. Remove background and crop to content of the whole strip first
            bbox_all = src.getbbox()
            if not bbox_all:
                print(f"No content found in {source_path}")
                return
            src_cropped = src.crop(bbox_all)
            cw, ch = src_cropped.size
            
            # 2. Divide the cropped content into 3 frames horizontally
            f_w = cw / 3
            
            # Create a new strip for this direction (3 frames of 128x128)
            strip = Image.new("RGBA", (128 * 3, 128), (0, 0, 0, 0))
            
            for col in range(3):
                frame = src_cropped.crop((int(col * f_w), 0, int((col + 1) * f_w), ch))
                # Center this frame in 128x128
                f_bbox = frame.getbbox()
                if f_bbox:
                    char = frame.crop(f_bbox)
                    # Scale to fit 128x128 (90% height)
                    th = int(128 * 0.9)
                    ratio = th / char.height
                    tw = int(char.width * ratio)
                    char = char.resize((tw, th), Image.NEAREST)
                    # Paste centered in the strip cell
                    strip.paste(char, (col * 128 + (128 - tw) // 2, (128 - th) // 2), char)
            
            strip_path = os.path.join(assets_dir, f'temp_{prefix}.png')
            strip.save(strip_path)
            print(f"Processed strip saved to {strip_path}")

        paste_column(path_down, 0, 'down')
        paste_column(path_up, 1, 'up')
        paste_column(path_right, 2, 'right')
        
        # grid.save(player_running_path) # DELETED generation process
        # Clean up - REMOVED os.remove(p) as requested
        print(f"Individual strips saved: temp_right.png, temp_up.png, temp_down.png in {assets_dir}")
        print(f"Skipped combined player_running.png generation.")

    player_avatar_path = os.path.join(assets_dir, 'player_avatar.png')
    if not os.path.exists(player_avatar_path):
        print(f"Generating avatar for {player_name}...")
        prompt = prompt_hub.avatar_prompt_template.format(name=player_name)
        # Use existing player sprite or ref image? Usually avatar uses sprite. 
        # But if we have sprite sheet, use that.
        ref_for_avatar = [player_path] if os.path.exists(player_path) else []
        
        client.generate_content(
            prompt,
            images_path=ref_for_avatar,
            output_path=player_avatar_path,
        )
        remove_background(player_avatar_path)
        crop_to_content(player_avatar_path)

    # 3b. Global NPC & Minion Generation
    npc_assets = {} # Map name -> {sprite, avatar}
    
    # Process NPCs
    for npc_def in npc_list:
        name = npc_def['name']
        safe_name = "".join(x for x in name if x.isalnum())
        sprite_filename = f"npc_{safe_name}.png"
        avatar_filename = f"npc_{safe_name}_avatar.png"
        
        sprite_path = os.path.join(assets_dir, sprite_filename)
        avatar_path = os.path.join(assets_dir, avatar_filename)
        
        # Generate Sprite
        if not os.path.exists(sprite_path):
            print(f"Generating sprite for {name}...")
            prompt = prompt_hub.npc_sprite_prompt_template.format(
                name=name,
                outfit=npc_def.get('outfit', 'Standard clothes')
            )
            client.generate_content(prompt, images_path=ref_images, output_path=sprite_path)
            remove_background(sprite_path)
            
        # Generate Avatar
        if not os.path.exists(avatar_path):
            print(f"Generating avatar for {name}...")
            prompt = prompt_hub.avatar_prompt_template.format(name=name)
            client.generate_content(
                prompt,
                images_path=[sprite_path],
                output_path=avatar_path,
            )
            remove_background(avatar_path)
            crop_to_content(avatar_path)
            
        npc_assets[name] = {
            'sprite': sprite_filename,
            'avatar': avatar_filename
        }

    # Process Minions (Single asset for all minions of same type)
    if minion_list:
        m_def = minion_list[0]
        m_name = m_def.get('name', 'Minion')
        safe_m_name = "".join(x for x in m_name if x.isalnum())
        m_sprite_filename = f"minion_{safe_m_name}.png"
        m_path = os.path.join(assets_dir, m_sprite_filename)
        
        if not os.path.exists(m_path):
            print(f"Generating sprite for minion {m_name}...")
            prompt = prompt_hub.npc_sprite_prompt_template.format(
                name=m_name,
                outfit=m_def.get('outfit', 'Monster')
            )
            client.generate_content(prompt, images_path=ref_images, output_path=m_path)
            remove_background(m_path)
        
        # Assign this asset to all minions in scenes
        for scene in scenes:
            if 'minions' in scene:
                for m in scene['minions']:
                    m['sprite'] = m_sprite_filename
                    # Minions don't use avatars in chat (no chat), but battle might need one? 
                    # Reuse sprite or simple placeholder if needed.


    # 3c. Process Scenes & Assign Assets
    for scene_index, scene in enumerate(scenes):
        print(f"Processing Scene {scene_index + 1}...")
        
        # NPCs for this scene
        for i, npc in enumerate(scene.get('npc', [])):
            npc_name = npc['name']
            
            # If mapped globally, use that.
            if npc_name in npc_assets:
                npc['sprite'] = npc_assets[npc_name]['sprite']
                npc['avatar'] = npc_assets[npc_name]['avatar']
            else:
                # Fallback generation for undefined NPCs
                safe_name = "".join(x for x in npc_name if x.isalnum())
                sprite_filename = f"npc_{safe_name}_{scene_index}.png"
                avatar_filename = f"npc_{safe_name}_{scene_index}_avatar.png"
                sprite_path = os.path.join(assets_dir, sprite_filename)
                avatar_path = os.path.join(assets_dir, avatar_filename)
                
                if not os.path.exists(sprite_path):
                    print(f"Generating sprite for {npc_name} (Scene Specific)...")
                    prompt = prompt_hub.npc_sprite_prompt_template.format(name=npc_name, outfit="Standard period appropriate clothing")
                    # Pass ref_images here too
                    client.generate_content(prompt, images_path=ref_images, output_path=sprite_path)
                    remove_background(sprite_path)
                
                if not os.path.exists(avatar_path):
                    print(f"Generating avatar for {npc_name}...")
                    prompt = prompt_hub.avatar_prompt_template.format(name=npc_name)
                    client.generate_content(prompt, images_path=[sprite_path], output_path=avatar_path)
                    remove_background(avatar_path)
                    crop_to_content(avatar_path)
                
                npc['sprite'] = sprite_filename
                npc['avatar'] = avatar_filename
                
                # Add to local cache 
                npc_assets[npc_name] = {'sprite': sprite_filename, 'avatar': avatar_filename}

        # Location / Background for this scene
        bg_filename = f"background_scene_{scene_index}.png"
        bg_path = os.path.join(assets_dir, bg_filename)
        scene['background_image'] = bg_filename 

        if not os.path.exists(bg_path):
            print(f"Generating background for Scene {scene_index}...")
            prompt = prompt_hub.floor_prompt_template.format(location_description=scene['location'])
            
            response = client.client.models.generate_content(
                model="gemini-3-pro-image-preview",
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                     image_config=types.ImageConfig(
                        aspect_ratio="16:9",
                        image_size="2K"
                    )
                ),
                contents=[prompt]
            )
            
            for part in response.parts:
                if part.inline_data:
                    image = part.as_image()
                    image.save(bg_path)

        # Ensure 2560x1440 BEFORE coordinate generation
        if os.path.exists(bg_path):
            try:
                bg_img = Image.open(bg_path).convert("RGBA")
                if bg_img.size != (2560, 1440):
                    bg_img = bg_img.resize((2560, 1440), Image.NEAREST)
                    bg_img.save(bg_path)
                    print(f"Resized background to 2560x1440 for Scene {scene_index}")
            except Exception as e:
                print(f"Failed to resize background for Scene {scene_index}: {e}")
            
        # Coordinate Generation (Always check if missing)
        if 'building_coordinates' not in scene or not scene['building_coordinates']:
            if os.path.exists(bg_path):
                print(f"Generating coordinates for Scene {scene_index}...")
                building_coords_json = client.describe_image(bg_path, prompt_hub.building_coordinates_prompt_template)
                try:
                    text = building_coords_json.strip()
                    if text.startswith('```json'): text = text[7:]
                    if text.endswith('```'): text = text[:-3]
                    scene['building_coordinates'] = json.loads(text.strip())
                except:
                    print(f"Failed to parse building coordinates for scene {scene_index}.")
                    scene['building_coordinates'] = []
        
    # Save updated data
    if len(scenes) > 0:
        scenes[0]['player'] = player_data

    with open(os.path.join(game_dir, 'game_data.json'), 'w', encoding='utf-8') as f:
        json.dump(scenes, f, ensure_ascii=False, indent=4) # Dump SCENES list to game_data.json

if __name__ == "__main__":
    main()
