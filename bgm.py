import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

def generate_bgm(prompt, output_path, length_ms=60000):
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        print("Warning: ELEVENLABS_API_KEY not set. Skipping BGM generation.")
        return False

    elevenlabs = ElevenLabs(api_key=api_key)
    track = elevenlabs.music.compose(
        prompt=prompt,
        music_length_ms=length_ms,
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f:
        for chunk in track:
            f.write(chunk)

    print(f"BGM saved to {output_path}")
    return True

if __name__ == "__main__":
    # Example usage
    generate_bgm(
        prompt="Create a calm fantasy background track with soft strings and gentle piano, 90-110 bpm.",
        output_path="bgm.mp3",
        length_ms=10000
    )