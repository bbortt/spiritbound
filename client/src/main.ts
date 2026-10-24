// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { PrologueScene } from './scenes/PrologueScene';

new Phaser.Game({
  type: Phaser.AUTO,
  // The tileset is 32 px pixel art scaled up in-world — keep it crisp.
  pixelArt: true,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  audio: { noAudio: true },
  // GameScene first: it owns the connection, and launches Prologue on top.
  scene: [GameScene, PrologueScene],
});
