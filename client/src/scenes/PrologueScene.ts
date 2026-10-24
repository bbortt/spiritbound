// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import Phaser from 'phaser';
import { PROLOGUE_BEATS, type Beat } from '../prologueBeats';

export type PrologueSceneData = {
  /** Called exactly once, on the last beat or on a skip. */
  onDone: () => void;
};

const VOICE_COLOR: Record<Beat['voice'], string> = {
  spoken: '#e8e4d8',
  sung: '#ffd700',
  // The stanzas nobody sings, in somebody else's handwriting.
  'other-hand': '#9ab0c8',
};

/**
 * Placeholder plate art.
 *
 * shortcut: a flat colour derived from the plate id, until the generated
 * images from `docs/PROLOGUE_SHOTLIST.md` land; replace `_drawPlate` with an
 * image load keyed by the same id.
 */
function plateColor(plate: string): number {
  let h = 0;
  for (const ch of plate) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return Phaser.Display.Color.HSVToRGB((h % 360) / 360, 0.35, 0.3).color;
}

export class PrologueScene extends Phaser.Scene {
  private onDone!: () => void;
  private index = 0;
  private advanceTimer?: Phaser.Time.TimerEvent;
  private plane!: Phaser.GameObjects.Container;
  private verse!: Phaser.GameObjects.Text;
  private titleCard!: Phaser.GameObjects.Text;
  private finished = false;

  constructor() {
    super({ key: 'Prologue' });
  }

  create(data: PrologueSceneData) {
    this.onDone = data.onDone;

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setDepth(0);
    this.plane = this.add.container(W / 2, H / 2).setDepth(1);

    this.verse = this.add
      .text(W / 2, H - 150, '', {
        fontSize: '18px',
        color: VOICE_COLOR.spoken,
        fontFamily: 'monospace',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5, 1)
      .setDepth(3);

    this.titleCard = this.add
      .text(W / 2, H / 2, 'SPIRITBOUND', {
        fontSize: '64px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(4)
      .setVisible(false);

    this.add
      .text(W - 16, 16, 'Skip  [Esc]', {
        fontSize: '12px',
        color: '#8a8a8a',
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0)
      .setDepth(5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this._finish());

    this.input.keyboard?.on('keydown-ESC', () => this._finish());
    this.input.keyboard?.on('keydown-SPACE', () => this._advance());
    this.input.on('pointerdown', () => this._advance());

    this._show(PROLOGUE_BEATS[0]);
  }

  /** Click and the hold timer share this, so a click cannot double-advance. */
  private _advance() {
    if (this.finished) return;
    this.advanceTimer?.remove();
    this.index += 1;
    if (this.index >= PROLOGUE_BEATS.length) {
      this._finish();
      return;
    }
    this._show(PROLOGUE_BEATS[this.index]);
  }

  private _show(beat: Beat) {
    const W = this.cameras.main.width;

    this.plane.removeAll(true);
    this.plane.setScale(1).setAlpha(0);
    if (beat.plate) this._drawPlate(beat.plate);

    this.verse
      .setText(beat.lines.join('\n'))
      .setColor(VOICE_COLOR[beat.voice])
      .setWordWrapWidth(W - 160)
      .setAlpha(0);

    this.titleCard.setVisible(beat.titleCard === true).setAlpha(0);

    this.tweens.add({
      targets: [this.plane, this.verse, this.titleCard],
      alpha: 1,
      duration: 900,
    });

    // The only use the placeholder art has for the parallax data: a slow push
    // in, scaled by the near plane. X.2's zeroes hold it perfectly still.
    this.tweens.add({
      targets: this.plane,
      scale: 1 + beat.parallax[2] * 0.06,
      duration: beat.holdMs,
      ease: 'Sine.easeInOut',
    });

    this.advanceTimer = this.time.delayedCall(beat.holdMs, () =>
      this._advance(),
    );
  }

  private _drawPlate(plate: string) {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    this.plane.add(
      this.add.rectangle(0, 0, W, H * 0.62, plateColor(plate)).setOrigin(0.5),
    );
    this.plane.add(
      this.add
        .text(0, 0, plate, {
          fontSize: '28px',
          color: '#00000066',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5),
    );
  }

  private _finish() {
    if (this.finished) return;
    this.finished = true;
    this.advanceTimer?.remove();
    this.onDone();
    this.scene.stop();
  }
}
