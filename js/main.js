
import { SplashScene } from './SplashScene.js';
import { CentipedeScene } from './CentipedeScene.js';

new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 640,
    height: 800,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    backgroundColor: '#000000',
    scene: [SplashScene, CentipedeScene]
});
