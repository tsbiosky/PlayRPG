import os
import json
from llm import GeminiClient
from image_edit import remove_background, crop_to_content, normalize_sprite_sheet
import prompt_hub
from PIL import Image
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

    # 3. Generate Assets
    # Player
    player_name = data['player']['name']
    player_path = os.path.join(assets_dir, 'player.png')
    player_running_path = os.path.join(assets_dir, 'player_running.png')
    if not os.path.exists(player_running_path):
        print(f"Generating sprite sheet for {player_name}...")
        prompt = prompt_hub.player_sprite_prompt_template.format(
            name=player_name,
            outfit=data['player']['outfit']
        )
        response = client.client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[
        prompt,
        #Image.open('atlas.png'),
        ])
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
        # Use the player sprite sheet as conditional input
        client.generate_content(
            prompt,
            images_path=[player_running_path if os.path.exists(player_running_path) else player_path],
            output_path=player_avatar_path,
        )
        remove_background(player_avatar_path)
        crop_to_content(player_avatar_path)

    # NPCs
    for i, npc in enumerate(data['npc']):
        npc_name = npc['name']
        npc_filename = f"npc_{i}.png"
        npc_path = os.path.join(assets_dir, npc_filename)
        if not os.path.exists(npc_path):
            print(f"Generating sprite for {npc_name}...")
            prompt = prompt_hub.npc_sprite_prompt_template.format(
                name=npc_name,
                outfit=npc['outfit']
            )
            client.generate_image(prompt, npc_path)
            remove_background(npc_path)
        npc['sprite'] = npc_filename

        npc_avatar_filename = f"npc_{i}_avatar.png"
        npc_avatar_path = os.path.join(assets_dir, npc_avatar_filename)
        if not os.path.exists(npc_avatar_path):
            print(f"Generating avatar for {npc_name} using NPC sprite...")
            prompt = prompt_hub.avatar_prompt_template.format(name=npc_name)
            # Use the NPC sprite as conditional input
            client.generate_content(
                prompt,
                images_path=[npc_path],
                output_path=npc_avatar_path,
            )
            remove_background(npc_avatar_path)
            crop_to_content(npc_avatar_path)
        npc['avatar'] = npc_avatar_filename

    # Location / Background
    bg_path = os.path.join(assets_dir, 'background.png')
    if not os.path.exists(bg_path):
        print("Generating background...")
        prompt = prompt_hub.floor_prompt_template.format(location_description=data['location'])
        client.generate_image(prompt, bg_path)

    # Save updated data with sprite filenames
    with open(os.path.join(game_dir, 'game_data.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    main()
