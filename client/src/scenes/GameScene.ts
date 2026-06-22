import Phaser from 'phaser';
import type { Identity } from 'spacetimedb';
import { connect, callReducer, type DbConnection } from '../db';
import type { Character, PersonalSpirit } from '../db';

const WORLD_W = 3000;
const WORLD_H = 3000;
const PLAYER_R = 20;
const OTHER_R = 18;

// Mirrors server rules: startingHp / startingMp in spacetimedb/src/index.ts
const maxHp = (level: number) => 100 + level * 15;
const maxMp = (level: number) => 50 + level * 8;

export class GameScene extends Phaser.Scene {
  private conn!: DbConnection;
  private localCharacter: Character | null = null;
  private localSpirit: PersonalSpirit | null = null;
  private otherCircles = new Map<bigint, Phaser.GameObjects.Graphics>();

  // Client-side interpolation target (optimistic move; server corrects on update)
  private targetX = 0;
  private targetY = 0;

  private playerCircle!: Phaser.GameObjects.Graphics;

  // HUD — all fixed to screen via setScrollFactor(0)
  private hudBars!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private spiritLevelText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // ── World ──────────────────────────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    const bg = this.add.graphics();
    bg.fillStyle(0x12121e, 1);
    bg.fillRect(0, 0, WORLD_W, WORLD_H);

    // ── Local player circle ───────────────────────────────────────────────────
    this.playerCircle = this.add.graphics();
    this.playerCircle.fillStyle(0x4fc3f7, 1);
    this.playerCircle.fillCircle(0, 0, PLAYER_R);
    this.playerCircle.setDepth(1);
    this.cameras.main.startFollow(this.playerCircle);

    // ── HUD ───────────────────────────────────────────────────────────────────
    this._createHud();

    // ── Input ─────────────────────────────────────────────────────────────────
    this._setupInput();

    // ── SpacetimeDB ───────────────────────────────────────────────────────────
    this.conn = connect(this._tokenStore(), (conn) => {
      if (!this.localCharacter) {
        callReducer('startLife', () =>
          conn.reducers.startLife({ spiritName: 'Aelith', startZoneId: 1 }),
        );
      }
    });

    this.conn.db.character.onInsert((_ctx, row) => this._onCharInsert(row));
    this.conn.db.character.onUpdate?.((_ctx, _old, row) => this._onCharUpdate(row));
    this.conn.db.character.onDelete((_ctx, row) => this._onCharDelete(row));
    this.conn.db.personalSpirit.onInsert((_ctx, row) => this._onSpiritRow(row));
    this.conn.db.personalSpirit.onUpdate?.((_ctx, _old, row) => this._onSpiritRow(row));
  }

  update() {
    if (!this.localCharacter) return;
    this.playerCircle.x += (this.targetX - this.playerCircle.x) * 0.15;
    this.playerCircle.y += (this.targetY - this.playerCircle.y) * 0.15;
  }

  // ── Identity ─────────────────────────────────────────────────────────────────

  private _isLocal(id: Identity): boolean {
    return !!this.conn.identity?.isEqual(id);
  }

  // ── Character table callbacks ─────────────────────────────────────────────────

  private _onCharInsert(row: Character) {
    if (!row.alive) return;
    if (this._isLocal(row.accountIdentity)) {
      this.localCharacter = row;
      this.targetX = row.posX;
      this.targetY = row.posY;
      this.playerCircle.setPosition(row.posX, row.posY);
      this._updateHud();
    } else if (row.zoneId === (this.localCharacter?.zoneId ?? 1)) {
      this._addOtherPlayer(row);
    }
  }

  private _onCharUpdate(row: Character) {
    if (this._isLocal(row.accountIdentity)) {
      this.localCharacter = row;
      this.targetX = row.posX;
      this.targetY = row.posY;
      this._updateHud();
    } else {
      this.otherCircles.get(row.characterId)?.setPosition(row.posX, row.posY);
    }
  }

  private _onCharDelete(row: Character) {
    if (this._isLocal(row.accountIdentity)) {
      this.localCharacter = null;
      this._updateHud();
    } else {
      const g = this.otherCircles.get(row.characterId);
      if (g) {
        g.destroy();
        this.otherCircles.delete(row.characterId);
      }
    }
  }

  private _addOtherPlayer(row: Character) {
    if (this.otherCircles.has(row.characterId)) return;
    const g = this.add.graphics();
    g.fillStyle(0x888888, 1);
    g.fillCircle(0, 0, OTHER_R);
    g.setPosition(row.posX, row.posY);
    g.setDepth(1);
    this.otherCircles.set(row.characterId, g);
  }

  // ── Spirit table callbacks ─────────────────────────────────────────────────────

  private _onSpiritRow(row: PersonalSpirit) {
    if (!this._isLocal(row.accountIdentity)) return;
    this.localSpirit = row;
    this.spiritLevelText.setText(`Spirit Lv ${row.level}`);
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  private _setupInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return; // reserved: basic attack
      if (!this.localCharacter?.alive) return;

      this.targetX = pointer.worldX;
      this.targetY = pointer.worldY;

      callReducer('move', () =>
        this.conn.reducers.move({ x: pointer.worldX, y: pointer.worldY }),
      );
    });

    // Reserve keys 1–0 for active ability slots (no handlers yet)
    this.input.keyboard?.addKeys(
      'ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE,ZERO',
    );
  }

  // ── HUD creation ──────────────────────────────────────────────────────────────

  private _createHud() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.hudBars = this.add.graphics().setScrollFactor(0).setDepth(10);

    const mono: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '13px',
      color: '#ffffff',
      fontFamily: 'monospace',
    };

    this.hpText = this.add
      .text(16, 15, 'HP  ---', mono)
      .setScrollFactor(0)
      .setDepth(11);
    this.mpText = this.add
      .text(16, 41, 'MP  ---', mono)
      .setScrollFactor(0)
      .setDepth(11);

    this.levelText = this.add
      .text(W - 16, 16, 'Lv 1', { fontSize: '16px', color: '#ffffff', fontFamily: 'monospace' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(11);

    this.spiritLevelText = this.add
      .text(W - 16, 40, 'Spirit Lv 1', { fontSize: '14px', color: '#a0c4ff', fontFamily: 'monospace' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(11);

    this._drawCardSlots(W, H);
    this._updateHud();
  }

  private _drawCardSlots(camW: number, camH: number) {
    const SW = 52, SH = 72, GAP = 6;
    const activeCount = 10, passiveCount = 5;
    const activeW = activeCount * SW + (activeCount - 1) * GAP;
    const passiveW = passiveCount * SW + (passiveCount - 1) * GAP;
    const activeY = camH - SH - 12;
    const passiveY = activeY - SH - 8;

    const g = this.add.graphics().setScrollFactor(0).setDepth(10);
    g.lineStyle(2, 0xffffff, 0.35);

    const ax = (camW - activeW) / 2;
    for (let i = 0; i < activeCount; i++) {
      g.strokeRect(ax + i * (SW + GAP), activeY, SW, SH);
    }
    const px = (camW - passiveW) / 2;
    for (let i = 0; i < passiveCount; i++) {
      g.strokeRect(px + i * (SW + GAP), passiveY, SW, SH);
    }
  }

  // ── HUD update ────────────────────────────────────────────────────────────────

  private _updateHud() {
    const c = this.localCharacter;
    const BAR_W = 200, BAR_H = 18, X = 12;

    this.hudBars.clear();

    // Background tracks (always shown)
    this.hudBars.fillStyle(0x2a0000, 0.85).fillRect(X, 12, BAR_W, BAR_H);
    this.hudBars.fillStyle(0x001a3a, 0.85).fillRect(X, 38, BAR_W, BAR_H);

    if (c) {
      const hp = Math.max(0, c.currentHp);
      const mp = Math.max(0, c.currentMp);
      const mhp = maxHp(c.level);
      const mmp = maxMp(c.level);

      if (hp > 0)
        this.hudBars.fillStyle(0xef5350, 1).fillRect(X, 12, BAR_W * (hp / mhp), BAR_H);
      if (mp > 0)
        this.hudBars.fillStyle(0x42a5f5, 1).fillRect(X, 38, BAR_W * (mp / mmp), BAR_H);

      this.hpText.setText(`HP  ${hp} / ${mhp}`);
      this.mpText.setText(`MP  ${mp} / ${mmp}`);
      this.levelText.setText(`Lv ${c.level}`);
    } else {
      this.hpText.setText('HP  ---');
      this.mpText.setText('MP  ---');
    }

    if (this.localSpirit) {
      this.spiritLevelText.setText(`Spirit Lv ${this.localSpirit.level}`);
    }
  }

  // ── Token persistence ─────────────────────────────────────────────────────────

  private _tokenStore() {
    return {
      get: (): string | undefined => localStorage.getItem('sb_token') ?? undefined,
      set: (t: string): void => { localStorage.setItem('sb_token', t); },
    };
  }
}
