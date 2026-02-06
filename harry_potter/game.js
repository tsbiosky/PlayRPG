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
let playerAnimState = { dir: 'down', frame: 0, lastTime: 0 };

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
    // Load individual directional strips instead of combined sheet
    this.load.image('player_down_img', 'assets/temp_down.png');
    this.load.image('player_up_img', 'assets/temp_up.png');
    this.load.image('player_right_img', 'assets/temp_right.png');
    this.load.image('player_avatar', 'assets/player_avatar.png');
    // Audio
    this.load.audio('walk_sfx', 'assets/walk.mp3');
    this.load.audio('hit_sfx', 'assets/hit.wav');
    this.load.audio('level_sfx', 'assets/level.mp3');
    this.load.audio('bgm', 'assets/bgm.mp3');
    this.load.audio('bgm_default', 'assets/default_BGM.mp3');
}

function create() {
    // 1. Debug Log Setup
    this.debugText = this.add.text(10, 10, "Init...", { font: "16px Arial", fill: "#00ff00", backgroundColor: "#000000" })
        .setScrollFactor(0).setDepth(9999).setVisible(false);
    
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
            // Load Minion Assets
            if (scene.minions) {
                scene.minions.forEach(m => {
                    if (m.sprite) {
                        const key = m.sprite.replace('.png','');
                        if (!this.textures.exists(key)) {
                            this.load.image(key, `assets/${m.sprite}`);
                            assetsToLoad = true;
                        }
                    }
                });
            }
        });

        // 5. Start Game Function
        const startGame = () => {
            try {
                logStep("Step 4: Starting Opening...");
                playOpeningSequence.call(this, () => {
                    logStep("Step 4b: Starting Setup...");
                    setupGame.call(this, logStep);
                    logStep("Step 5: Setup Complete!");
                    
                    // Hide debug text after success
                    this.time.delayedCall(3000, () => {
                        if(this.debugText) this.debugText.visible = false;
                    });
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

function playOpeningSequence(onComplete) {
    const remarks = gameData[0]?.opening_remarks || "";
    if (!remarks) {
        onComplete();
        return;
    }

    const w = this.scale.width;
    const h = this.scale.height;

    // Cover screen
    const cover = this.add.rectangle(w/2, h/2, Math.max(w, 3000), Math.max(h, 3000), 0x000000)
        .setScrollFactor(0)
        .setDepth(30000); 

    const text = this.add.text(w/2, h/2, remarks, {
        fontSize: '28px',
        fontFamily: 'Arial',
        fill: '#ffffff',
        align: 'center',
        wordWrap: { width: w * 0.7 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30001).setAlpha(0);

    this.tweens.add({
        targets: text,
        alpha: 1,
        duration: 2000,
        ease: 'Power2',
        onComplete: () => {
            this.time.delayedCall(2000, () => {
                this.tweens.add({
                    targets: [text, cover],
                    alpha: 0,
                    duration: 1500,
                    onComplete: () => {
                        text.destroy();
                        cover.destroy();
                        onComplete();
                    }
                });
            });
        }
    });
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

    // Build player spritesheets from strips
    const buildPlayerSheet = (imgKey, sheetKey) => {
        if (this.textures.exists(sheetKey)) return;
        const tex = this.textures.get(imgKey);
        if (!tex || !tex.getSourceImage) return;
        const source = tex.getSourceImage();
        if (!source || !source.width || !source.height) return;
        const frameWidth = Math.floor(source.width / 3);
        const frameHeight = source.height;
        this.textures.addSpriteSheet(sheetKey, source, { frameWidth, frameHeight });
    };
    buildPlayerSheet('player_down_img', 'player_down_sheet');
    buildPlayerSheet('player_up_img', 'player_up_sheet');
    buildPlayerSheet('player_right_img', 'player_right_sheet');

    // B. UI
    setupUI.call(this);
    setupAudio.call(this);

    // C. Player
    if (this.textures.exists('player_down_sheet')) {
        player = this.physics.add.sprite(128, 128, 'player_down_sheet');
        player.setDepth(100); // Ensure player is visible above background
        
        // Anims
        if (!this.anims.exists('walk-down')) {
            // Standard 4-step walk cycle using 3 frames: Idle (0), Step 1 (1), Idle (0), Step 2 (2)
            const walkFrames = [0, 1, 2];
            this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('player_down_sheet', { frames: walkFrames }), frameRate: 8, repeat: -1 });
            this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('player_up_sheet', { frames: walkFrames }), frameRate: 8, repeat: -1 });
            this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('player_right_sheet', { frames: walkFrames }), frameRate: 8, repeat: -1 });
        }
        
        player.setScale(288 / 128); 
        player.setCollideWorldBounds(true);
        player.setSize(40, 90).setOffset(44, 20); 
        player.setFrame(0);
        
        this.cameras.main.startFollow(player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, worldSize.width, worldSize.height);
    } else {
        logStep("! Player texture missing");
        player = this.add.rectangle(128, 128, 64, 64, 0x00ff00);
        player.setDepth(100);
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
        esc: Phaser.Input.Keyboard.KeyCodes.ESC,
        shift: Phaser.Input.Keyboard.KeyCodes.SHIFT
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
        btnHp.setPosition(boxX + 250, boxY + 220).setVisible(showBtns);
        btnAtk.setPosition(boxX + 250, boxY + 255).setVisible(showBtns);
        btnDef.setPosition(boxX + 250, boxY + 290).setVisible(showBtns);

        if (this.shiftTip) {
            this.shiftTip.setPosition(20, h - 40);
        }
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
    
    // Tips
    this.shiftTip = this.add.text(20, this.scale.height - 40, 'Shift : Run', {
        fontSize: '18px',
        fill: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 6 }
    }).setScrollFactor(0).setDepth(2000);

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
        const menuOption1 = menuContainer.list[1];
        const menuOption2 = menuContainer.list[2];
        const npc = currentTargetNpc;
        
        if (!npc) return;
        const stats = npc.getData('stats');
        const defeated = npc.getData('data').defeated;

        if (defeated) {
             menuOption1.setText('> Chat'); 
             menuOption2.setText('');
             menuContainer.selection = 0;
             return;
        }

        if (stats.isMinion) {
            menuOption1.setText(''); 
            menuOption2.setText('> Fight');
            menuContainer.selection = 1; 
        } else {
            if (menuContainer.selection === 0) { menuOption1.setText('> Chat'); menuOption2.setText('  Fight'); } 
            else { menuOption1.setText('  Chat'); menuOption2.setText('> Fight'); }
        }
    };

    battleContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(4000).setVisible(false);
    // Localized background box instead of full screen overlay
    this.battleBox = this.add.rectangle(0, 0, 800, 500, 0x000000, 0.85); 
    battleContainer.add(this.battleBox);
    
    battlePlayerSprite = this.add.sprite(-200, 50, 'player_down_sheet').setScale(1.5);
    battleNpcSprite = this.add.sprite(200, 50, 'npc_0_0').setScale(1.5);
    battleContainer.add([battlePlayerSprite, battleNpcSprite]);
    battleLogText = this.add.text(0, 150, 'Battle', { fontSize: '20px', fill: '#fff', align: 'center' }).setOrigin(0.5);
    battleHpText = this.add.text(0, -150, 'HP', { fontSize: '20px', fill: '#fff' }).setOrigin(0.5);
    battleContainer.add([battleLogText, battleHpText]);
    
    // Minimal Battle Bars
    battlePlayerBarBg = this.add.rectangle(0,0,200,20,0x333333).setOrigin(0,0.5);
    battlePlayerBarFg = this.add.rectangle(0,0,200,20,0x00ff00).setOrigin(0,0.5);
    battleNpcBarBg = this.add.rectangle(0,0,200,20,0x333333).setOrigin(0,0.5);
    battleNpcBarFg = this.add.rectangle(0,0,200,20,0xff0000).setOrigin(0,0.5);
    battleContainer.add([battlePlayerBarBg, battlePlayerBarFg, battleNpcBarBg, battleNpcBarFg]);

    this.updateBattleLayout = () => {
        const w = this.scale.width;
        const h = this.scale.height;
        
        if (this.battleBox) this.battleBox.setPosition(w/2, h/2);

        const playerX = w/2 - 200;
        const npcX = w/2 + 200;
        const spriteY = h/2 + 50;

        battlePlayerSprite.setPosition(playerX, spriteY);
        battleNpcSprite.setPosition(npcX, spriteY);
        battleLogText.setPosition(w/2, h/2 + 180);
        battleHpText.setPosition(w/2, h/2 - 180);

        // Position bars above sprites
        const barY = spriteY - 120;
        battlePlayerBarBg.setPosition(playerX - 100, barY);
        battlePlayerBarFg.setPosition(playerX - 100, barY);
        battleNpcBarBg.setPosition(npcX - 100, barY);
        battleNpcBarFg.setPosition(npcX - 100, barY);
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

    this.input.on('pointerdown', () => {
        if (isPaused && currentDialogue) {
            advanceDialogue(this);
        }
    });
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
    if (obstacles) obstacles.clear(true, true);
    obstacles = this.physics.add.staticGroup();
    let rawBuildings = sceneData.building_coordinates;
    if (typeof rawBuildings === 'string') { try { rawBuildings = JSON.parse(rawBuildings); } catch(e) {} }
    const buildings = sanitizeBuildings(rawBuildings);
    const teleportClearance = 140;
    const obstacleBuildings = buildings.filter(b => !blocksTeleport(b, teleportClearance));
    const palette = [0x6f4a2f, 0x7a5534, 0x6a3f26, 0x7b4f30];
    obstacleBuildings.forEach((b, i) => {
        const building = this.add.rectangle(b.x, b.y, b.w, b.h, palette[i % palette.length]).setOrigin(0, 0);
        building.setVisible(false);
        this.physics.add.existing(building, true);
        obstacles.add(building);
    });
    this.physics.add.collider(player, obstacles);

    // Ensure player isn't spawned inside a building
    if (player && isInsideBuilding(player.x, player.y, obstacleBuildings, 10)) {
        const safe = findSafeSpawn(obstacleBuildings, npcs);
        player.setPosition(safe.x, safe.y);
    }

    // NPCs
    npcs.forEach(n => n.destroy());
    npcs = [];
    if (sceneData.npc) {
        sceneData.npc.forEach((npc, nIdx) => {
            if (npc.defeated) return; // Skip defeated NPCs

            const npcKey = `npc_${index}_${nIdx}`;
            const avatarKey = `npc_${index}_${nIdx}_avatar`;
            const tex = this.textures.exists(npcKey) ? npcKey : 'player_down_sheet'; 
            
            // Random Spawn (not inside buildings)
            let npcSpawn = (npc.x !== undefined && npc.y !== undefined) ? { x: npc.x, y: npc.y } : null;
            if (!npcSpawn || isInsideBuilding(npcSpawn.x, npcSpawn.y, obstacleBuildings, 10)) {
                npcSpawn = findSafeSpawn(obstacleBuildings, npcs);
                npc.x = npcSpawn.x;
                npc.y = npcSpawn.y;
            }
            
            const npcSprite = this.physics.add.sprite(npcSpawn.x, npcSpawn.y, tex);
            npcSprite.setScale(240 / (npcSprite.height||128));
            npcSprite.setImmovable(true);
            npcSprite.setSize(40,56).setOffset(44,48);
            npcSprite.setData('data', npc);
            npcSprite.setData('avatarKey', this.textures.exists(avatarKey) ? avatarKey : 'player_avatar');
            // Use stats from data or fallback
            npcSprite.setData('stats', { 
                name: npc.name, 
                level: 1, 
                hp: npc.hp || 100, 
                maxHp: npc.hp || 100, 
                attack: npc.attack || 10, 
                defense: npc.defense || 10,
                isMinion: false
            });
            
            npcs.push(npcSprite);
            
            const prompt = this.add.text(npcSpawn.x, npcSpawn.y-80, 'SPACE', {fontSize:'16px', backgroundColor:'#000'}).setOrigin(0.5).setVisible(false);
            npcSprite.setData('prompt', prompt);
        });
    }

    // Minions
    if (sceneData.minions) {
        sceneData.minions.forEach((minion, mIdx) => {
            if (minion.defeated) return;

            // Use the shared minion sprite
            const minionKey = minion.sprite ? minion.sprite.replace('.png','') : 'player_down_sheet';
            // Ensure texture exists, else fallback
            const tex = this.textures.exists(minionKey) ? minionKey : 'player_down_sheet';

            let minionSpawn = (minion.x !== undefined && minion.y !== undefined) ? { x: minion.x, y: minion.y } : null;
            if (!minionSpawn || isInsideBuilding(minionSpawn.x, minionSpawn.y, obstacleBuildings, 10)) {
                minionSpawn = findSafeSpawn(obstacleBuildings, npcs);
                minion.x = minionSpawn.x;
                minion.y = minionSpawn.y;
            }

            const mSprite = this.physics.add.sprite(minionSpawn.x, minionSpawn.y, tex);
            mSprite.setScale(160 / (mSprite.height||128));
            mSprite.setImmovable(true);
            mSprite.setSize(40,56).setOffset(44,48);
            
            // Minion Data
            mSprite.setData('data', minion);
            mSprite.setData('stats', { 
                name: minion.name, 
                hp: minion.hp || 50, 
                maxHp: minion.hp || 50, 
                attack: minion.attack || 5, 
                defense: minion.defense || 0,
                isMinion: true
            });

            npcs.push(mSprite);
            const prompt = this.add.text(minionSpawn.x, minionSpawn.y-80, 'SPACE', {fontSize:'16px', backgroundColor:'#900'}).setOrigin(0.5).setVisible(false);
            mSprite.setData('prompt', prompt);
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

function setupAudio() {
    if (this.cache && this.cache.audio && this.cache.audio.exists('walk_sfx')) {
        this.walkSfx = this.sound.add('walk_sfx', { loop: true, volume: 0.25 });
    }
    if (this.cache && this.cache.audio && this.cache.audio.exists('hit_sfx')) {
        this.hitSfx = this.sound.add('hit_sfx', { loop: false, volume: 0.6 });
    }
    if (this.cache && this.cache.audio && this.cache.audio.exists('level_sfx')) {
        this.levelSfx = this.sound.add('level_sfx', { loop: false, volume: 0.7 });
    }
    if (this.cache && this.cache.audio) {
        const bgmKey = this.cache.audio.exists('bgm') ? 'bgm' : (this.cache.audio.exists('bgm_default') ? 'bgm_default' : null);
        if (bgmKey) {
            this.bgm = this.sound.add(bgmKey, { loop: true, volume: 0.2 });
            this.bgm.play();
        }
    }
}

function playHitSfx(scene) {
    if (scene && scene.hitSfx) scene.hitSfx.play();
}

function playLevelUpSfx(scene) {
    if (scene && scene.levelSfx) scene.levelSfx.play();
}

function showLevelUp(scene) {
    if (!scene || !player) return;
    const text = scene.add.text(player.x, player.y - 100, 'Level Up!', {
        fontSize: '24px',
        fontFamily: 'Arial',
        fill: '#ffff00',
        stroke: '#000000',
        strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000);

    scene.tweens.add({
        targets: text,
        y: player.y - 150,
        alpha: 0,
        duration: 1200,
        ease: 'Power1',
        onComplete: () => text.destroy()
    });
}

function startWalkSfx(scene) {
    if (scene && scene.walkSfx && !scene.walkSfx.isPlaying) scene.walkSfx.play();
}

function stopWalkSfx(scene) {
    if (scene && scene.walkSfx && scene.walkSfx.isPlaying) scene.walkSfx.stop();
}

function blocksTeleport(b, clearance) {
    return b.x < clearance || (b.x + b.w) > (worldSize.width - clearance);
}

function isInsideBuilding(x, y, buildings, padding = 0) {
    for (let b of buildings) {
        if (x >= b.x - padding && x <= b.x + b.w + padding && y >= b.y - padding && y <= b.y + b.h + padding) {
            return true;
        }
    }
    return false;
}

function findSafeSpawn(buildings, existing, tries = 150) {
    let sx = 128, sy = 128, ok = false, t = 0;
    while (!ok && t < tries) {
        sx = Phaser.Math.Between(100, worldSize.width - 100);
        sy = Phaser.Math.Between(100, worldSize.height - 100);
        ok = !isInsideBuilding(sx, sy, buildings, 10);
        if (ok && existing) {
            for (let n of existing) {
                if (Phaser.Math.Distance.Between(sx, sy, n.x, n.y) < 200) {
                    ok = false;
                    break;
                }
            }
        }
        t++;
    }
    return { x: sx, y: sy };
}

function playWalkAnim(scene, dir) {
    const animKey = `walk-${dir}`;
    const sheetKey = (dir === 'left') ? 'player_right_sheet' : `player_${dir}_sheet`;

    if (scene.textures.exists(sheetKey) && player.texture.key !== sheetKey) {
        player.setTexture(sheetKey);
    }

    player.setFlipX(dir === 'left');

    if (scene.anims.exists(animKey)) {
        const anim = scene.anims.get(animKey);
        if (anim && anim.frames && anim.frames.length > 1) {
            player.play(animKey, true);
            return;
        }
    }

    const now = scene.time.now;
    if (playerAnimState.dir !== dir) {
        playerAnimState.dir = dir;
        playerAnimState.frame = 0;
        playerAnimState.lastTime = 0;
    }
    if (now - playerAnimState.lastTime > 120) {
        playerAnimState.frame = (playerAnimState.frame + 1) % 3;
        playerAnimState.lastTime = now;
    }
    player.setFrame(playerAnimState.frame);
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
        stopWalkSfx(this);
        if (Phaser.Input.Keyboard.JustDown(keys.esc)) closeInteractionMenu();
        if (Phaser.Input.Keyboard.JustDown(keys.up) || Phaser.Input.Keyboard.JustDown(keys.down)) {
            menuContainer.selection = menuContainer.selection === 0 ? 1 : 0;
            this.updateMenuSelection();
        }
        if (Phaser.Input.Keyboard.JustDown(keys.space) || Phaser.Input.Keyboard.JustDown(keys.enter)) {
            if (!currentTargetNpc) return;
            const stats = currentTargetNpc.getData('stats');
            const defeated = currentTargetNpc.getData('data').defeated;
            
            if (defeated) {
                 // Only Chat allowed
                 const n = currentTargetNpc; closeInteractionMenu();
                 if(n) { isPaused=true; startDialogue(this, n.getData('data'), n.getData('avatarKey')); }
            } else if (stats.isMinion) {
                 // Only fight allowed
                 startBattle(this);
            } else {
                if (menuContainer.selection === 0) {
                    const n = currentTargetNpc; closeInteractionMenu();
                    if(n) { isPaused=true; startDialogue(this, n.getData('data'), n.getData('avatarKey')); }
                } else {
                    startBattle(this);
                }
            }
        }
        return;
    }

    if (isPaused) {
        stopWalkSfx(this);
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
            p.setVisible(dist < 140);
            if (dist < 140) activePrompt = npc;
        }
    });

    if (Phaser.Input.Keyboard.JustDown(keys.space) && activePrompt) {
        openInteractionMenu(this, activePrompt);
        return;
    }

    // Move
    const baseSpeed = 220;
    const runSpeed = 320;
    const speed = keys.shift.isDown ? runSpeed : baseSpeed;
    const vx = (keys.left.isDown ? -1 : 0) + (keys.right.isDown ? 1 : 0);
    const vy = (keys.up.isDown ? -1 : 0) + (keys.down.isDown ? 1 : 0);
    const len = Math.hypot(vx, vy) || 1;
    player.setVelocity((vx/len)*speed, (vy/len)*speed);

    if (vx>0) { playWalkAnim(this, 'right'); startWalkSfx(this); }
    else if (vx<0) { playWalkAnim(this, 'left'); startWalkSfx(this); }
    else if (vy<0) { playWalkAnim(this, 'up'); startWalkSfx(this); }
    else if (vy>0) { playWalkAnim(this, 'down'); startWalkSfx(this); }
    else { 
        stopWalkSfx(this);
        player.anims.stop(); 
        playerAnimState.frame = 0;
        player.setFrame(0); // All strips have idle at frame 0
    }
}

function openInteractionMenu(scene, npc) {
    const stats = npc.getData('stats');
    
    // Check if defeated
    if (npc.getData('data').defeated) {
        // Option: Show simple "Defeated" message or just Chat if NPC
        if (stats.isMinion) return; // Minions should be destroyed, but just in case
        
        // For NPCs, if defeated, maybe only allow chat or show different text?
        // User asked "no fight option".
        isPaused = true;
        currentTargetNpc = npc;
        const cam = scene.cameras.main;
        menuContainer.setPosition(player.x - cam.scrollX + 50, player.y - cam.scrollY - 50).setVisible(true);
        
        // Force chat selection, disable fight visually (simple way: change text)
        menuContainer.selection = 0;
        
        // Custom update for this menu instance
        const menuOption1 = menuContainer.list[1];
        const menuOption2 = menuContainer.list[2];
        menuOption1.setText('> Chat');
        menuOption2.setText(''); // Hide Fight option
        
        // We need to override the updateMenuSelection for this specific interaction
        // Or handle it in the main update loop logic
        return;
    }

    if (stats.isMinion) {
        isPaused = true;
        currentTargetNpc = npc;
        const cam = scene.cameras.main;
        menuContainer.setPosition(player.x - cam.scrollX + 50, player.y - cam.scrollY - 50).setVisible(true);
        menuContainer.selection = 1; 
        scene.updateMenuSelection();
    } else {
        isPaused = true;
        currentTargetNpc = npc;
        const cam = scene.cameras.main;
        menuContainer.setPosition(player.x - cam.scrollX + 50, player.y - cam.scrollY - 50).setVisible(true);
        menuContainer.selection = 0;
        scene.updateMenuSelection();
    }
}
function closeInteractionMenu() { menuContainer.setVisible(false); isPaused = false; currentTargetNpc = null; }
function startBattle(scene) { 
    if(!currentTargetNpc) return; 
    menuContainer.setVisible(false); 
    battleContainer.setVisible(true); 
    scene.updateBattleLayout();
    const stats = currentTargetNpc.getData('stats');
    
    // Set NPC Sprite
    const npcTexture = currentTargetNpc.texture.key;
    battleNpcSprite.setTexture(npcTexture);
    
    // Reset scale first
    battleNpcSprite.setScale(1); 
    const targetHeight = 192; // 128 (player base) * 1.5 (player scale)
    if (battleNpcSprite.height > 0) {
        const scale = targetHeight / battleNpcSprite.height;
        battleNpcSprite.setScale(scale);
    } else {
        battleNpcSprite.setScale(1.5);
    }

    battleLogText.setText(`VS ${stats.name}`);
    updateBattleStats(stats);
    scene.time.addEvent({ delay: 1000, callback: () => executeBattleTurn(scene, stats), loop: true });
}
function executeBattleTurn(scene, npcStats) {
    if (!battleContainer.visible) return;
    const dmg = Math.max(1, playerStats.attack - Math.floor(npcStats.defense/2));
    npcStats.hp = Math.max(0, npcStats.hp - dmg);
    battleLogText.setText(`Hit ${npcStats.name}: ${dmg}`);
    shakeSprite(scene, battleNpcSprite);
    playHitSfx(scene);
    updateBattleStats(npcStats);
    
    if (npcStats.hp <= 0) { endBattle(scene, true); return; }
    
    scene.time.delayedCall(500, () => {
        if (!battleContainer.visible) return;
        const pdmg = Math.max(1, npcStats.attack - Math.floor(playerStats.defense/2));
        playerStats.hp = Math.max(0, playerStats.hp - pdmg);
        battleLogText.setText(`Hit Player: ${pdmg}`);
        shakeSprite(scene, battlePlayerSprite);
        playHitSfx(scene);
        updateBattleStats(npcStats);
        if (playerStats.hp <= 0) endBattle(scene, false);
    });
}
function updateBattleStats(n) { battleHpText.setText(`HP: ${playerStats.hp} vs ${n.hp}`); battlePlayerBarFg.width = 200*(playerStats.hp/playerStats.maxHp); battleNpcBarFg.width = 200*(n.hp/n.maxHp); }
function shakeSprite(scene, s) { scene.tweens.add({targets:s, x:s.x+10, duration:50, yoyo:true, repeat:3}); }
function endBattle(scene, win) {
    scene.time.removeAllEvents();
    battleLogText.setText(win ? "WIN!" : "LOSE...");
    
    let leveledUp = false;
    if(win) { 
        const stats = currentTargetNpc.getData('stats');
        // XP based on strength (HP + Attack)
        const xpGain = Math.floor((stats.maxHp + stats.attack) * 0.5);
        playerStats.experience += xpGain; 
        
        if(playerStats.experience >= 100) {
            playerStats.level++; 
            playerStats.experience -= 100; 
            playerStats.skillPoints += 5;
            leveledUp = true;
        }
        
        // Disable NPC or Destroy Minion
        if (stats.isMinion) {
            // Mark as defeated in data so it doesn't respawn if we revisit (though initScene respawns from scratch usually)
            // Ideally we should update gameData but for now just destroy sprite
            currentTargetNpc.getData('data').defeated = true;
            // Remove prompt
            const p = currentTargetNpc.getData('prompt');
            if (p) p.destroy();
            currentTargetNpc.destroy();
            // Remove from npcs array
            const idx = npcs.indexOf(currentTargetNpc);
            if (idx > -1) npcs.splice(idx, 1);
        } else {
            // NPC: Mark defeated, maybe change color or disable interaction
            currentTargetNpc.setTint(0x555555);
            currentTargetNpc.getData('data').defeated = true;
            // Remove prompt
            const p = currentTargetNpc.getData('prompt');
            if (p) p.destroy();
        }
    } else {
        playerStats.hp = 1;
        if (currentTargetNpc) {
            const stats = currentTargetNpc.getData('stats');
            if (stats && stats.maxHp !== undefined) {
                stats.hp = stats.maxHp;
            }
        }
    }
    
    // Full Heal after fight
    playerStats.hp = playerStats.maxHp;
    scene.updateProfile();

    if (leveledUp) {
        showLevelUp(scene);
        playLevelUpSfx(scene);
    }

    scene.time.delayedCall(2000, () => { battleContainer.setVisible(false); isPaused=false; currentTargetNpc = null; });
}
function startDialogue(scene, data, avatar) {
    if (!data || !data.dialogue || data.dialogue.length === 0) {
        isPaused = false;
        return;
    }
    currentDialogue = { lines: data.dialogue, index: 0, npcAvatarKey: avatar };
    scene.dialogueUiUpdate(); dialogueBox.setVisible(true); dialogueSpeaker.setVisible(true); dialogueText.setVisible(true); scene.dialogueAvatar.setVisible(true);
    advanceDialogue(scene);
}
function advanceDialogue(scene) {
    if (currentDialogue && currentDialogue.index < currentDialogue.lines.length) {
        const [s, t] = currentDialogue.lines[currentDialogue.index];
        dialogueSpeaker.setText(s); dialogueText.setText(t);
        const pName = gameData[0]?.player?.name;
        scene.dialogueAvatar.setTexture((pName && s === pName) ? 'player_avatar' : currentDialogue.npcAvatarKey);
        currentDialogue.index++;
    } else {
        currentDialogue = null; dialogueBox.setVisible(false); dialogueSpeaker.setVisible(false); dialogueText.setVisible(false); scene.dialogueAvatar.setVisible(false); isPaused=false;
    }
}
