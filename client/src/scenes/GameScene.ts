import Phaser from 'phaser';
import type { Identity } from 'spacetimedb';
import { connect, callReducer, type DbConnection } from '../db';
import type { Character, PersonalSpirit } from '../db';

const WORLD_W = 3000;
const WORLD_H = 3000;
const PLAYER_R = 20;
const OTHER_R = 18;
const ENEMY_R = 24;

// Mirrors server rules: startingHp / startingMp in spacetimedb/src/index.ts
const maxHp = (level: number) => 100 + level * 15;
const maxMp = (level: number) => 50 + level * 8;

type EnemyData = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  bodyGfx: Phaser.GameObjects.Graphics;
  hpBarGfx: Phaser.GameObjects.Graphics;
  alive: boolean;
};

export class GameScene extends Phaser.Scene {
  private conn!: DbConnection;
  private localCharacter: Character | null = null;
  private localSpirit: PersonalSpirit | null = null;
  private otherCircles = new Map<bigint, Phaser.GameObjects.Graphics>();

  // Client-side prediction: move immediately on click, server corrects only on significant drift
  private targetX = 0;
  private targetY = 0;

  private playerCircle!: Phaser.GameObjects.Graphics;
  private moveLine!: Phaser.GameObjects.Graphics;
  private facingLine!: Phaser.GameObjects.Graphics;

  // Enemies (client-side only, no server table yet)
  private enemies: EnemyData[] = [];

  // Attack state
  private lastAttackTime = 0;
  private readonly ATTACK_COOLDOWN = 500;
  private readonly ATTACK_RANGE    = 280;
  private readonly ATTACK_HALF_ANG = 15 * Math.PI / 180;
  private readonly ATTACK_DAMAGE   = 10;

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

    // ── Move line & facing indicator (drawn each frame in update) ─────────────
    this.moveLine   = this.add.graphics().setDepth(0);
    this.facingLine = this.add.graphics().setDepth(2);

    // ── Enemies ───────────────────────────────────────────────────────────────
    this._spawnEnemies();

    // ── HUD ───────────────────────────────────────────────────────────────────
    this._createHud();

    // ── Input ─────────────────────────────────────────────────────────────────
    this._setupInput();

    // ── SpacetimeDB ───────────────────────────────────────────────────────────
    this.conn = connect(this._tokenStore(), (conn) => {
      if (!this.localCharacter) {
        callReducer('startLife', () =>
          conn.reducers.startLife({ spiritName: 'your spirit', startZoneId: 1 }),
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

    // Move interpolation
    this.playerCircle.x += (this.targetX - this.playerCircle.x) * 0.15;
    this.playerCircle.y += (this.targetY - this.playerCircle.y) * 0.15;

    // Dotted move line — drawn while en route, cleared on arrival
    const mdx = this.targetX - this.playerCircle.x;
    const mdy = this.targetY - this.playerCircle.y;
    this.moveLine.clear();
    if (mdx * mdx + mdy * mdy > 25) {
      this._drawDottedLine(
        this.moveLine,
        this.playerCircle.x, this.playerCircle.y,
        this.targetX, this.targetY,
      );
    }

    // Facing dot — small white dot on player edge pointing at cursor
    const ptr   = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(
      this.playerCircle.x, this.playerCircle.y,
      ptr.worldX, ptr.worldY,
    );
    this.facingLine.clear();
    this.facingLine.fillStyle(0xffffff, 0.9);
    this.facingLine.fillCircle(
      this.playerCircle.x + Math.cos(angle) * PLAYER_R,
      this.playerCircle.y + Math.sin(angle) * PLAYER_R,
      4,
    );
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
      // Only correct prediction if server position diverges by more than 5 px
      const dx = row.posX - this.playerCircle.x;
      const dy = row.posY - this.playerCircle.y;
      if (dx * dx + dy * dy > 25) {
        this.targetX = row.posX;
        this.targetY = row.posY;
      }
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
    this.input.mouse?.disableContextMenu();

    // Left-click: move
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      if (!this.localCharacter?.alive) return;

      this.targetX = pointer.worldX;
      this.targetY = pointer.worldY;

      callReducer('move', () =>
        this.conn.reducers.move({ x: pointer.worldX, y: pointer.worldY }),
      );
    });

    // Right-click: basic attack
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) return;
      if (!this.localCharacter?.alive) return;
      this._fireBasicAttack(pointer.worldX, pointer.worldY);
    });

    // Reserve keys 1–0 for active ability slots (no handlers yet)
    this.input.keyboard?.addKeys(
      'ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE,ZERO',
    );
  }

  // ── Enemies ───────────────────────────────────────────────────────────────────

  private _spawnEnemies() {
    const SPAWN = [
      { x: 1600, y: 1400 },
      { x: 1720, y: 1510 },
      { x: 1560, y: 1620 },
    ];

    for (const pos of SPAWN) {
      const bodyGfx = this.add.graphics();
      bodyGfx.fillStyle(0x8b0000, 1);
      bodyGfx.fillCircle(0, 0, ENEMY_R);
      bodyGfx.setPosition(pos.x, pos.y);
      bodyGfx.setDepth(1);

      const hpBarGfx = this.add.graphics().setDepth(2);
      const enemy: EnemyData = {
        x: pos.x, y: pos.y,
        hp: 100, maxHp: 100,
        bodyGfx, hpBarGfx,
        alive: true,
      };
      this._drawEnemyHpBar(enemy);
      this.enemies.push(enemy);
    }
  }

  private _drawEnemyHpBar(enemy: EnemyData) {
    const W = 48, H = 6;
    const bx = enemy.x - W / 2;
    const by = enemy.y - ENEMY_R - 14;
    enemy.hpBarGfx.clear();
    enemy.hpBarGfx.fillStyle(0x333333, 1);
    enemy.hpBarGfx.fillRect(bx, by, W, H);
    if (enemy.hp > 0) {
      enemy.hpBarGfx.fillStyle(0xff3333, 1);
      enemy.hpBarGfx.fillRect(bx, by, W * (enemy.hp / enemy.maxHp), H);
    }
  }

  // ── Combat ────────────────────────────────────────────────────────────────────

  private _fireBasicAttack(worldX: number, worldY: number) {
    if (this.time.now - this.lastAttackTime < this.ATTACK_COOLDOWN) return;
    this.lastAttackTime = this.time.now;

    const ox = this.playerCircle.x;
    const oy = this.playerCircle.y;
    const dx = worldX - ox;
    const dy = worldY - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const travelDist = Math.min(dist, this.ATTACK_RANGE);
    const endX = ox + nx * travelDist;
    const endY = oy + ny * travelDist;

    this._muzzleFlash(ox, oy);

    const proj = this.add.graphics();
    proj.fillStyle(0xffffaa, 1);
    proj.fillCircle(0, 0, 5);
    proj.setPosition(ox, oy);
    proj.setDepth(3);

    const duration = (travelDist / 600) * 1000;

    this.tweens.add({
      targets: proj,
      x: endX,
      y: endY,
      duration,
      ease: 'Linear',
      onComplete: () => {
        proj.destroy();
        let hitAny = false;
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          if (this._inCone(enemy.x, enemy.y, ox, oy, nx, ny)) {
            this._damageEnemy(enemy, this.ATTACK_DAMAGE);
            hitAny = true;
          }
        }
        if (hitAny) {
          this.cameras.main.shake(100, 0.002);
        }
      },
    });
  }

  private _inCone(ex: number, ey: number, ox: number, oy: number, nx: number, ny: number): boolean {
    const dx = ex - ox;
    const dy = ey - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.ATTACK_RANGE) return false;
    if (dist === 0) return true;
    const dot = (dx / dist) * nx + (dy / dist) * ny;
    return dot >= Math.cos(this.ATTACK_HALF_ANG);
  }

  private _damageEnemy(enemy: EnemyData, amount: number) {
    enemy.hp = Math.max(0, enemy.hp - amount);
    this._drawEnemyHpBar(enemy);
    this._showFloatingDamage(enemy.x, enemy.y - ENEMY_R - 20, amount);

    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.bodyGfx.clear();
      enemy.bodyGfx.fillStyle(0xffffff, 1);
      enemy.bodyGfx.fillCircle(0, 0, ENEMY_R);
      enemy.hpBarGfx.setVisible(false);

      this.tweens.add({
        targets: enemy.bodyGfx,
        alpha: 0,
        duration: 400,
        ease: 'Quad.easeIn',
        onComplete: () => {
          enemy.bodyGfx.destroy();
          enemy.hpBarGfx.destroy();
        },
      });
    }
  }

  private _showFloatingDamage(x: number, y: number, amount: number) {
    const txt = this.add
      .text(x, y, `+${amount}`, {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.tweens.add({
      targets: txt,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  private _muzzleFlash(x: number, y: number) {
    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 1);
    flash.fillCircle(0, 0, PLAYER_R);
    flash.setPosition(x, y);
    flash.setDepth(5);
    flash.setAlpha(0.9);

    this.tweens.add({
      targets: flash,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  // ── Drawing helpers ───────────────────────────────────────────────────────────

  private _drawDottedLine(
    g: Phaser.GameObjects.Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
  ) {
    const DOT_SPACING = 12;
    const DOT_R = 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / len;
    const ny = dy / len;
    g.fillStyle(0xffffff, 0.35);
    for (let d = DOT_SPACING; d < len; d += DOT_SPACING) {
      g.fillCircle(x1 + nx * d, y1 + ny * d, DOT_R);
    }
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
      clear: (): void => { localStorage.removeItem('sb_token'); },
    };
  }
}
