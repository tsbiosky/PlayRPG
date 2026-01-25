prompt_npc='''
<role>
You are a professional information extractor.
</role>
<goal>
1. Generate character outfit description and dialogue based on user's input story. There could be multiple characters in the story.
2. One character is player and others are NPCs.
3.outfit description  and dialogue should be in english, and dialogue must be exactly same meaning from input story, dialogue between player and npc should be in same order as input story.
4. generate description for location where dialogue happened, including geography, culture, color,architecture, etc. based on user's input story and your knowledge.
5. output format in json format.
</goal>
<format>
{
    "player": {
        "name": "player_name",
        "outfit": "player_outfit",
    },
    "npc": [
        {
            "name": "npc_name1",
            "outfit": "npc_outfit1",
            "dialogue": [["player_name","player_dialogue1"],["npc_name1","npc1_dialogue1"],["player_name","player_dialogue2"],["npc_name1","npc1_dialogue2"]]
        }
    ],
    "location": "location_description"
}
</format>
'''

player_sprite_prompt_template = '''
Generate a pixel art character sprite sheet for a 2D RPG game.
View: Full body, side-view.
Format: total 4 frames, topleft is walking towards right,  topright is walking towards left,  bottomleft is walking towards up,  bottomright is walking towards down, order in 2x2 format.
Frame size: Each frame is exactly 128x128 pixels (total image size 256x256).
Character: {name}
Outfit: {outfit}
Background: Pure white background (for transparency).
No other objects or text, make sure no visible line between frames.
'''

npc_sprite_prompt_template = '''
Generate a single pixel art character sprite for a 2D RPG game.
View: Full body, side-view.
Image size: 128x128 pixels.
Style: 16-bit retro pixel art, vibrant colors.
Character: {name}
Outfit: {outfit}
Background: Pure white background (for transparency).
No other objects or text.
'''

avatar_prompt_template = '''
Generate a pixel art character portrait/avatar for a dialogue box.
View: Close-up of the head and shoulders, facing slightly towards the viewer.
Style: 16-bit retro pixel art, vibrant colors, matching the style of a character sprite.
Character: {name}
Expression: Neutral or slightly determined.
Background: Pure white background (for transparency).
No other objects or text.
'''

floor_prompt_template = '''
Generate a top-down pixel art background for a 2D RPG game.
Location: {location_description}
Style: 16-bit retro pixel art, top-down perspective.
The image should represent a walkable floor or area.
No characters, no text.
'''
