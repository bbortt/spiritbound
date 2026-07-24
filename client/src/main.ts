import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  audio: { noAudio: true },
  scene: [GameScene],
});
