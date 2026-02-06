# PlayRPG

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
and you will see this page
![Homepage](image/homepage.png)

upload or enter you story in the chatbox, it will a few mins to generate the game (depend on story length),then enter the game in the right list.
![Example 1](image/ex1.png)