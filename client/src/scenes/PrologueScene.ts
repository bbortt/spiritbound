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

export class PrologueScene extends Phaser.Scene {
  private onDone!: () => void;
  private index = 0;
  private advanceTimer?: Phaser.Time.TimerEvent;
  private plane!: Phaser.GameObjects.Container;
  private verse!: Phaser.GameObjects.Text;
  private titleCard!: Phaser.GameObjects.Text;
  private finished = false;
  /** The plate currently on the plane, so a held image is not redrawn. */
  private plate: string | null = null;

  constructor() {
    super({ key: 'Prologue' });
  }

  preload() {
    // A Set, because consecutive beats can share a plate.
    for (const id of new Set(PROLOGUE_BEATS.map((b) => b.plate)))
      if (id) this.load.image(`plate:${id}`, `prologue/${id}.png`);
  }

  create(data: PrologueSceneData) {
    this.onDone = data.onDone;
    // Phaser reuses the instance, so the field initialisers only hold for the
    // first launch.
    this.index = 0;
    this.finished = false;
    this.plate = null;

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
    // Registering the Key is what makes the plugin drop browser auto-repeat for
    // the handler below (KeyboardPlugin.js:797 only computes `repeat` when a Key
    // exists); without it a held SPACE walks all 30 beats in about a second and
    // burns the once-per-account flag.
    this.input.keyboard?.addKey('SPACE');
    this.input.keyboard?.on('keydown-SPACE', () => this._advance());
    // `over` holds the interactive objects under the pointer. The Skip label's
    // own handler runs first, but this one still runs after it, so without the
    // guard a Skip click would also advance a beat on its way out.
    this.input.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, over: unknown[]) => {
        if (over.length === 0) this._advance();
      },
    );

    this._show(PROLOGUE_BEATS[0]);
  }

  /**
   * Click, key and the hold timer all land here. `remove()` cannot un-deliver a
   * dispatch already in flight, so a click in the same frame as the timer can
   * still cost one stanza — cheap next to a double-advance on every click.
   */
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

    // Without this the previous beat's tweens keep writing over the reset
    // below, and a clicked-through recitation accumulates one per beat.
    this.tweens.killTweensOf([this.verse, this.titleCard]);

    // Consecutive beats can name the same plate (two stanzas on one image):
    // hold the image and let its push-in run on, rather than cutting
    // to black and snapping the scale back between them.
    const newPlate = beat.plate !== this.plate;
    this.plate = beat.plate;
    if (newPlate) {
      this.tweens.killTweensOf(this.plane);
      this.plane.removeAll(true);
      this.plane.setScale(1).setAlpha(0);
      if (beat.plate) this._drawPlate(beat.plate);
    }

    this.verse
      .setText(beat.lines.join('\n'))
      .setColor(VOICE_COLOR[beat.voice])
      .setWordWrapWidth(W - 160)
      .setAlpha(0);

    this.titleCard.setVisible(beat.titleCard === true).setAlpha(0);

    this.tweens.add({
      targets: newPlate
        ? [this.plane, this.verse, this.titleCard]
        : [this.verse, this.titleCard],
      alpha: 1,
      duration: 900,
    });

    // The only use the single-plane art has for the parallax data: a slow push
    // in, scaled by the near plane. X.2's zeroes hold it perfectly still.
    if (newPlate) {
      this.tweens.add({
        targets: this.plane,
        scale: 1 + beat.parallax[2] * 0.06,
        duration: beat.holdMs,
        ease: 'Sine.easeInOut',
      });
    }

    this.advanceTimer = this.time.delayedCall(beat.holdMs, () =>
      this._advance(),
    );
  }

  private _drawPlate(plate: string) {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const img = this.add.image(0, 0, `plate:${plate}`);
    // Cover the screen; the push-in tween scales the plane past it anyway.
    img.setScale(Math.max(W / img.width, H / img.height));
    this.plane.add(img);
  }

  private _finish() {
    if (this.finished) return;
    this.finished = true;
    this.advanceTimer?.remove();
    this.onDone();
    this.scene.stop();
  }
}
