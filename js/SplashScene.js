export class SplashScene extends Phaser.Scene {
    constructor() {
        super('Splash');
    }

    preload() {
        this.load.spritesheet('splash-image', 'assets/images/splash_image.png', {
            frameWidth: 492,
            frameHeight: 352,
            endFrame: 49
        });
    }

    create() {
        this.anims.create({
            key: 'splash-anim',
            frames: this.anims.generateFrameNumbers('splash-image', { start: 0, end: 49 }),
            frameRate: 10,
            repeat: -1
        });

        const { width, height } = this.scale;
        const splashY = height * 0.28;
        const splash = this.add.sprite(width / 2, splashY, 'splash-image');

        const scale = Math.min(width / 492, (height * 0.56) / 352) * 0.92;
        splash.setScale(scale);
        splash.setOrigin(0.5);
        splash.play('splash-anim');

        this.add.text(width / 2, height - 80, 'PRESS ANY KEY', {
            fontFamily: 'monospace',
            fontSize: '22px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.input.keyboard.once('keydown', () => this.startGame());
        this.input.once('pointerdown', () => this.startGame());
    }

    startGame() {
        this.scene.start('Centipede');
    }
}
