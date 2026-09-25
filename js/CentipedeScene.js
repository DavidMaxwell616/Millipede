
const TILE = 32;
const COLS = 20;
const ROWS = 25;
const FIRE_RATE = 100;
const PLAYFIELD_TOP = 80;
const CENTIPEDE_SEGMENT_SPACING = 24;
const PLAYER_TOP_BOUNDARY = 0.8;
const CENTIPEDE_DESCENT_SPEED = 160;
const CENTIPEDE_DESCENT_DISTANCE = 32;

export class CentipedeScene extends Phaser.Scene {
    constructor() {
        super('Centipede');
    }

    init(data = {}) {
        this.level = data.level ?? 1;
    }

    preload() {
        this.load.json('level-palettes', 'assets/json/level_palette.json');
        this.load.spritesheet('centipede-head-sprites', 'assets/images/centipede_head_spritesheet.png', {
            frameWidth: 8,
            frameHeight: 8
        });
        this.load.spritesheet('centipede-segment-sprites', 'assets/images/centipede_segment_spritesheet.png', {
            frameWidth: 8,
            frameHeight: 8
        });
        this.load.spritesheet('mushroom-sprites', 'assets/images/mushroom_spritesheet.png', {
            frameWidth: 8,
            frameHeight: 8
        });
        this.load.spritesheet('scorpion-sprites', 'assets/images/scorpion_spritesheet.png', {
            frameWidth: 16,
            frameHeight: 8
        });
        this.load.spritesheet('spider-sprites', 'assets/images/spider_spritesheet.png', {
            frameWidth: 16,
            frameHeight: 8
        });
        this.load.spritesheet('flea-sprites', 'assets/images/flea_spritesheet.png', {
            frameWidth: 9,
            frameHeight: 8
        });
        this.load.spritesheet('grasshopper-sprites', 'assets/images/grasshopper_spritesheet.png', {
            frameWidth: 8,
            frameHeight: 8
        });
        this.load.image('player-sprite', 'assets/images/player_sprite.png');
        this.load.image('bullet-sprite', 'assets/images/bullet_sprite.png');
    }

    create() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.createCentipedeAnimations();
        this.nextFireTime = 0;
        this.highScore = this.highScore ?? 0;
        this.score = this.score ?? 0;
        this.lives = this.lives ?? 3;
        this.levelTransitioning = false;
        this.levelCompleteText = null;
        this.playerZoneSpawnTimer = 0;
        this.paletteData = this.cache.json.get('level-palettes').levels;
        this.defaultPalette = this.paletteData[0];
        this.centipedeHeadTextureKey = 'centipede-head-sprites';
        this.centipedeSegmentTextureKey = 'centipede-segment-sprites';

        // Player
        this.player = this.add.sprite(320, 760, 'player-sprite');
        this.player.setScale(3);
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);
        this.createHud();

        // Groups
        this.bullets = this.physics.add.group();
        this.mushrooms = this.physics.add.staticGroup();
        this.segments = this.physics.add.group();
        this.enemyGroup = this.physics.add.group();
        this.enemies = [];
        this.applyLevelPalette();
        this.enemyCooldowns = {
            scorpion: this.getEnemySpawnDelay('scorpion'),
            spider: this.getEnemySpawnDelay('spider'),
            flea: 0
        };

        // Mushrooms
        const maxSpawnRow = ROWS - 8;
        const minVerticalGap = TILE * 2;
        const initialCentipedeY = PLAYFIELD_TOP + TILE / 2;
        const initialCentipedeXMax = (Math.min(10 + this.level, 20) - 1) * CENTIPEDE_SEGMENT_SPACING + TILE;
        let mushroomCount = 0;

        while (mushroomCount < 35) {
            const x = Phaser.Math.Between(0, COLS - 1) * TILE + TILE / 2;
            const y = PLAYFIELD_TOP + Phaser.Math.Between(0, maxSpawnRow - 1) * TILE + TILE / 2;
            const tooCloseVertically = this.mushrooms.getChildren().some(m =>
                Math.abs(m.x - x) < TILE * 0.75 && Math.abs(m.y - y) < minVerticalGap
            );
            const overlapsCentipedeStart = x <= initialCentipedeXMax && Math.abs(y - initialCentipedeY) < TILE;

            if (tooCloseVertically || overlapsCentipedeStart) continue;

            this.createMushroom(x, y);
            mushroomCount++;
        }

        // Centipede
        this.dir = 1;
        this.speed = 40 + this.level * 10;
        this.isDescending = false;
        this.bodySegments = [];
        this.bugs = [];
        this.head = null;
        const segmentCount = Math.min(10 + this.level, 20);
        this.createCentipedeBug(segmentCount);

        // Collisions
        this.physics.add.overlap(this.bullets, this.segments, this.hitSegment, null, this);
        this.physics.add.overlap(this.bullets, this.mushrooms, this.hitMushroom, null, this);
        this.physics.add.overlap(this.bullets, this.enemyGroup, this.hitEnemy, null, this);
    }

    createEnemy(x, y, color, type) {
        let enemy;
        let key = null;
        let animKey = null;

        switch (type) {
            case 'scorpion':
                key = 'scorpion-sprites';
                animKey = 'scorpion-move';
                break;
            case 'spider':
                key = 'spider-sprites';
                animKey = 'spider-move';
                break;
            case 'flea':
                key = 'flea-sprites';
                animKey = 'flea-move';
                break;
            case 'grasshopper':
                key = 'grasshopper-sprites';
                animKey = 'grasshopper-move';
                break;
            default:
                enemy = this.add.rectangle(x, y, 18, 12, color);
                this.physics.add.existing(enemy);
                enemy.body.setAllowGravity(false);
                enemy.body.setImmovable(true);
                enemy.setData('type', type);
                this.enemyGroup.add(enemy);
                this.enemies.push(enemy);
                return enemy;
        }

        enemy = this.add.sprite(x, y, key);
        enemy.setScale(3);
        enemy.play(animKey, true);
        this.physics.add.existing(enemy);
        enemy.body.setAllowGravity(false);
        enemy.body.setImmovable(true);
        enemy.body.setSize(18, 12);
        enemy.setData('type', type);
        this.enemyGroup.add(enemy);
        this.enemies.push(enemy);
        return enemy;
    }

    poisonMushroom(mushroom) {
        if (!mushroom || mushroom.isPoisoned) return;
        mushroom.isPoisoned = true;
        mushroom.setTint(0xff4d4d);
    }

    spawnScorpion() {
        const x = 24;
        const y = 160 + Phaser.Math.Between(0, 4) * 32;
        const scorpion = this.createEnemy(x, y, 0xff8c42, 'scorpion');
        scorpion.setData('dir', 1);
        scorpion.body.setVelocityX(90);
        return scorpion;
    }

    getEnemySpawnDelay(type) {
        const level = Math.max(1, this.level || 1);

        switch (type) {
            case 'scorpion':
                return Math.max(8000, 20000 - (level - 1) * 1800);
            case 'spider':
                return Math.max(12000, 26000 - (level - 1) * 2200);
            default:
                return 5000;
        }
    }

    spawnSpider() {
        const spider = this.createEnemy(
            Phaser.Math.Between(80, this.scale.width - 80),
            this.scale.height * 0.88,
            0x88ccff,
            'spider'
        );
        spider.setData('dir', Phaser.Math.Between(0, 1) === 0 ? -1 : 1);
        spider.setData('phase', Phaser.Math.FloatBetween(0, Math.PI * 2));
        spider.body.setVelocity(0, 0);
        return spider;
    }

    spawnFlea() {
        const flea = this.createEnemy(
            Phaser.Math.Between(40, this.scale.width - 40),
            PLAYFIELD_TOP + 16,
            0xc084fc,
            'flea'
        );
        flea.setData('dropSpeed', 120);
        flea.setData('dropRow', Phaser.Math.Between(0, ROWS - 1));
        flea.body.setVelocityY(120);
        return flea;
    }

    updateEnemyBehaviors(delta) {
        this.enemies = this.enemies.filter(enemy => enemy && enemy.active);

        for (const enemy of this.enemies) {
            const type = enemy.getData('type');

            if (type === 'scorpion') {
                const direction = enemy.getData('dir');
                enemy.x += direction * 90 * (delta / 1000);
                enemy.body.setVelocityX(direction * 90);
                if (enemy.x < 20 || enemy.x > this.scale.width - 20) {
                    enemy.setData('dir', direction * -1);
                }
                this.mushrooms.getChildren().forEach(mushroom => {
                    if (!mushroom.isPoisoned && Phaser.Math.Distance.Between(enemy.x, enemy.y, mushroom.x, mushroom.y) < 18) {
                        this.poisonMushroom(mushroom);
                    }
                });
            }

            if (type === 'spider') {
                const dir = enemy.getData('dir');
                const phase = enemy.getData('phase') + delta / 200;
                enemy.setData('phase', phase);

                const minX = 30;
                const maxX = this.scale.width - 30;
                const nextX = enemy.x + dir * 140 * (delta / 1000);

                if (nextX < minX) {
                    enemy.x = minX;
                    enemy.setData('dir', 1);
                } else if (nextX > maxX) {
                    enemy.x = maxX;
                    enemy.setData('dir', -1);
                } else {
                    enemy.x = nextX;
                }

                enemy.y = this.scale.height * 0.88 + Math.sin(phase) * 24;
                this.mushrooms.getChildren().forEach(mushroom => {
                    if (Phaser.Math.Distance.Between(enemy.x, enemy.y, mushroom.x, mushroom.y) < 18) {
                        mushroom.destroy();
                    }
                });
            }

            if (type === 'flea') {
                enemy.y += enemy.getData('dropSpeed') * (delta / 1000);
                enemy.body.setVelocityY(enemy.getData('dropSpeed'));
                if (enemy.y > this.scale.height - 20) {
                    const row = Phaser.Math.Between(0, ROWS - 1);
                    const x = Math.round(enemy.x / TILE) * TILE + TILE / 2;
                    const y = PLAYFIELD_TOP + (row * TILE) + TILE / 2;
                    this.createMushroom(x, y);
                    enemy.destroy();
                }
            }
        }

        if (this.mushrooms.countActive(true) < 8 && this.enemyCooldowns.flea <= 0) {
            this.spawnFlea();
            this.enemyCooldowns.flea = 7000;
        }

        Object.keys(this.enemyCooldowns).forEach(key => {
            this.enemyCooldowns[key] = Math.max(0, this.enemyCooldowns[key] - delta);
        });

        if (this.enemyCooldowns.scorpion <= 0) {
            this.spawnScorpion();
            this.enemyCooldowns.scorpion = this.getEnemySpawnDelay('scorpion');
        }
        const activeSpider = this.enemies.some(enemy => enemy && enemy.getData('type') === 'spider');
        if (!activeSpider && this.enemyCooldowns.spider <= 0) {
            this.spawnSpider();
            this.enemyCooldowns.spider = this.getEnemySpawnDelay('spider');
        }
    }

    createCentipedeBug(segmentCount, startY = PLAYFIELD_TOP + TILE / 2, startX = null) {
        const bug = {
            segments: [],
            head: null,
            dir: this.dir,
            speed: this.speed,
            isDescending: false,
            headTrail: [],
            descentTargetY: 0,
            isPoisoned: false
        };

        for (let i = 0; i < segmentCount; i++) {
            const frame = i === 0 ? 0 : 1;
            const x = startX ?? (CENTIPEDE_SEGMENT_SPACING * (segmentCount - i));
            const spriteKey = i === 0 ? this.centipedeHeadTextureKey : this.centipedeSegmentTextureKey;
            const s = this.add.sprite(
                x,
                startY,
                spriteKey,
                frame
            );
            s.setScale(3);
            s.setFlipX(bug.dir === 1);
            s.setData('isHead', i === 0);
            s.setData('bug', bug);
            this.playCentipedeAnimation(s, 'horizontal');
            this.physics.add.existing(s);
            this.segments.add(s);
            bug.segments.push(s);
            if (i === 0) {
                bug.head = s;
                this.head = s;
            } else {
                this.bodySegments.push(s);
            }
        }

        bug.head.body.setVelocityX(this.speed * bug.dir);
        bug.headTrail = [
            { x: bug.head.x, y: bug.head.y },
            ...bug.segments.slice(1).map(segment => ({ x: segment.x, y: segment.y }))
        ];
        this.bugs.push(bug);
        return bug;
    }

    handleCentipedeCollision(bug = this.bugs[0]) {
        if (!bug) return;

        bug.dir *= -1;
        bug.head.body.setVelocityX(bug.speed * bug.dir);
        bug.segments.forEach(s => {
            s.setFlipX(bug.dir === 1);
            s.body.setVelocityX(bug.speed * bug.dir);
        });
        this.turnDown(bug);
    }

    triggerLevelComplete() {
        if (this.levelTransitioning) return;

        this.levelTransitioning = true;
        this.levelCompleteText = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2,
            'LEVEL COMPLETE',
            {
                fontFamily: 'monospace',
                fontSize: '36px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 8
            }
        ).setOrigin(0.5).setDepth(20);

        this.time.delayedCall(1500, () => {
            this.scene.restart({ level: this.level + 1 });
        });
    }

    update(time, delta) {
        if (this.levelTransitioning) return;
        if (this.segments.countActive(true) === 0) {
            this.triggerLevelComplete();
            return;
        }

        // Player movement
        this.player.body.setVelocityX(0);
        this.player.body.setVelocityY(0);
        if (this.cursors.left.isDown) this.player.body.setVelocityX(-200);
        if (this.cursors.right.isDown) this.player.body.setVelocityX(200);
        if (this.cursors.up.isDown && this.player.y > this.scale.height * PLAYER_TOP_BOUNDARY) {
            this.player.body.setVelocityY(-200);
        }
        if (this.cursors.down.isDown) this.player.body.setVelocityY(200);

        // Fire
        if (this.fireKey.isDown && time >= this.nextFireTime) {
            const bullet = this.bullets.create(
                this.player.x,
                this.player.y - 16,
                'bullet-sprite'
            );
            bullet.body.setVelocity(0, -400);
            this.nextFireTime = time + FIRE_RATE;
        }

        // Cleanup bullets
        this.bullets.getChildren().forEach(b => {
            if (b.y < 0) b.destroy();
        });

        // this.bullets.getChildren().forEach(bullet => {
        //     if (!bullet || !bullet.active) return;

        //     const hitMushroom = this.mushrooms.getChildren().find(mushroom =>
        //         mushroom && mushroom.active && Phaser.Math.Distance.Between(bullet.x, bullet.y, mushroom.x, mushroom.y) < 16
        //     );
        //     if (hitMushroom) {
        //         this.hitMushroom(bullet, hitMushroom);
        //         return;
        //     }

        //     const hitEnemy = this.enemyGroup.getChildren().find(enemy =>
        //         enemy && enemy.active && Phaser.Math.Distance.Between(bullet.x, bullet.y, enemy.x, enemy.y) < 18
        //     );
        //     if (hitEnemy) {
        //         this.hitEnemy(bullet, hitEnemy);
        //     }
        // });

        this.bugs = this.bugs.filter(bug => bug && bug.head && bug.head.active && bug.segments.length > 0);
        this.playerZoneSpawnTimer = Math.max(0, this.playerZoneSpawnTimer - delta);

        this.bugs.forEach(bug => {
            if (!bug || !bug.head || !bug.head.body) {
                this.bugs = this.bugs.filter(current => current !== bug);
                return;
            }

            const poisonedHit = this.mushrooms.getChildren().some(mushroom =>
                mushroom.isPoisoned && Phaser.Math.Distance.Between(bug.head.x, bug.head.y, mushroom.x, mushroom.y) < 20
            );

            if (bug.isPoisoned) {
                if (bug.head && bug.head.body) {
                    bug.head.body.setVelocityY(160);
                }
                bug.segments.filter(s => s && s.body).forEach(s => s.body.setVelocityY(160));
                if (bug.head && bug.head.y >= this.scale.height - 40) {
                    bug.isPoisoned = false;
                    bug.dir *= -1;
                    if (bug.head.body) {
                        bug.head.body.setVelocity(0, 0);
                        bug.head.body.setVelocityX(bug.speed * bug.dir);
                    }
                    bug.segments.filter(s => s && s.body).forEach(s => {
                        s.body.setVelocity(0, 0);
                        s.body.setVelocityX(bug.speed * bug.dir);
                    });
                }
                return;
            }

            if (poisonedHit) {
                bug.isPoisoned = true;
                bug.dir = 0;
                bug.head.body.setVelocityX(0);
                bug.segments.forEach(s => s.body.setVelocityX(0));
                return;
            }

            if (bug.isDescending) {
                this.finishDescent(bug);
            } else if (bug.head.x <= 16 || bug.head.x >= this.scale.width - 16) {
                this.handleCentipedeCollision(bug);
            } else if (bug.head.y >= this.scale.height * 0.8) {
                bug.dir *= -1;
                bug.head.body.setVelocityX(bug.speed * bug.dir);
                bug.segments.forEach(s => {
                    s.setFlipX(bug.dir === 1);
                    s.body.setVelocityX(bug.speed * bug.dir);
                });
                if (this.playerZoneSpawnTimer <= 0) {
                    this.playerZoneSpawnTimer = 1500;
                    this.spawnHeadCentipede();
                }
            }
        });

        this.updateEnemyBehaviors(delta);
        this.updateCentipedeSegments();
    }

    spawnHeadCentipede() {
        const x = Phaser.Math.Between(32, this.scale.width - 32);
        const y = this.scale.height * 0.85 + Phaser.Math.Between(-8, 8);
        const bug = this.createCentipedeBug(1, y, x);
        bug.dir = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
        bug.head.body.setVelocityX(bug.speed * bug.dir);
        bug.head.setFlipX(bug.dir === 1);
    }

    turnDown(bug = this.bugs[0]) {
        if (!bug || bug.isDescending) return;

        bug.isDescending = true;
        bug.descentTargetY = bug.head.y + CENTIPEDE_DESCENT_DISTANCE;
        bug.segments.forEach(s => {
            s.body.setVelocity(0, s === bug.head ? CENTIPEDE_DESCENT_SPEED : 0);
            this.playCentipedeAnimation(s, 'down');
        });
    }

    finishDescent(bug = this.bugs[0]) {
        if (!bug || bug.head.y < bug.descentTargetY) return;

        bug.isDescending = false;
        bug.head.body.reset(bug.head.x, bug.descentTargetY);
        bug.head.body.setVelocityX(bug.speed * bug.dir);
        bug.segments.forEach(s => {
            s.setFlipX(bug.dir === 1);
            s.body.setVelocityX(bug.speed * bug.dir);
            this.playCentipedeAnimation(s, 'horizontal');
        });
    }

    updateCentipedeSegments() {
        this.bugs.forEach(bug => {
            if (!bug.head || !bug.segments.length) return;

            bug.headTrail.unshift({ x: bug.head.x, y: bug.head.y });

            const maxTrailLength = (bug.segments.length + 2) * CENTIPEDE_SEGMENT_SPACING;
            let trailLength = 0;
            for (let index = 1; index < bug.headTrail.length; index++) {
                trailLength += Phaser.Math.Distance.BetweenPoints(
                    bug.headTrail[index - 1],
                    bug.headTrail[index]
                );
            }
            while (trailLength > maxTrailLength && bug.headTrail.length > 2) {
                const last = bug.headTrail.pop();
                trailLength -= Phaser.Math.Distance.BetweenPoints(
                    bug.headTrail[bug.headTrail.length - 1],
                    last
                );
            }

            bug.segments.forEach((segment, index) => {
                if (index === 0) return;
                const position = this.getTrailPosition((index) * CENTIPEDE_SEGMENT_SPACING, bug.headTrail);
                segment.setPosition(position.x, position.y);
                segment.body.reset(segment.x, segment.y);
            });
        });
    }

    getTrailPosition(targetDistance, trail = this.headTrail) {
        let distanceTravelled = 0;

        for (let index = 1; index < trail.length; index++) {
            const from = trail[index - 1];
            const to = trail[index];
            const segmentDistance = Phaser.Math.Distance.BetweenPoints(from, to);

            if (distanceTravelled + segmentDistance >= targetDistance) {
                const progress = (targetDistance - distanceTravelled) / segmentDistance;
                return {
                    x: Phaser.Math.Linear(from.x, to.x, progress),
                    y: Phaser.Math.Linear(from.y, to.y, progress)
                };
            }

            distanceTravelled += segmentDistance;
        }

        return trail[trail.length - 1];
    }

    createCentipedeAnimations() {

        const animationDefs = [
            { key: 'centipede-head-horizontal', texture: this.centipedeHeadTextureKey, start: 0, end: 1 },
            { key: 'centipede-segment-horizontal', texture: this.centipedeSegmentTextureKey, start: 0, end: 1 },
            { key: 'centipede-head-down', texture: this.centipedeHeadTextureKey, start: 0, end: 1 },
            { key: 'centipede-segment-down', texture: this.centipedeSegmentTextureKey, start: 0, end: 1 },
            { key: 'scorpion-move', texture: 'scorpion-sprites', start: 0, end: 3 },
            { key: 'spider-move', texture: 'spider-sprites', start: 0, end: 7 },
            { key: 'flea-move', texture: 'flea-sprites', start: 0, end: 1 },
            { key: 'grasshopper-move', texture: 'grasshopper-sprites', start: 0, end: 3 }
        ];

        animationDefs.forEach(({ key, texture, start, end }) => {
            if (this.anims.exists(key)) {
                this.anims.remove(key);
            }
            if (!this.textures.exists(texture)) return;

            this.anims.create({
                key,
                frames: this.anims.generateFrameNumbers(texture, { start, end }),
                frameRate: key.includes('spider') || key.includes('scorpion') || key.includes('grasshopper') ? 10 : 8,
                repeat: -1
            });
        });
    }

    playCentipedeAnimation(sprite, direction) {
        const part = sprite.getData('isHead') ? 'head' : 'segment';
        sprite.play(`centipede-${part}-${direction}`, true);
    }

    swapSpritesheetColors(scene, sourceKey, newKey, colorMap) {
        if (scene.textures.exists(newKey)) {
            return scene.textures.get(newKey);
        }

        const texture = scene.textures.get(sourceKey);
        if (!texture) return null;

        const sourceImage = texture.getSourceImage();
        if (!sourceImage) return null;

        const canvasTexture = scene.textures.createCanvas(newKey, sourceImage.width, sourceImage.height);
        canvasTexture.context.drawImage(sourceImage, 0, 0);

        const imageData = canvasTexture.context.getImageData(0, 0, sourceImage.width, sourceImage.height);
        const data = imageData.data;

        const palette = Array.isArray(colorMap) && colorMap.length
            ? colorMap
            : this.defaultPalette;

        const replacements = this.defaultPalette.map((oldColor, index) => ({
            old: oldColor,
            new: Array.isArray(palette[index]) ? palette[index] : oldColor
        }));

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue;

            for (const map of replacements) {
                const [oldR, oldG, oldB] = map.old;
                if (r === oldR && g === oldG && b === oldB) {
                    data[i] = map.new[0];
                    data[i + 1] = map.new[1];
                    data[i + 2] = map.new[2];
                    break;
                }
            }
        }

        canvasTexture.context.putImageData(imageData, 0, 0);
        canvasTexture.update();

        Object.keys(texture.frames).forEach(frameName => {
            if (frameName === '__BASE') return;
            const origFrame = texture.frames[frameName];
            canvasTexture.add(
                frameName,
                0,
                origFrame.cutX,
                origFrame.cutY,
                origFrame.cutWidth,
                origFrame.cutHeight
            );
        });

        return canvasTexture;
    }

    applyLevelPalette() {
        const levelPalette = this.paletteData[this.level - 1];
        this.centipedeHeadTextureKey = `centipede-head-palette-${levelPalette.flat().join('-')}`;
        this.centipedeSegmentTextureKey = `centipede-segment-palette-${levelPalette.flat().join('-')}`;

        this.swapSpritesheetColors(this, 'centipede-head-sprites', this.centipedeHeadTextureKey, levelPalette);
        this.swapSpritesheetColors(this, 'centipede-segment-sprites', this.centipedeSegmentTextureKey, levelPalette);
        this.createCentipedeAnimations();

        if (!this.mushrooms || !this.mushrooms.getChildren) return;

        const paletteKey = `mushroom-palette-${levelPalette.flat().join('-')}`;
        this.swapSpritesheetColors(this, 'mushroom-sprites', paletteKey, levelPalette);
    }

    createMushroom(x, y) {
        const levelPalette = this.paletteData[this.level - 1];

        const paletteKey = `mushroom-palette-${levelPalette.flat().join('-')}`;
        this.swapSpritesheetColors(this, 'mushroom-sprites', paletteKey, levelPalette);

        const mushroom = this.add.sprite(
            x,
            y,
            paletteKey,
            0
        );
        mushroom.hitCount = 0;
        mushroom.setScale(3);
        this.physics.add.existing(mushroom, true);
        this.mushrooms.add(mushroom);
    }

    createHud() {
        const textStyle = {
            fontFamily: 'monospace',
            fontSize: '24px',
            color: '#ffffff'
        };

        this.highScoreText = this.add.text(12, 10, 'HIGH SCORE: 000000', textStyle).setDepth(10);
        this.scoreText = this.add.text(this.scale.width / 2, 10, '000000', textStyle)
            .setOrigin(0.5, 0)
            .setDepth(10);

        this.add.text(390, 10, 'LIVES', textStyle).setDepth(10);
        for (let i = 0; i < this.lives; i++) {
            this.add.image(488 + i * 40, 26, 'player-sprite')
                .setScale(3)
                .setDepth(10);
        }
    }

    updateHud() {
        this.highScore = Math.max(this.highScore, this.score);
        this.highScoreText.setText(`HIGH SCORE: ${String(this.highScore).padStart(6, '0')}`);
        this.scoreText.setText(String(this.score).padStart(6, '0'));
    }

    hitMushroom(bullet, mushroom) {
        if (!mushroom) return;
        mushroom.hitCount++;
        bullet.destroy();
        mushroom.setFrame(mushroom.hitCount);
        if (mushroom.hitCount >= 3) {
            mushroom.destroy();
        }
    }
    hitEnemy(bullet, enemy) {
        if (!enemy || typeof enemy.getData !== 'function') return;
        const type = enemy.getData('type');
        if (type !== 'spider' && type !== 'scorpion' && type !== 'flea' && type !== 'grasshopper') return;

        bullet.destroy();
        enemy.destroy();
        this.enemies = this.enemies.filter(current => current !== enemy);
        this.score += 300;
        this.updateHud();
    }

    hitSegment(bullet, segment) {
        bullet.destroy();

        if (!segment || typeof segment.getData !== 'function') {
            return;
        }

        const bug = segment.getData('bug');

        if (!bug) {
            segment.destroy();
            return;
        }

        if (segment === bug.head) {
            const remainingSegments = bug.segments.filter(s => s && s !== segment);
            segment.destroy();

            if (remainingSegments.length > 0) {
                const newHead = remainingSegments[0];
                if (!newHead || !newHead.body) {
                    this.bugs = this.bugs.filter(currentBug => currentBug !== bug);
                    this.score += 100;
                    this.updateHud();
                    return;
                }

                bug.segments = remainingSegments;
                bug.head = newHead;
                bug.head.setData('isHead', true);
                bug.head.body.setVelocityX(bug.speed * bug.dir);
                this.head = newHead;
                this.playCentipedeAnimation(newHead, 'horizontal');
                bug.headTrail = [
                    { x: newHead.x, y: newHead.y },
                    ...remainingSegments.slice(1).map(s => ({ x: s.x, y: s.y }))
                ];
                remainingSegments.forEach(s => s.setData('bug', bug));
            } else {
                bug.segments = [];
                this.bugs = this.bugs.filter(currentBug => currentBug !== bug);
            }

            this.score += 100;
            this.updateHud();
            return;
        }

        const segmentIndex = bug.segments.indexOf(segment);
        if (segmentIndex < 0) {
            segment.destroy();
            return;
        }

        const frontSegments = bug.segments.slice(0, segmentIndex);
        const backSegments = bug.segments.slice(segmentIndex + 1);
        segment.destroy();

        if (frontSegments.length > 0) {
            bug.segments = frontSegments;
            const newFrontHead = frontSegments[0];
            if (!newFrontHead || !newFrontHead.body) {
                this.bugs = this.bugs.filter(currentBug => currentBug !== bug);
            } else {
                bug.head = newFrontHead;
                bug.head.setData('isHead', true);
                bug.headTrail = [
                    { x: bug.head.x, y: bug.head.y },
                    ...frontSegments.slice(1).map(s => ({ x: s.x, y: s.y }))
                ];
                frontSegments.forEach(s => s.setData('bug', bug));
                frontSegments.slice(1).forEach(s => s.setData('isHead', false));
            }
        } else {
            bug.segments = [];
            this.bugs = this.bugs.filter(currentBug => currentBug !== bug);
        }

        if (backSegments.length > 0) {
            const newBug = {
                segments: backSegments,
                head: backSegments[0],
                dir: bug.dir,
                speed: bug.speed,
                isDescending: false,
                headTrail: [],
                descentTargetY: 0,
                isPoisoned: false
            };
            newBug.head.setData('isHead', true);
            backSegments.forEach(s => s.setData('bug', newBug));
            backSegments.slice(1).forEach(s => s.setData('isHead', false));
            newBug.headTrail = [
                { x: newBug.head.x, y: newBug.head.y },
                ...backSegments.slice(1).map(s => ({ x: s.x, y: s.y }))
            ];
            this.bugs.push(newBug);
        }

        this.score += 100;
        this.updateHud();

        this.createMushroom(
            Math.floor(segment.x / TILE) * TILE + TILE / 2,
            Math.floor(segment.y / TILE) * TILE + TILE / 2
        );
    }
}
