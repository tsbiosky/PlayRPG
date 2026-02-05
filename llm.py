from google import genai
from google.genai import types
from PIL import Image
import json
import os

class GeminiClient:
    def __init__(self, config_path='config.json'):
        config = {}
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
            except (json.JSONDecodeError, OSError):
                config = {}
        
        # Using the key from the workspace if not in config
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            key_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'key.txt')
            if os.path.exists(key_file_path):
                try:
                    with open(key_file_path, 'r') as f:
                        api_key = f.read().strip()
                except Exception as e:
                    print(f"Error reading key.txt: {e}")

        if not api_key:
            print("Warning: No Gemini API key found in environment variables or key.txt")
            
        self.client = genai.Client(api_key=api_key)

    def generate_json(self, story, prompt):
        response = self.client.models.generate_content(
            model="gemini-3-pro-preview",
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
        
        # We force the model to generate a 2560x1440 image via config if supported, 
        # but primarily we rely on the prompt and the fact that we won't resize it in JS.
        response = self.client.models.generate_content(
            model="gemini-3-pro-image-preview",
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            ),
            contents=[prompt, *images]
        )
        
        text_return = ""
        for part in response.parts:
            if part.text:
                text_return += part.text
            if image := part.as_image():
                if output_path:
                    image.save(output_path)
        #print(f"LLM Text Return: {text_return}")
        return text_return
    def describe_image(self,image_path,prompt):
        # Load the image using PIL
        img = Image.open(image_path)
        
        # Generate content using a multimodal model (like gemini-2.0-flash)
        response = self.client.models.generate_content(
            model="gemini-3-pro-preview",
            contents=[prompt, img],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        #print(response.text)
        return response.text