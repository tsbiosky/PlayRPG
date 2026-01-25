from google import genai
from google.genai import types
from PIL import Image
import json
import os

class GeminiClient:
    def __init__(self, config_path='config.json'):
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
        else:
            config = {}
        
        # Using the key from the workspace if not in config
        api_key = os.getenv('GEMINI_API_KEY')
        self.client = genai.Client(api_key=api_key)

    def generate_json(self, story, prompt):
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt + "\n\nStory:\n" + story],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)

    def generate_content(self, prompt, images_path=None, output_path=None):
        if images_path is None:
            images_path = []
        images = []
        for image_path in images_path:
            images.append(Image.open(image_path))
        response = self.client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[prompt, *images]
        )
        text_return = None
        for part in response.parts:
            if part.text is not None:
                text_return = part.text
            elif image:= part.as_image():
                image.save(output_path)
        return text_return
