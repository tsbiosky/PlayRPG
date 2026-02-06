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
                        # Hidden folders or 'game' template
                        if item == 'game' or item.startswith('.'):
                            continue
                        
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

                # Save story
                story_filename = f"{project_name}.txt"
                story_path = os.path.join(BASE_DIR, story_filename)
                with open(story_path, 'w', encoding='utf-8') as f:
                    f.write(story_text)
                
                print(f"Starting generation for {project_name}...")
                
                # Send immediate headers for streaming
                self.send_response(200)
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self.send_header('Transfer-Encoding', 'chunked')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.end_headers()

                # Helper to send chunk
                def send_chunk(text):
                    if not text: return
                    b = text.encode('utf-8')
                    self.wfile.write(f"{len(b):X}\r\n".encode('utf-8'))
                    self.wfile.write(b)
                    self.wfile.write(b"\r\n")
                    self.wfile.flush()

                # Send initial status
                send_chunk("Initializing generation process...\n")
                
                # Padding to force browser buffer flush (some browsers wait for 1KB)
                send_chunk(" " * 1024 + "\n") 

                cmd = [sys.executable, '-u', 'main.py', '--storyname', project_name]
                
                process = subprocess.Popen(
                    cmd, 
                    cwd=BASE_DIR, 
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.PIPE, 
                    text=True,
                    encoding='utf-8',
                    bufsize=1, 
                    universal_newlines=True
                )

                # Stream stdout
                for line in process.stdout:
                    print(line, end='') # Console
                    send_chunk(line)
                
                # Read stderr (after stdout closes)
                stderr_output = process.stderr.read()
                if stderr_output:
                    print(stderr_output, file=sys.stderr)
                    send_chunk(f"\nERROR LOG:\n{stderr_output}")

                process.wait()
                
                # Send result metadata as final line
                result_json = json.dumps({
                    'success': process.returncode == 0,
                    'game_path': f'/{project_name}/index.html',
                    'project_name': project_name
                })
                send_chunk(f"\n__JSON_RESULT__{result_json}")
                
                # End stream
                self.wfile.write(b"0\r\n\r\n")

            except Exception as e:
                print(f"Error in generation: {e}")
                # If headers not sent yet, send 500. If sent, we just break stream.
                pass
            
            return

        return super().do_POST()

def run_server():
    # Allow address reuse
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), RPGRequestHandler) as httpd:
        print(f"Serving RPG Maker at http://localhost:{PORT}")
        print(f"Serving from {BASE_DIR}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    run_server()
