import http.server
import socketserver
import os
import json
import subprocess
import sys

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class RPGRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.path = '/home.html'
            return super().do_GET()
        
        if self.path == '/api/games':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            games = []
            # Scan for folders containing index.html
            try:
                for item in os.listdir(BASE_DIR):
                    item_path = os.path.join(BASE_DIR, item)
                    if os.path.isdir(item_path):
                        if os.path.exists(os.path.join(item_path, 'index.html')):
                            # Use modification time as a sort key
                            mtime = os.path.getmtime(item_path)
                            games.append({
                                'name': item,
                                'path': f'/{item}/index.html',
                                'mtime': mtime
                            })
            except Exception as e:
                print(f"Error listing games: {e}")

            # Sort by newest first
            games.sort(key=lambda x: x['mtime'], reverse=True)
            
            self.wfile.write(json.dumps(games).encode())
            return

        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/generate':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                story_text = data.get('story', '')
                project_name = data.get('name', 'new_story')
                
                # Sanitize project name
                project_name = "".join(x for x in project_name if x.isalnum() or x in ('_', '-'))
                if not project_name: project_name = "generated_game"

                # Save story to file
                story_filename = f"{project_name}.txt"
                story_path = os.path.join(BASE_DIR, story_filename)
                with open(story_path, 'w', encoding='utf-8') as f:
                    f.write(story_text)
                
                print(f"Starting generation for {project_name}...")
                
                # Run main.py
                cmd = [sys.executable, 'main.py', '--storyname', project_name]
                
                # Capture output
                # We use a large timeout because asset generation takes time
                result = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True)
                
                response = {
                    'success': result.returncode == 0,
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'game_path': f'/{project_name}/index.html',
                    'project_name': project_name
                }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())

            except Exception as e:
                print(f"Error in generation: {e}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode())
            
            return

        return super().do_POST()

def run_server():
    # Allow address reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), RPGRequestHandler) as httpd:
        print(f"Serving RPG Maker at http://localhost:{PORT}")
        print(f"Serving from {BASE_DIR}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    run_server()
