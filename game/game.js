// VERSION CHECK
console.log("%c GAME.JS LOADED - VERSION 9 - DEBUG MODE ", "background: #222; color: #bada55; font-size: 20px");

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.RESIZE,
        width: '100%',
        height: '100%'
    },
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
let gameData = [];
let currentSceneIndex = 0;
let player;
let playerStats = {
    level: 1,
    hp: 100,
    maxHp: 100,
    attack: 20,
    defense: 20,
    experience: 0,
    skillPoints: 5
};
let npcs = [];
let currentDialogue = null;
let dialogueText;
let dialogueBox;
let dialogueSpeaker;
let keys;
let profileKey;
let obstacles;
const worldSize = { width: 2560, height: 1440 };
const defaultBuildings = [];
let bgSprite;
let nextLevelArrow;
let prevLevelArrow;

// Battle Globals
let isPaused = false;
let menuContainer;
let battleContainer;
let currentTargetNpc = null;
let battleLogText;
let battlePlayerSprite;
let battleNpcSprite;
let battleHpText;
let battlePlayerBarFg;
let battleNpcBarFg;
let battlePlayerBarBg;
let battleNpcBarBg;

function preload() {
    this.load.json('gameData', 'game_data.json');
    this.load.spritesheet('player', 'assets/player_running.png', { frameWidth: 128, frameHeight: 128 });
    this.load.image('player_avatar', 'assets/player_avatar.png');
}

function create() {
    // 1. Debug Log Setup
    this.debugText = this.add.text(10, 10, "Init...", { font: "16px Arial", fill: "#00ff00", backgroundColor: "#000000" })
        .setScrollFactor(0).setDepth(9999);
    
    const logStep = (msg) => {
        console.log(msg);
        if (this.debugText) this.debugText.setText(this.debugText.text + "\n" + msg);
    };

    logStep("Step 1: Create Started");

    // 2. Physics
    this.physics.world.setBounds(0, 0, worldSize.width, worldSize.height);
    
    this.load.on('loaderror', (fileObj) => {
        console.error("Load Error:", fileObj.key);
        logStep(`! Load Err: ${fileObj.key}`);
    });

    // 3. Load Data
    try {
        let loadedData = this.cache.json.get('gameData');
        if (!loadedData) {
            logStep("! No Data, using default");
            loadedData = [{
                "player": { "name": "Hero", "outfit": "Armor" },
                "npc": [],
                "location": "Default",
                "background_image": "background_scene_0.png",
                "building_coordinates": []
            }];
        }
        gameData = Array.isArray(loadedData) ? loadedData : [loadedData];
        logStep(`Step 2: Data Loaded (${gameData.length} scenes)`);

        // 4. Queue Dynamic Assets
        let assetsToLoad = false;
        gameData.forEach((scene, sIdx) => {
            if (scene.background_image) {
                this.load.image(`bg_${sIdx}`, `assets/${scene.background_image}`);
                assetsToLoad = true;
            }
            if (scene.npc) {
                scene.npc.forEach((npc, nIdx) => {
                    if (npc.sprite) this.load.image(`npc_${sIdx}_${nIdx}`, `assets/${npc.sprite}`);
                    if (npc.avatar) this.load.image(`npc_${sIdx}_${nIdx}_avatar`, `assets/${npc.avatar}`);
                    assetsToLoad = true;
                });
            }
        });

        // 5. Start Game Function
        const startGame = () => {
            try {
                logStep("Step 4: Starting Setup...");
                setupGame.call(this, logStep);
                logStep("Step 5: Setup Complete!");
                
                // Hide debug text after success
                this.time.delayedCall(3000, () => {
                    if(this.debugText) this.debugText.visible = false;
                });
            } catch (err) {
                console.error(err);
                logStep(`! CRASH: ${err.message}`);
            }
        };

        // 6. Handle Loading
        if (assetsToLoad) {
            logStep("Step 3: Loading Assets...");
            this.load.once('complete', () => {
                logStep("Step 3b: Load Complete");
                startGame();
            });
            this.load.start();
        } else {
            logStep("Step 3: No Assets to Load");
            startGame();
        }

    } catch (e) {
        logStep(`! Fatal Error: ${e.message}`);
    }
}

function setupGame(logStep) {
    // A. Background
    let key = `bg_${currentSceneIndex}`;
    if (!this.textures.exists(key)) {
        logStep("! BG texture missing, making placeholder");
        const g = this.make.graphics({x:0, y:0, add:false});
        g.fillStyle(0x333333);
        g.fillRect(0,0,worldSize.width, worldSize.height);
        g.generateTexture('bg_placeholder', worldSize.width, worldSize.height);
        key = 'bg_placeholder';
    }
    bgSprite = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-100);

    // B. UI
    setupUI.call(this);

    // C. Player
    if (this.textures.exists('player')) {
        player = this.physics.add.sprite(128, 128, 'player');
        
        // Anims
        if (!this.anims.exists('walk-right')) {
            this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('player', { start: 0, end: 0 }), frameRate: 8, repeat: -1 });
            this.anims.create({ key: 'walk-left', frames: this.anims.generateFrameNumbers('player', { start: 1, end: 1 }), frameRate: 8, repeat: -1 });
            this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('player', { start: 2, end: 2 }), frameRate: 8, repeat: -1 });
            this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('player', { start: 3, end: 3 }), frameRate: 8, repeat: -1 });
        }
        
        player.setScale(96 / player.height);
        player.setCollideWorldBounds(true);
        player.setSize(40, 56).setOffset(44, 48);
        player.setFrame(3);
        
        this.cameras.main.startFollow(player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, worldSize.width, worldSize.height);
    } else {
        logStep("! Player texture missing");
        player = this.add.rectangle(128, 128, 64, 64, 0x00ff00);
        this.physics.add.existing(player);
        player.body.setCollideWorldBounds(true);
        this.cameras.main.startFollow(player);
    }

    // D. Init Scene
    initScene.call(this, 0);

    // E. Controls
    keys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE,
        enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
        esc: Phaser.Input.Keyboard.KeyCodes.ESC
    });
    profileKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.input.keyboard.on('keydown-P', () => this.toggleProfile());
}

function setupUI() {
    // Profile
    this.profileBox = this.add.graphics().setScrollFactor(0).setDepth(2000).setVisible(false);
    this.profileText = this.add.text(0, 0, '', { fontSize: '20px', fill: '#ffffff', lineSpacing: 15 }).setScrollFactor(0).setDepth(2001).setVisible(false);

    this.skillButtons = [];
    const createBtn = (stat) => {
        const btn = this.add.text(0, 0, '[ + ]', { fontSize: '20px', fill: '#ffff00', backgroundColor: '#333333' })
            .setScrollFactor(0).setDepth(2002).setVisible(false).setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
            if (playerStats.skillPoints > 0) {
                if (stat === 'hp') { playerStats.maxHp += 10; playerStats.hp += 10; } 
                else { playerStats[stat] += 1; }
                playerStats.skillPoints--;
                this.updateProfile();
            }
        });
        return btn;
    };
    const btnHp = createBtn('hp');
    const btnAtk = createBtn('attack');
    const btnDef = createBtn('defense');
    this.skillButtons = [btnHp, btnAtk, btnDef];

    this.updateProfile = () => {
        const w = this.scale.width;
        const h = this.scale.height;
        const boxW = 450; const boxH = 500;
        const boxX = (w - boxW) / 2; const boxY = (h - boxH) / 2;
        
        this.profileBox.clear();
        this.profileBox.fillStyle(0x000000, 0.9);
        this.profileBox.fillRect(boxX, boxY, boxW, boxH);
        this.profileBox.lineStyle(4, 0xffffff);
        this.profileBox.strokeRect(boxX, boxY, boxW, boxH);
        
        const barX = boxX + 50; const barY = boxY + 420;
        const barW = 350; const barH = 20;
        this.profileBox.fillStyle(0x333333, 1);
        this.profileBox.fillRect(barX, barY, barW, barH);
        const expPct = Math.min(1, playerStats.experience / 100);
        this.profileBox.fillStyle(0x00ffff, 1);
        this.profileBox.fillRect(barX, barY, barW * expPct, barH);

        this.profileText.setPosition(boxX + 50, boxY + 50);
        const playerName = gameData[0]?.player?.name || "Unknown";
        this.profileText.setText(
            `PLAYER PROFILE\n\nName: ${playerName}\n\nLevel: ${playerStats.level}\nHP: ${playerStats.hp} / ${playerStats.maxHp}\nAttack: ${playerStats.attack}\nDefense: ${playerStats.defense}\n\nSkill Points: ${playerStats.skillPoints}\n\nExperience: ${playerStats.experience} / 100`
        );
        const showBtns = playerStats.skillPoints > 0 && this.profileBox.visible;
        btnHp.setPosition(boxX + 250, boxY + 160).setVisible(showBtns);
        btnAtk.setPosition(boxX + 250, boxY + 195).setVisible(showBtns);
        btnDef.setPosition(boxX + 250, boxY + 230).setVisible(showBtns);
    };

    this.toggleProfile = () => {
        if (!this.profileBox) return;
        const isVisible = !this.profileBox.visible;
        this.profileBox.setVisible(isVisible);
        this.profileText.setVisible(isVisible);
        this.skillButtons.forEach(b => b.setVisible(isVisible && playerStats.skillPoints > 0));
        if (isVisible) this.updateProfile();
    };

    this.updateProfile();
    this.scale.on('resize', () => { if (this.profileBox.visible) this.updateProfile(); });

    const profileIcon = this.add.text(20, 20, 'Status', { fontSize: '24px', fontFamily: 'Arial', fontStyle: 'bold', backgroundColor: '#000000', padding: { x: 15, y: 8 }, color: '#ffffff' })
        .setScrollFactor(0).setDepth(2000).setInteractive({ useHandCursor: true });
    profileIcon.on('pointerdown', () => this.toggleProfile());

    // Menu & Battle (Simplified for brevity)
    menuContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(3000).setVisible(false);
    const menuBg = this.add.graphics();
    menuBg.fillStyle(0x000000, 0.9);
    menuBg.fillRect(0, 0, 200, 120);
    menuContainer.add(menuBg);
    const menuOption1 = this.add.text(20, 20, '> Chat', { fontSize: '24px', fill: '#ffffff' });
    const menuOption2 = this.add.text(20, 60, '  Fight', { fontSize: '24px', fill: '#ffffff' });
    menuContainer.add([menuOption1, menuOption2]);
    menuContainer.selection = 0;
    this.updateMenuSelection = () => {
        if (menuContainer.selection === 0) { menuOption1.setText('> Chat'); menuOption2.setText('  Fight'); } 
        else { menuOption1.setText('  Chat'); menuOption2.setText('> Fight'); }
    };

    battleContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(4000).setVisible(false);
    battleContainer.add(this.add.rectangle(0, 0, 3000, 3000, 0x000000, 0.85));
    battlePlayerSprite = this.add.sprite(-200, 50, 'player').setScale(1.5);
    battleNpcSprite = this.add.sprite(200, 50, 'npc_0_0').setScale(1.5);
    battleContainer.add([battlePlayerSprite, battleNpcSprite]);
    battleLogText = this.add.text(0, 150, 'Battle', { fontSize: '20px', fill: '#fff', align: 'center' }).setOrigin(0.5);
    battleHpText = this.add.text(0, -150, 'HP', { fontSize: '20px', fill: '#fff' }).setOrigin(0.5);
    battleContainer.add([battleLogText, battleHpText]);
    
    // Minimal Battle Bars
    battlePlayerBarFg = this.add.rectangle(0,0,200,20,0x00ff00).setOrigin(0,0.5);
    battleNpcBarFg = this.add.rectangle(0,0,200,20,0xff0000).setOrigin(0,0.5);
    battleContainer.add([battlePlayerBarFg, battleNpcBarFg]);

    this.updateBattleLayout = () => {
        const w = this.scale.width;
        const h = this.scale.height;
        battlePlayerSprite.setPosition(w/2 - 200, h/2 + 50);
        battleNpcSprite.setPosition(w/2 + 200, h/2 + 50);
        battleLogText.setPosition(w/2, h/2 + 180);
        battleHpText.setPosition(w/2, h/2 - 180);
    };
    this.scale.on('resize', this.updateBattleLayout);
    this.updateBattleLayout();

    // Dialogue
    dialogueBox = this.add.graphics().setScrollFactor(0).setDepth(1000).setVisible(false);
    this.dialogueAvatar = this.add.image(0,0,'player_avatar').setScrollFactor(0).setVisible(false).setDepth(1001);
    dialogueSpeaker = this.add.text(0,0,'',{fontSize:'22px',fill:'#ff0'}).setScrollFactor(0).setVisible(false).setDepth(1002);
    dialogueText = this.add.text(0,0,'',{fontSize:'18px',fill:'#fff',wordWrap:{width:660}}).setScrollFactor(0).setVisible(false).setDepth(1002);
    
    this.dialogueUiUpdate = () => {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;
        const boxX=w*0.05, boxY=h-170, boxW=w*0.9, boxH=140;
        dialogueBox.clear().fillStyle(0x000000, 0.9).fillRect(boxX,boxY,boxW,boxH).lineStyle(3,0xffffff).strokeRect(boxX,boxY,boxW,boxH);
        this.dialogueBoxSize = {boxX, boxY, boxH};
        this.dialogueAvatar.setPosition(boxX+boxH*0.5, boxY+boxH*0.5).setDisplaySize(boxH,boxH);
        dialogueSpeaker.setPosition(boxX+boxH+20, boxY+15);
        dialogueText.setPosition(boxX+boxH+20, boxY+50).setWordWrapWidth(boxW-boxH-30);
    };
    this.scale.on('resize', this.dialogueUiUpdate);
    this.dialogueUiUpdate();
}

function initScene(index) {
    if (index < 0 || index >= gameData.length) return;
    currentSceneIndex = index;
    const sceneData = gameData[index];
    
    // Background
    let bgKey = `bg_${index}`;
    if (!this.textures.exists(bgKey)) bgKey = 'bg_placeholder';
    bgSprite.setTexture(bgKey).setDisplaySize(worldSize.width, worldSize.height);

    // Obstacles
    obstacles = this.physics.add.staticGroup();
    let rawBuildings = sceneData.building_coordinates;
    if (typeof rawBuildings === 'string') { try { rawBuildings = JSON.parse(rawBuildings); } catch(e) {} }
    const buildings = sanitizeBuildings(rawBuildings);
    const palette = [0x6f4a2f, 0x7a5534, 0x6a3f26, 0x7b4f30];
    buildings.forEach((b, i) => {
        const building = this.add.rectangle(b.x, b.y, b.w, b.h, palette[i % palette.length]).setOrigin(0, 0);
        building.setVisible(false);
        this.physics.add.existing(building, true);
        obstacles.add(building);
    });
    this.physics.add.collider(player, obstacles);

    // NPCs
    npcs.forEach(n => n.destroy());
    npcs = [];
    if (sceneData.npc) {
        sceneData.npc.forEach((npc, nIdx) => {
            const npcKey = `npc_${index}_${nIdx}`;
            const avatarKey = `npc_${index}_${nIdx}_avatar`;
            const tex = this.textures.exists(npcKey) ? npcKey : 'player'; 
            
            // Random Spawn
            let sx, sy, ok=false, tries=0;
            while(!ok && tries<100) {
                sx = Phaser.Math.Between(100, worldSize.width-100);
                sy = Phaser.Math.Between(100, worldSize.height-100);
                ok = true;
                for(let b of buildings) if(sx>=b.x && sx<=b.x+b.w && sy>=b.y && sy<=b.y+b.h) ok=false;
                if(ok) for(let n of npcs) if(Phaser.Math.Distance.Between(sx,sy,n.x,n.y)<200) ok=false;
                tries++;
            }
            
            const npcSprite = this.physics.add.sprite(sx, sy, tex);
            npcSprite.setScale(96 / (npcSprite.height||128));
            npcSprite.setImmovable(true);
            npcSprite.setSize(40,56).setOffset(44,48);
            npcSprite.setData('data', npc);
            npcSprite.setData('avatarKey', this.textures.exists(avatarKey) ? avatarKey : 'player_avatar');
            npcSprite.setData('stats', { name: npc.name, level: 1, hp: 100, maxHp: 100, attack: 10, defense: 10 });
            
            npcs.push(npcSprite);
            
            const prompt = this.add.text(sx, sy-80, 'SPACE', {fontSize:'16px', backgroundColor:'#000'}).setOrigin(0.5).setVisible(false);
            npcSprite.setData('prompt', prompt);
        });
    }
    this.physics.add.collider(player, npcs);

    // Arrows
    if (nextLevelArrow) nextLevelArrow.destroy();
    if (prevLevelArrow) prevLevelArrow.destroy();
    if (index < gameData.length - 1) {
        nextLevelArrow = this.add.text(worldSize.width-80, worldSize.height/2, '>>>', {fontSize:'64px', fill:'#0f0'}).setOrigin(0.5);
    }
    if (index > 0) {
        prevLevelArrow = this.add.text(80, worldSize.height/2, '<<<', {fontSize:'64px', fill:'#0f0'}).setOrigin(0.5);
    }
}

function sanitizeBuildings(buildings) {
    if (!Array.isArray(buildings)) return defaultBuildings;
    return buildings.map(b => ({x:Number(b.x), y:Number(b.y), w:Number(b.w), h:Number(b.h)})).filter(b => b.w>0 && b.h>0);
}

function update() {
    if (!player) return;

    // Teleport
    if (player.x > worldSize.width - 50 && currentSceneIndex < gameData.length - 1) {
        initScene.call(this, currentSceneIndex + 1);
        player.x = 100;
    } else if (player.x < 50 && currentSceneIndex > 0) {
        initScene.call(this, currentSceneIndex - 1);
        player.x = worldSize.width - 100;
    }

    // Menu
    if (menuContainer && menuContainer.visible) {
        if (Phaser.Input.Keyboard.JustDown(keys.esc)) closeInteractionMenu();
        if (Phaser.Input.Keyboard.JustDown(keys.up) || Phaser.Input.Keyboard.JustDown(keys.down)) {
            menuContainer.selection = menuContainer.selection === 0 ? 1 : 0;
            this.updateMenuSelection();
        }
        if (Phaser.Input.Keyboard.JustDown(keys.space) || Phaser.Input.Keyboard.JustDown(keys.enter)) {
            if (menuContainer.selection === 0) {
                const n = currentTargetNpc; closeInteractionMenu();
                if(n) { isPaused=true; startDialogue(this, n.getData('data'), n.getData('avatarKey')); }
            } else {
                startBattle(this);
            }
        }
        return;
    }

    if (isPaused) {
        player.setVelocity(0);
        player.anims.stop();
        if (currentDialogue && Phaser.Input.Keyboard.JustDown(keys.space)) advanceDialogue(this);
        return;
    }

    // Check interaction
    let activePrompt = null;
    npcs.forEach(npc => {
        const dist = Phaser.Math.Distance.Between(player.x, player.y, npc.x, npc.y);
        const p = npc.getData('prompt');
        if (p) {
            p.setVisible(dist < 100);
            if (dist < 100) activePrompt = npc;
        }
    });

    if (Phaser.Input.Keyboard.JustDown(keys.space) && activePrompt) {
        openInteractionMenu(this, activePrompt);
        return;
    }

    // Move
    const speed = 200;
    const vx = (keys.left.isDown ? -1 : 0) + (keys.right.isDown ? 1 : 0);
    const vy = (keys.up.isDown ? -1 : 0) + (keys.down.isDown ? 1 : 0);
    const len = Math.hypot(vx, vy) || 1;
    player.setVelocity((vx/len)*speed, (vy/len)*speed);

    if (vx>0) player.play('walk-right', true);
    else if (vx<0) player.play('walk-left', true);
    else if (vy<0) player.play('walk-up', true);
    else if (vy>0) player.play('walk-down', true);
    else { player.anims.stop(); player.setFrame(3); }
}

function openInteractionMenu(scene, npc) {
    isPaused = true;
    currentTargetNpc = npc;
    const cam = scene.cameras.main;
    menuContainer.setPosition(player.x - cam.scrollX + 50, player.y - cam.scrollY - 50).setVisible(true);
}
function closeInteractionMenu() { menuContainer.setVisible(false); isPaused = false; currentTargetNpc = null; }
function startBattle(scene) { 
    if(!currentTargetNpc) return; 
    menuContainer.setVisible(false); 
    battleContainer.setVisible(true); 
    scene.updateBattleLayout();
    const stats = currentTargetNpc.getData('stats');
    battleLogText.setText(`VS ${stats.name}`);
    updateBattleStats(stats);
    scene.time.addEvent({ delay: 1000, callback: () => executeBattleTurn(scene, stats), loop: true });
}
function executeBattleTurn(scene, npcStats) {
    if (!battleContainer.visible) return;
    const dmg = Math.max(1, playerStats.attack - Math.floor(npcStats.defense/2));
    npcStats.hp -= dmg;
    battleLogText.setText(`Hit ${npcStats.name}: ${dmg}`);
    shakeSprite(scene, battleNpcSprite);
    updateBattleStats(npcStats);
    
    if (npcStats.hp <= 0) { endBattle(scene, true); return; }
    
    scene.time.delayedCall(500, () => {
        if (!battleContainer.visible) return;
        const pdmg = Math.max(1, npcStats.attack - Math.floor(playerStats.defense/2));
        playerStats.hp -= pdmg;
        battleLogText.setText(`Hit Player: ${pdmg}`);
        shakeSprite(scene, battlePlayerSprite);
        updateBattleStats(npcStats);
        if (playerStats.hp <= 0) endBattle(scene, false);
    });
}
function updateBattleStats(n) { battleHpText.setText(`HP: ${playerStats.hp} vs ${n.hp}`); battlePlayerBarFg.width = 200*(playerStats.hp/playerStats.maxHp); battleNpcBarFg.width = 200*(n.hp/n.maxHp); }
function shakeSprite(scene, s) { scene.tweens.add({targets:s, x:s.x+10, duration:50, yoyo:true, repeat:3}); }
function endBattle(scene, win) {
    scene.time.removeAllEvents();
    battleLogText.setText(win ? "WIN!" : "LOSE...");
    if(win) { playerStats.experience+=50; if(playerStats.experience>=100) {playerStats.level++; playerStats.experience=0; playerStats.skillPoints+=5;} }
    else playerStats.hp=1;
    scene.time.delayedCall(2000, () => { battleContainer.setVisible(false); isPaused=false; });
}
function startDialogue(scene, data, avatar) {
    currentDialogue = { lines: data.dialogue, index: 0, npcAvatarKey: avatar };
    scene.dialogueUiUpdate(); dialogueBox.setVisible(true); dialogueSpeaker.setVisible(true); dialogueText.setVisible(true); scene.dialogueAvatar.setVisible(true);
    advanceDialogue(scene);
}
function advanceDialogue(scene) {
    if (currentDialogue.index < currentDialogue.lines.length) {
        const [s, t] = currentDialogue.lines[currentDialogue.index];
        dialogueSpeaker.setText(s); dialogueText.setText(t);
        scene.dialogueAvatar.setTexture(s===gameData[0].player.name ? 'player_avatar' : currentDialogue.npcAvatarKey);
        currentDialogue.index++;
    } else {
        currentDialogue = null; dialogueBox.setVisible(false); dialogueSpeaker.setVisible(false); dialogueText.setVisible(false); scene.dialogueAvatar.setVisible(false); isPaused=false;
    }
}
