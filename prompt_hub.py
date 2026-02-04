prompt_npc='''
<role>
You are a professional information extractor.
</role>
<goal>
1.one sentance as opening remarks for this story.
2. decide how many scenes happened in this story based on length of input story, don't generate too many scenes. 
3. extract character outfit description and dialogue based on user's input story. There could be multiple characters in the story, only keep dialogue between player and npc.
4. One character is player and others are NPCs.
5. outfit description  and dialogue should be in english, and dialogue must be exactly same meaning from input story, dialogue between player and npc should be in same order as input story.
6. for each scene generate description for this scene's location where dialogue happened, including geography, culture, color,architecture.etc.Only describe one location for each scene.  based on user's input story and your knowledge.
7. output format in json format.
</goal>
<format>
{
    "player": {
        "name": "player_name",
        "outfit": "player_outfit"
    },
    "npc_list": [
        {
            "name": "npc_name1",
            "outfit": "npc_outfit1"
        },
        {
            "name": "npc_name2",
            "outfit": "npc_outfit2"
        }
    ],
    "scenes": [
        {
            "opening_remarks": "opening_remarks",
            "npc": [
                {
                    "name": "npc_name1",
                    "dialogue": [["player_name","player_dialogue1"],["npc_name1","npc1_dialogue1"]]
                }, #dialogue between player and npc1
                {
                    "name": "npc_name2",
                    "dialogue": [["player_name","player_dialogue1"],["npc_name2","npc2_dialogue1"]]
                } #dialogue between player and npc2
            ],
            "location": "location_description"
        }, ## scene1
        {
            "npc": [
                {
                    "name": "npc_name3",
                    "dialogue": [["player_name","player_dialogue1"],["npc_name3","npc3_dialogue1"]]
                } #dialogue between player and npc3
            ],
            "location": "location_description"
        } ## scene2
    ]
}
</format>
'''
player_sprite_prompt_template_stand ='''
Generate a pixel art character sprite sheet for a 2D RPG game,just one frame,one character.
View: Full body, front view 
Format: stand still face to screen
Character: {name}
Outfit: {outfit}
Background: Pure white background (for transparency).
Requirment:No other objects or text
'''

player_sprite_prompt_template_right ='''
Generate a pixel art character sprite sheet for a 2D RPG game.
View: Full body, side-view. walking towards right 
Format: total 3 frames, left leg step, right leg step, passing position all towards right
Character: {name}
Outfit: {outfit}
Background: Pure white background (for transparency).
Requirment:No other objects or text,no visible line between frames.
'''
player_sprite_prompt_template_up = '''
Generate a pixel art character sprite sheet for a 2D RPG game.
View: Full body, back view, back to screen. walking towards up 
Format: total 3 frames, left leg step, right leg step, passing position all towards up
Character: {name}
Outfit: {outfit}
Background: Pure white background (for transparency).
Requirment:No other objects or text,no visible line between frames.
'''
player_sprite_prompt_template_down ='''
Generate a pixel art character sprite sheet for a 2D RPG game.
View: Full body, top-view. walking towards down 
Format: total 3 frames, left leg step, right leg step, passing position all towards down
Character: {name}
Outfit: {outfit}
Background: Pure white background (for transparency).
Requirment:No other objects or text,no visible line between frames.
'''

npc_sprite_prompt_template = '''
Generate a single pixel art character sprite for a 2D RPG game.
View: Full body, side-view.
Image size: 128x128 pixels.
Style:"Semi-realistic anime," "Manhua style," "Digital oil painting," "High-fidelity game splash art."
Character: {name}
Outfit: {outfit}
Background: Pure white background (for transparency).
No other objects or text.
'''

avatar_prompt_template = '''
Generate a pixel art character portrait/avatar for a dialogue box.
View: Close-up of the head and shoulders, facing slightly towards the viewer.
Style:"Semi-realistic anime," "Manhua style," "Digital oil painting," "High-fidelity game splash art." matching the style of a character sprite.
Character: {name}
Expression: Neutral or slightly determined.
Background: Pure white background (for transparency).
No other objects or text.
'''

floor_prompt_template = '''
Generate a top-down pixel art background for a 2D RPG game.
The image resolution MUST be 2560 x 1440 pixels.

### INSTRUCTIONS:
1. IMAGE: Generate a top-down pixel art background representing the walkable floor or area, there must no blank/gray/black spot  or  space in this image.

Location: {location_description}
Style: 16-bit retro pixel art, top-down perspective.
The image should represent a walkable floor or area.
No characters.

'''

building_coordinates_prompt_template = '''
generate building coordinates for a 2D RPG map based on the background image.only json content
the image is 2560 x 1440.
output format:
{{"x": number, "y": number, "w": number, "h": number}}
x: The horizontal position of the top-left corner of the building (0 is the left edge of the map).
y: The vertical position of the top-left corner of the building (0 is the top edge of the map).
w (Width): How wide the building is in pixels.
h (Height): How tall the building is in pixels.
Each building must be inside the world bounds and not overlap outside.
No extra text.only json content
'''