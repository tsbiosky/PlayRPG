
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
let gameData;
let player;
let npcs = [];
let currentDialogue = null;
let dialogueText;
let dialogueBox;
let dialogueSpeaker;
let keys;
let obstacles;
const worldSize = { width: 1600, height: 1200 };

function preload() {
    this.load.json('gameData', 'game_data.json');
    this.load.image('background', 'assets/background.png');
    this.load.spritesheet('player', 'assets/player_running.png', { frameWidth: 128, frameHeight: 128 });
    this.load.image('player_avatar', 'assets/player_avatar.png');
}

function create() {
    gameData = this.cache.json.get('gameData');
    
    // Background - make it larger than the screen
    const bg = this.add.image(0, 0, 'background').setOrigin(0, 0);
    // Scale background to a reasonable world size
    bg.setDisplaySize(worldSize.width, worldSize.height); 
    this.physics.world.setBounds(0, 0, worldSize.width, worldSize.height);

    // Buildings/obstacles (visual + collision)
    const buildings = [
        { x: 120, y: 120, w: 260, h: 180, color: 0x6f4a2f },
        { x: 520, y: 180, w: 220, h: 200, color: 0x7a5534 },
        { x: 980, y: 140, w: 260, h: 220, color: 0x6a3f26 },
        { x: 260, y: 520, w: 300, h: 220, color: 0x7b4f30 },
        { x: 860, y: 620, w: 300, h: 240, color: 0x6a3f26 },
        { x: 1200, y: 520, w: 280, h: 200, color: 0x7a5534 }
    ];

    obstacles = this.physics.add.staticGroup();
    buildings.forEach((b) => {
        const building = this.add.rectangle(b.x, b.y, b.w, b.h, b.color).setOrigin(0, 0);
        building.setVisible(false);
        this.physics.add.existing(building, true);
        obstacles.add(building);
    });

    // Load NPC sprites and avatars dynamically
    gameData.npc.forEach((npc, index) => {
        this.load.image(`npc_${index}`, `assets/${npc.sprite}`);
        this.load.image(`npc_${index}_avatar`, `assets/${npc.avatar}`);
    });

    this.load.once('complete', () => {
        // Create Player
        player = this.physics.add.sprite(128, 128, 'player');
        
        // Animation
        this.anims.create({
            key: 'walk-right',
            frames: this.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-left',
            frames: this.anims.generateFrameNumbers('player', { start: 1, end: 1 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-up',
            frames: this.anims.generateFrameNumbers('player', { start: 2, end: 2 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-down',
            frames: this.anims.generateFrameNumbers('player', { start: 3, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        // Scale to a fixed height (e.g., 96px)
        const playerScale = 96 / player.height;
        player.setScale(playerScale);
        player.setCollideWorldBounds(true);
        player.setSize(40, 56).setOffset(44, 48);
        player.setFrame(3);
        
        // Camera follow
        this.cameras.main.startFollow(player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, worldSize.width, worldSize.height);

        // Create NPCs
        gameData.npc.forEach((npc, index) => {
            const npcSprite = this.physics.add.sprite(500 + index * 300, 400, `npc_${index}`);
            const npcScale = 96 / npcSprite.height;
            npcSprite.setScale(npcScale);
            npcSprite.setImmovable(true);
            npcSprite.setSize(40, 56).setOffset(44, 48);
            npcSprite.setData('data', npc);
            npcSprite.setData('avatarKey', `npc_${index}_avatar`);
            npcs.push(npcSprite);
            
            // Interaction: Press SPACE when overlapping
            this.physics.add.overlap(player, npcSprite, () => {
                if (!currentDialogue && Phaser.Input.Keyboard.JustDown(keys.space)) {
                    startDialogue(this, npc, `npc_${index}_avatar`);
                }
            });

            // Prompt text above NPC
            const prompt = this.add.text(npcSprite.x, npcSprite.y - 80, 'Press SPACE', {
                fontSize: '16px',
                fill: '#fff',
                backgroundColor: '#000'
            }).setOrigin(0.5).setVisible(false);
            npcSprite.setData('prompt', prompt);
        });

        // Colliders
        this.physics.add.collider(player, obstacles);
        this.physics.add.collider(player, npcs);

        // Dialogue UI (Fixed to Camera)
        dialogueBox = this.add.graphics().setScrollFactor(0);
        dialogueBox.setDepth(1000);
        dialogueBox.setVisible(false);
        
        // Avatar in Dialogue Box
        this.dialogueAvatar = this.add.image(0, 0, 'player_avatar').setScrollFactor(0).setVisible(false);
        this.dialogueAvatar.setDepth(1001);

        // Use a function to update dialogue positions on resize
        const updateDialoguePosition = () => {
            const w = this.cameras.main.width;
            const h = this.cameras.main.height;
            
            dialogueBox.clear();
            dialogueBox.fillStyle(0x000000, 0.9);
            const boxX = w * 0.05;
            const boxY = h - 170;
            const boxW = w * 0.9;
            const boxH = 140;
            this.dialogueBoxSize = { boxX, boxY, boxW, boxH };

            dialogueBox.fillRect(boxX, boxY, boxW, boxH);
            dialogueBox.lineStyle(3, 0xffffff);
            dialogueBox.strokeRect(boxX, boxY, boxW, boxH);

            // Avatar same height as dialogue box
            this.dialogueAvatar.setPosition(boxX + boxH * 0.5, boxY + boxH * 0.5);
            this.dialogueAvatar.setDisplaySize(boxH, boxH);

            const textX = boxX + boxH + 20;
            dialogueSpeaker.setPosition(textX, boxY + 15);
            dialogueText.setPosition(textX, boxY + 50);
            dialogueText.setWordWrapWidth(boxW - boxH - 30);
        };

        dialogueSpeaker = this.add.text(0, 0, '', {
            fontSize: '22px',
            fontStyle: 'bold',
            fill: '#ffff00'
        }).setScrollFactor(0).setVisible(false);
        dialogueSpeaker.setDepth(1002);

        dialogueText = this.add.text(0, 0, '', {
            fontSize: '18px',
            fill: '#ffffff',
            wordWrap: { width: 660 }
        }).setScrollFactor(0).setVisible(false);
        dialogueText.setDepth(1002);

        updateDialoguePosition();
        this.scale.on('resize', updateDialoguePosition);
        this.dialogueUiUpdate = updateDialoguePosition;
    }, this);

    this.load.start();

    // Controls
    keys = this.input.keyboard.addKeys('w,a,s,d,up,left,down,right,space');
}

function startDialogue(scene, npcData, npcAvatarKey) {
    currentDialogue = {
        lines: npcData.dialogue,
        index: 0,
        npcAvatarKey: npcAvatarKey
    };
    if (scene.dialogueUiUpdate) {
        scene.dialogueUiUpdate();
    }
    dialogueBox.setVisible(true);
    dialogueSpeaker.setVisible(true);
    dialogueText.setVisible(true);
    scene.dialogueAvatar.setVisible(true);
    advanceDialogue(scene);
}

function advanceDialogue(scene) {
    if (currentDialogue.index < currentDialogue.lines.length) {
        const [speaker, text] = currentDialogue.lines[currentDialogue.index];
        dialogueSpeaker.setText(speaker);
        dialogueText.setText(text);
        
        // Update avatar based on speaker
        if (speaker === gameData.player.name) {
            scene.dialogueAvatar.setTexture('player_avatar');
        } else {
            scene.dialogueAvatar.setTexture(currentDialogue.npcAvatarKey);
        }
        if (scene.dialogueBoxSize) {
            const { boxX, boxY, boxH } = scene.dialogueBoxSize;
            scene.dialogueAvatar.setPosition(boxX + boxH * 0.5, boxY + boxH * 0.5);
            scene.dialogueAvatar.setDisplaySize(boxH, boxH);
        }
        
        currentDialogue.index++;
    } else {
        currentDialogue = null;
        dialogueBox.setVisible(false);
        dialogueSpeaker.setVisible(false);
        dialogueText.setVisible(false);
        scene.dialogueAvatar.setVisible(false);
    }
}

function update() {
    if (!player) return;

    npcs.forEach(npc => {
        const dist = Phaser.Math.Distance.Between(player.x, player.y, npc.x, npc.y);
        npc.getData('prompt').setVisible(dist < 100 && !currentDialogue);
    });

    if (currentDialogue) {
        player.setVelocity(0);
        player.anims.stop();
        if (Phaser.Input.Keyboard.JustDown(keys.space)) {
            advanceDialogue(this);
        }
        return;
    }

    // Manual dialogue trigger if overlap event misses
    if (Phaser.Input.Keyboard.JustDown(keys.space)) {
        let closestNpc = null;
        let closestDist = Infinity;
        npcs.forEach(npc => {
            const dist = Phaser.Math.Distance.Between(player.x, player.y, npc.x, npc.y);
            if (dist < 100 && dist < closestDist) {
                closestDist = dist;
                closestNpc = npc;
            }
        });
        if (closestNpc) {
            const npcData = closestNpc.getData('data');
            const avatarKey = closestNpc.getData('avatarKey');
            startDialogue(this, npcData, avatarKey);
            return;
        }
    }

    const speed = 200;
    const vx = (keys.left.isDown || keys.a.isDown ? -1 : 0) + (keys.right.isDown || keys.d.isDown ? 1 : 0);
    const vy = (keys.up.isDown || keys.w.isDown ? -1 : 0) + (keys.down.isDown || keys.s.isDown ? 1 : 0);

    const len = Math.hypot(vx, vy) || 1;
    player.setVelocity((vx / len) * speed, (vy / len) * speed);

    if (vx !== 0 || vy !== 0) {
        if (vx > 0) {
            player.play('walk-right', true);
        } else if (vx < 0) {
            player.play('walk-left', true);
        } else if (vy < 0) {
            player.play('walk-up', true);
        } else {
            player.play('walk-down', true);
        }
    } else {
        player.anims.stop();
        player.setFrame(3);
    }
}
