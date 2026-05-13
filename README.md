# PlayRPG

PlayRPG is a system that generates 2D RPG games using AI. By inputting a story text, the system automatically generates the corresponding plot, characters, maps, music, and battle system.

## Features

- **Automated Generation**: Automatically parses input story text to generate game scenes, dialogues, and character stats.
- **Asset Creation**: 
  - Generates multi-directional pixel character sprite sheets and avatars.
  - Generates scene backgrounds at 2560x1440 resolution.
  - Automatically identifies obstacles in background images and generates collision coordinates.
- **Audio Synthesis**: Integrates ElevenLabs API to generate background music based on the story's atmosphere.
- **Game System**: Developed with Phaser 3, including features for movement, dialogue, turn-based combat, leveling up, and stat allocation.

## Technical Architecture

- **Backend**: Python, Google Gemini (for text parsing and image generation), PIL (image processing), ElevenLabs (audio generation).
- **Frontend**: JavaScript, Phaser 3 Game Engine.

## Install requirements
```bash
pip install -r requirements.txt
```

## Set up API keys
Set environment variables:
- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY` (required only if you want BGM generation)

### Windows (PowerShell)
```powershell
$env:GEMINI_API_KEY="your_gemini_key"
$env:ELEVENLABS_API_KEY="your_elevenlabs_key"
```

### macOS / Linux (bash or zsh)
```bash
export GEMINI_API_KEY="your_gemini_key"
export ELEVENLABS_API_KEY="your_elevenlabs_key"
```

## Run server
```bash
python server.py
```
And you will see this page:
![Homepage](image/homepage.png)

Upload or enter your story in the chatbox. It will take a few minutes to generate the game (depending on story length), then enter the game from the list on the right.

### Controls
- **WASD**: Move
- **SPACE**: Interact / Dialogue / Confirm
- **P**: Open status (Stat allocation)
- **SHIFT**: Run
- **ESC**: Close menu

![Example 1](image/ex1.png)

## Todo List
- [ ] Item system
- [ ] NPC Plot presentation
