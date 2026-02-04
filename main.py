import os
import json
from llm import GeminiClient
from image_edit import remove_background, crop_to_content, normalize_sprite_sheet
import prompt_hub
from PIL import Image
from google import genai
from google.genai import types
def main():
    # Setup folders
    base_dir = os.path.dirname(os.path.abspath(__file__))
    game_dir = os.path.join(base_dir, 'game')
    assets_dir = os.path.join(game_dir, 'assets')
    os.makedirs(assets_dir, exist_ok=True)

    client = GeminiClient()
    # 1. Read Story
    with open(os.path.join(base_dir, 'story.txt'), 'r', encoding='utf-8') as f:
        story = f.read()

    # 2. Extract Story Data to output.json (if not already present or refresh required)
    output_json_path = os.path.join(base_dir, 'output.json')
    if not os.path.exists(output_json_path) or os.path.getsize(output_json_path) == 0:
        print("Extracting story data...")
        data = client.generate_json(story, prompt_hub.prompt_npc)
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    else:
        with open(output_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

    # Ensure data is a list (for backward compatibility if single object)
    if isinstance(data, dict):
        data = [data]

    # 3. Generate Assets
    # Player (Generate from the first scene, assuming consistent identity)
    first_scene = data[0]
    player_name = first_scene['player']['name']
    player_path = os.path.join(assets_dir, 'player.png')
    player_running_path = os.path.join(assets_dir, 'player_running.png')
    
    if not os.path.exists(player_running_path):
        print(f"Generating sprite sheet for {player_name}...")
        prompt = prompt_hub.player_sprite_prompt_template.format(
            name=player_name,
            outfit=first_scene['player']['outfit']
        )
        # ... (rest of player generation logic same as before) ...
        response = client.client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[prompt])
        for part in response.parts:
            if part.inline_data:
                image = part.as_image()
                image.save(player_path)
        remove_background(player_path)
        normalize_sprite_sheet(
            player_path,
            frames=4,
            frame_size=128,
            columns=2,
            rows=2,
            output_path=player_running_path,
        )

    player_avatar_path = os.path.join(assets_dir, 'player_avatar.png')
    if not os.path.exists(player_avatar_path):
        print(f"Generating avatar for {player_name} using player sprite...")
        prompt = prompt_hub.avatar_prompt_template.format(name=player_name)
        client.generate_content(
            prompt,
            images_path=[player_running_path if os.path.exists(player_running_path) else player_path],
            output_path=player_avatar_path,
        )
        remove_background(player_avatar_path)
        crop_to_content(player_avatar_path)

    # Process each scene
    for scene_index, scene in enumerate(data):
        print(f"Processing Scene {scene_index + 1}...")
        
        # NPCs for this scene
        for i, npc in enumerate(scene['npc']):
            npc_name = npc['name']
            # Unique filename per NPC name to avoid regenerating if same NPC appears in multiple scenes
            # or use scene index if we want unique outfits per scene
            safe_npc_name = "".join(x for x in npc_name if x.isalnum())
            npc_filename = f"npc_{safe_npc_name}_{scene_index}_{i}.png" 
            npc_path = os.path.join(assets_dir, npc_filename)
            
            if not os.path.exists(npc_path):
                print(f"Generating sprite for {npc_name} (Scene {scene_index})...")
                prompt = prompt_hub.npc_sprite_prompt_template.format(
                    name=npc_name,
                    outfit=npc['outfit']
                )
                client.generate_content(prompt, images_path=None,output_path=npc_path)
                remove_background(npc_path)
            npc['sprite'] = npc_filename

            npc_avatar_filename = f"npc_{safe_npc_name}_{scene_index}_{i}_avatar.png"
            npc_avatar_path = os.path.join(assets_dir, npc_avatar_filename)
            if not os.path.exists(npc_avatar_path):
                print(f"Generating avatar for {npc_name}...")
                prompt = prompt_hub.avatar_prompt_template.format(name=npc_name)
                client.generate_content(
                    prompt,
                    images_path=[npc_path],
                    output_path=npc_avatar_path,
                )
                remove_background(npc_avatar_path)
                crop_to_content(npc_avatar_path)
            npc['avatar'] = npc_avatar_filename

        # Location / Background for this scene
        bg_filename = f"background_scene_{scene_index}.png"
        bg_path = os.path.join(assets_dir, bg_filename)
        scene['background_image'] = bg_filename # Store filename in scene data

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
            building_coords_json = ""
            building_coords_json=client.describe_image(bg_path,prompt_hub.building_coordinates_prompt_template)
            #print(building_coords_json)
            # Try to parse the building coordinates from the text response
            try:
                # Clean up json string if needed (remove markdown code blocks)
                text = building_coords_json.strip()
                if text.startswith('```json'):
                    text = text[7:]
                if text.endswith('```'):
                    text = text[:-3]
                scene['building_coordinates'] = json.loads(text.strip())
            except:
                print(f"Failed to parse building coordinates for scene {scene_index}. Using default.")
                scene['building_coordinates'] = []
        
        # Fallback if image existed but no coords in current run (e.g. partial re-run logic)
        # For simplicity, we just trust the loop above handled it or it's already in 'scene' if we loaded from json
        # But 'data' comes from 'output.json' which doesn't have coords yet.
        # We need to save coords into 'data' so they persist.
        
    # Save updated data with sprite filenames and scene info
    with open(os.path.join(game_dir, 'game_data.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    main()
