// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  // The tileset is 32 px pixel art scaled up in-world — keep it crisp.
  pixelArt: true,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  audio: { noAudio: true },
  scene: [GameScene],
});
