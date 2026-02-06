document.addEventListener('DOMContentLoaded', () => {
    const storyInput = document.getElementById('story-input');
    const projectNameInput = document.getElementById('project-name');
    const fileUpload = document.getElementById('file-upload');
    const generateBtn = document.getElementById('generate-btn');
    const gamesList = document.getElementById('games-list');
    const loadingOverlay = document.getElementById('loading-overlay');
    const logOutput = document.getElementById('log-output');
    const closeOverlayBtn = document.getElementById('close-overlay-btn');

    // Load games list
    fetchGames();

    // File upload handler
    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            storyInput.value = e.target.result;
            // Auto-fill project name from filename if empty
            if (!projectNameInput.value) {
                const name = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
                projectNameInput.value = name;
            }
        };
        reader.readAsText(file);
    });

    // Close overlay handler
    closeOverlayBtn.addEventListener('click', () => {
        loadingOverlay.style.display = 'none';
        closeOverlayBtn.style.display = 'none';
        generateBtn.disabled = false;
    });

    // Generate handler
    generateBtn.addEventListener('click', async () => {
        const story = storyInput.value.trim();
        const name = projectNameInput.value.trim();

        if (!story) {
            alert("Please enter a story or upload a text file.");
            return;
        }

        if (!name) {
            alert("Please enter a project name.");
            return;
        }

        // UI Update
        loadingOverlay.style.display = 'flex';
        logOutput.textContent = "Sending request to server...\n";
        generateBtn.disabled = true;
        closeOverlayBtn.style.display = 'none';

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ story, name })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let finalResult = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.includes('__JSON_RESULT__')) {
                        try {
                            const jsonStr = line.split('__JSON_RESULT__')[1];
                            finalResult = JSON.parse(jsonStr);
                        } catch (e) { console.error("Error parsing result", e); }
                    } else {
                        logOutput.textContent += line + "\n";
                        logOutput.scrollTop = logOutput.scrollHeight;
                    }
                }
            }

            if (finalResult && finalResult.success) {
                logOutput.textContent += "Generation Successful!\n";
                logOutput.textContent += "--------------------------------\n";
                logOutput.textContent += "Game generated at " + finalResult.game_path + "\n";
                
                await fetchGames();
                
                closeOverlayBtn.style.display = 'block';

                if (confirm("Game generated successfully! Open it now?")) {
                    window.open(finalResult.game_path, '_blank');
                    loadingOverlay.style.display = 'none';
                    generateBtn.disabled = false;
                }
            } else {
                logOutput.textContent += "Generation Finished (Check logs for errors).\n";
                closeOverlayBtn.style.display = 'block';
            }

        } catch (err) {
            logOutput.textContent += "Network Error: " + err.message + "\n";
            closeOverlayBtn.style.display = 'block';
        }
    });

    async function fetchGames() {
        try {
            const res = await fetch('/api/games');
            const games = await res.json();
            
            gamesList.innerHTML = '';
            games.forEach(game => {
                const div = document.createElement('a');
                div.className = 'game-item';
                div.href = game.path;
                div.target = '_blank'; // Open in new tab
                
                const icon = document.createElement('div');
                icon.className = 'game-icon';
                icon.textContent = game.name.charAt(0).toUpperCase();
                
                const info = document.createElement('div');
                info.className = 'game-info';
                
                const title = document.createElement('span');
                title.className = 'game-name';
                title.textContent = game.name;
                
                const date = document.createElement('span');
                date.className = 'game-date';
                date.textContent = new Date(game.mtime * 1000).toLocaleString();
                
                info.appendChild(title);
                info.appendChild(date);
                
                div.appendChild(icon);
                div.appendChild(info);
                
                gamesList.appendChild(div);
            });
        } catch (e) {
            console.error("Failed to fetch games", e);
        }
    }
});
