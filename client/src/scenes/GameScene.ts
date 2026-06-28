import Phaser from 'phaser';
import type { Identity } from 'spacetimedb';
import { connect, callReducer, type DbConnection } from '../db';
import type { Character, PersonalSpirit } from '../db';

const WORLD_W = 3000;
const WORLD_H = 3000;
const PLAYER_R = 20;
const OTHER_R  = 18;
const ENEMY_R  = 24;

const LERP_SPEED  = 0.09;   // ~40% slower than original 0.15 — less overshoot
const STOP_RADIUS = 60;     // Diablo-style: stop this far from enemy on left-click

// Card slot dimensions (shared between art draw and overlay)
const CARD_SW  = 52;
const CARD_SH  = 72;
const CARD_GAP = 6;

// Basic attack (right-click)
const ATTACK_RANGE    = 280;
const ATTACK_HALF_ANG = 15 * Math.PI / 180;
const ATTACK_COOLDOWN = 500;
const ATTACK_DAMAGE   = 10;

// Card 1 — Ember Strike
const EMBER_RANGE    = 320;
const EMBER_HALF_ANG = 30 * Math.PI / 180;  // wider cone than basic attack
const EMBER_COOLDOWN = 1200;
const EMBER_MP_COST  = 10;
const EMBER_DAMAGE   = 25;
const EMBER_MP_REGEN = 2;  // MP per second, client-side until server regen exists

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

// ── CastController ─────────────────────────────────────────────────────────────
// "Quick Cast with Indicator": press-and-hold enters targeting mode with a live
// cone indicator; release fires toward current cursor position.
// Each card slot gets one CastController — register a new one per card in
// _createCasts() with its own key, geometry, and onFire callback.

type CastCfg = {
  key: string;            // Phaser keyboard constant (e.g. 'ONE')
  range: number;
  halfAngle: number;      // half-angle of the cone in radians
  indicatorColor: number;
  cooldown: number;       // ms
  mpCost: number;
  slotX: number;          // HUD slot screen-space X for cooldown/flash overlay
  slotY: number;
  getPlayerPos: () => { x: number; y: number };
  isAlive: () => boolean;
  hasMp: () => boolean;
  spendMp: () => void;
  onFire: (nx: number, ny: number) => void;
};

class CastController {
  private holding     = false;
  private cooldownEnd = 0;
  private flashEnd    = 0;
  private readonly scene: Phaser.Scene;
  private readonly cfg: CastCfg;
  private readonly indicatorGfx: Phaser.GameObjects.Graphics;
  private readonly overlayGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, cfg: CastCfg) {
    this.scene = scene;
    this.cfg   = cfg;
    // World-space indicator; no scroll lock so it moves with the camera
    this.indicatorGfx = scene.add.graphics().setDepth(4);
    // Screen-space overlay for cooldown sweep + no-MP flash
    this.overlayGfx   = scene.add.graphics().setScrollFactor(0).setDepth(12);
    this._bindKeys();
  }

  /** Called by the scene on left-click so movement cancels an active aim. */
  cancelIfHolding() {
    if (!this.holding) return;
    this.holding = false;
    this.indicatorGfx.clear();
  }

  /** Must be called every frame from scene.update(). */
  update() {
    const now = this.scene.time.now;
    const { slotX: sx, slotY: sy, cooldown } = this.cfg;

    // Live cone tracks cursor while key is held
    if (this.holding) {
      const { x, y } = this.cfg.getPlayerPos();
      const ptr  = this.scene.input.activePointer;
      const dx   = ptr.worldX - x;
      const dy   = ptr.worldY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nx   = dist > 0 ? dx / dist : 1;
      const ny   = dist > 0 ? dy / dist : 0;
      const base = Math.atan2(ny, nx);
      const a1   = base - this.cfg.halfAngle;
      const a2   = base + this.cfg.halfAngle;

      this.indicatorGfx.clear();
      this.indicatorGfx.lineStyle(1.5, this.cfg.indicatorColor, 0.85);
      this.indicatorGfx.beginPath();
      this.indicatorGfx.moveTo(x, y);
      this.indicatorGfx.lineTo(x + Math.cos(a1) * this.cfg.range, y + Math.sin(a1) * this.cfg.range);
      this.indicatorGfx.arc(x, y, this.cfg.range, a1, a2, false);
      this.indicatorGfx.closePath();
      this.indicatorGfx.strokePath();
    }

    // Cooldown sweep + no-MP flash (both screen-space on the HUD slot)
    this.overlayGfx.clear();

    if (now < this.cooldownEnd) {
      const fraction = (this.cooldownEnd - now) / cooldown;
      this.overlayGfx.fillStyle(0x000000, 0.55);
      this.overlayGfx.fillRect(sx, sy, CARD_SW, CARD_SH * fraction);
    }

    if (now < this.flashEnd) {
      const t = (this.flashEnd - now) / 300;
      this.overlayGfx.fillStyle(0xff0000, 0.55 * t);
      this.overlayGfx.fillRect(sx, sy, CARD_SW, CARD_SH);
    }
  }

  private _bindKeys() {
    const kb = this.scene.input.keyboard!;

    kb.on(`keydown-${this.cfg.key}`, () => {
      if (this.holding || !this.cfg.isAlive()) return;
      this.holding = true;
    });

    kb.on(`keyup-${this.cfg.key}`, () => {
      if (!this.holding) return;
      this.holding = false;
      this.indicatorGfx.clear();
      this._tryFire();
    });

    // Escape cancels without firing
    kb.on('keydown-ESC', () => this.cancelIfHolding());
  }

  private _tryFire() {
    const now = this.scene.time.now;

    // Blocked: flash red, no fire
    if (now < this.cooldownEnd || !this.cfg.hasMp()) {
      this.flashEnd = now + 300;
      return;
    }

    const ptr  = this.scene.input.activePointer;
    const { x, y } = this.cfg.getPlayerPos();
    const dx   = ptr.worldX - x;
    const dy   = ptr.worldY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    this.cfg.spendMp();
    this.cooldownEnd = now + this.cfg.cooldown;
    this.cfg.onFire(dx / dist, dy / dist);
  }
}

// ── GameScene ─────────────────────────────────────────────────────────────────

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

  private lastAttackTime = 0;

  // MP managed client-side (server has no regen reducer yet)
  private clientMp = 0;

  // Card cast controllers — one per active slot
  private emberCast!: CastController;

  // Slot position stored so _createCasts() can read it after _createHud()
  private slot1X = 0;
  private slot1Y = 0;

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

    // ── Move line & facing indicator (drawn per-frame in update) ───────────────
    this.moveLine   = this.add.graphics().setDepth(0);
    this.facingLine = this.add.graphics().setDepth(2);

    // ── Enemies ───────────────────────────────────────────────────────────────
    this._spawnEnemies();

    // ── HUD (must run before _createCasts so slot1X/Y are set) ───────────────
    this._createHud();

    // ── Cast controllers ──────────────────────────────────────────────────────
    this._createCasts();

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

  update(_time: number, delta: number) {
    if (!this.localCharacter) return;

    // ── Move interpolation ────────────────────────────────────────────────────
    this.playerCircle.x += (this.targetX - this.playerCircle.x) * LERP_SPEED;
    this.playerCircle.y += (this.targetY - this.playerCircle.y) * LERP_SPEED;

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

    // Facing dot — orbits player edge pointing at cursor
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

    // ── MP regen ──────────────────────────────────────────────────────────────
    this.clientMp = Math.min(
      this.clientMp + EMBER_MP_REGEN * (delta / 1000),
      maxMp(this.localCharacter.level),
    );
    this._updateHud();

    // ── Cast controller tick (indicator + slot overlays) ──────────────────────
    this.emberCast.update();
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
      this.clientMp = row.currentMp;
      this.targetX  = row.posX;
      this.targetY  = row.posY;
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

  // ── Cast controllers ──────────────────────────────────────────────────────────

  private _createCasts() {
    this.emberCast = new CastController(this, {
      key:            'ONE',
      range:          EMBER_RANGE,
      halfAngle:      EMBER_HALF_ANG,
      indicatorColor: 0xff7700,
      cooldown:       EMBER_COOLDOWN,
      mpCost:         EMBER_MP_COST,
      slotX:          this.slot1X,
      slotY:          this.slot1Y,
      getPlayerPos:   () => ({ x: this.playerCircle.x, y: this.playerCircle.y }),
      isAlive:        () => !!this.localCharacter?.alive,
      hasMp:          () => this.clientMp >= EMBER_MP_COST,
      spendMp:        () => { this.clientMp -= EMBER_MP_COST; },
      onFire:         (nx, ny) => this._executeEmberStrike(nx, ny),
    });
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  private _setupInput() {
    this.input.mouse?.disableContextMenu();

    // Left-click: cancel any held cast first, then move
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      if (!this.localCharacter?.alive) return;

      this.emberCast.cancelIfHolding();

      const dest = this._resolveClickTarget(pointer.worldX, pointer.worldY);
      this.targetX = dest.x;
      this.targetY = dest.y;

      callReducer('move', () =>
        this.conn.reducers.move({ x: dest.x, y: dest.y }),
      );
    });

    // Right-click: basic attack (instant-fire, no held indicator)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) return;
      if (!this.localCharacter?.alive) return;
      this._fireBasicAttack(pointer.worldX, pointer.worldY);
    });

    // Keys 1–0: card cast controllers bind themselves in _createCasts()
    // Keys 2–0 reserved for future cards
  }

  // ── Movement helpers ──────────────────────────────────────────────────────────

  // If click lands inside STOP_RADIUS of any alive enemy, reroute to the approach edge.
  private _resolveClickTarget(clickX: number, clickY: number): { x: number; y: number } {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = clickX - enemy.x;
      const dy = clickY - enemy.y;
      if (dx * dx + dy * dy < STOP_RADIUS * STOP_RADIUS) {
        const pdx = enemy.x - this.playerCircle.x;
        const pdy = enemy.y - this.playerCircle.y;
        const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pDist <= STOP_RADIUS) return { x: this.playerCircle.x, y: this.playerCircle.y };
        return {
          x: enemy.x - (pdx / pDist) * STOP_RADIUS,
          y: enemy.y - (pdy / pDist) * STOP_RADIUS,
        };
      }
    }
    return { x: clickX, y: clickY };
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
    if (this.time.now - this.lastAttackTime < ATTACK_COOLDOWN) return;
    this.lastAttackTime = this.time.now;

    const ox = this.playerCircle.x;
    const oy = this.playerCircle.y;
    const dx = worldX - ox;
    const dy = worldY - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const travelDist = Math.min(dist, ATTACK_RANGE);

    this._muzzleFlash(ox, oy);
    this._showConePreview(ox, oy, nx, ny, ATTACK_RANGE, ATTACK_HALF_ANG, 0xffffff);

    const proj = this.add.graphics();
    proj.fillStyle(0xffffaa, 1);
    proj.fillCircle(0, 0, 5);
    proj.setPosition(ox, oy);
    proj.setDepth(3);

    this.tweens.add({
      targets: proj,
      x: ox + nx * travelDist,
      y: oy + ny * travelDist,
      duration: (travelDist / 600) * 1000,
      ease: 'Linear',
      onComplete: () => {
        proj.destroy();
        let hitAny = false;
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          if (this._inCone(enemy.x, enemy.y, ox, oy, nx, ny, ATTACK_RANGE, ATTACK_HALF_ANG)) {
            this._damageEnemy(enemy, ATTACK_DAMAGE, '#ffffff');
            hitAny = true;
          }
        }
        if (hitAny) this.cameras.main.shake(100, 0.002);
      },
    });
  }

  // Spawns the Ember Strike projectile toward (nx, ny). MP/cooldown are
  // handled by CastController before this is called.
  private _executeEmberStrike(nx: number, ny: number) {
    const ox = this.playerCircle.x;
    const oy = this.playerCircle.y;

    this._muzzleFlash(ox, oy);
    this._showConePreview(ox, oy, nx, ny, EMBER_RANGE, EMBER_HALF_ANG, 0xff7700);

    const proj = this.add.graphics();
    proj.fillStyle(0xff7700, 1);
    proj.fillCircle(0, 0, 7);
    proj.setPosition(ox, oy);
    proj.setDepth(3);

    this.tweens.add({
      targets: proj,
      x: ox + nx * EMBER_RANGE,
      y: oy + ny * EMBER_RANGE,
      duration: (EMBER_RANGE / 400) * 1000,  // slower projectile than basic attack
      ease: 'Linear',
      onComplete: () => {
        proj.destroy();
        let hitAny = false;
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          if (this._inCone(enemy.x, enemy.y, ox, oy, nx, ny, EMBER_RANGE, EMBER_HALF_ANG)) {
            this._damageEnemy(enemy, EMBER_DAMAGE, '#ff8800');
            this._emberBurnFlash(enemy);
            hitAny = true;
          }
        }
        if (hitAny) this.cameras.main.shake(120, 0.003);
      },
    });
  }

  private _inCone(
    ex: number, ey: number,
    ox: number, oy: number,
    nx: number, ny: number,
    range: number, halfAngle: number,
  ): boolean {
    const dx = ex - ox;
    const dy = ey - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > range) return false;
    if (dist === 0) return true;
    return (dx / dist) * nx + (dy / dist) * ny >= Math.cos(halfAngle);
  }

  private _damageEnemy(enemy: EnemyData, amount: number, floatColor: string) {
    enemy.hp = Math.max(0, enemy.hp - amount);
    this._drawEnemyHpBar(enemy);
    this._showFloatingDamage(enemy.x, enemy.y - ENEMY_R - 20, amount, floatColor);

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

  private _emberBurnFlash(enemy: EnemyData) {
    const flash = this.add.graphics();
    flash.fillStyle(0xff6600, 0.7);
    flash.fillCircle(0, 0, ENEMY_R + 6);
    flash.setPosition(enemy.x, enemy.y);
    flash.setDepth(1.5);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  private _showFloatingDamage(x: number, y: number, amount: number, color: string) {
    const txt = this.add
      .text(x, y, `+${amount}`, {
        fontSize: '16px',
        color,
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

  // Brief cone outline at attack origin, fades out in 200ms.
  // Shows players the attack geometry before the projectile lands.
  private _showConePreview(
    ox: number, oy: number,
    nx: number, ny: number,
    range: number, halfAngle: number,
    color: number,
  ) {
    const g = this.add.graphics();
    g.lineStyle(1.5, color, 0.75);
    g.setDepth(4);

    const base = Math.atan2(ny, nx);
    const a1   = base - halfAngle;
    const a2   = base + halfAngle;

    g.beginPath();
    g.moveTo(ox, oy);
    g.lineTo(ox + Math.cos(a1) * range, oy + Math.sin(a1) * range);
    g.arc(ox, oy, range, a1, a2, false);
    g.closePath();
    g.strokePath();

    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 200,
      ease: 'Linear',
      onComplete: () => g.destroy(),
    });
  }

  // ── Drawing helpers ───────────────────────────────────────────────────────────

  private _drawDottedLine(
    g: Phaser.GameObjects.Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
  ) {
    const DOT_SPACING = 12;
    const dx  = x2 - x1;
    const dy  = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx  = dx / len;
    const ny  = dy / len;
    g.fillStyle(0xffffff, 0.35);
    for (let d = DOT_SPACING; d < len; d += DOT_SPACING) {
      g.fillCircle(x1 + nx * d, y1 + ny * d, 2);
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
    const activeCount  = 10;
    const passiveCount = 5;
    const activeW  = activeCount  * CARD_SW + (activeCount  - 1) * CARD_GAP;
    const passiveW = passiveCount * CARD_SW + (passiveCount - 1) * CARD_GAP;
    const activeY  = camH - CARD_SH - 12;
    const passiveY = activeY - CARD_SH - 8;
    const ax = (camW - activeW)  / 2;
    const px = (camW - passiveW) / 2;

    // Store slot 1 screen position for CastController overlay
    this.slot1X = ax;
    this.slot1Y = activeY;

    // Slot outlines
    const g = this.add.graphics().setScrollFactor(0).setDepth(10);
    g.lineStyle(2, 0xffffff, 0.35);
    for (let i = 0; i < activeCount; i++) {
      g.strokeRect(ax + i * (CARD_SW + CARD_GAP), activeY, CARD_SW, CARD_SH);
    }
    for (let i = 0; i < passiveCount; i++) {
      g.strokeRect(px + i * (CARD_SW + CARD_GAP), passiveY, CARD_SW, CARD_SH);
    }

    // Slot 1 — Ember Strike art placeholder (deep ember orange fill)
    const art = this.add.graphics().setScrollFactor(0).setDepth(10);
    art.fillStyle(0xc43a08, 1);
    art.fillRect(ax + 2, activeY + 2, CARD_SW - 4, CARD_SH - 4);

    this.add
      .text(ax + CARD_SW / 2, activeY + CARD_SH / 2, 'Ember\nStrike', {
        fontSize: '9px',
        color: '#ffffff',
        fontFamily: 'monospace',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(11);
  }

  // ── HUD update ────────────────────────────────────────────────────────────────

  private _updateHud() {
    const c = this.localCharacter;
    const BAR_W = 200, BAR_H = 18, X = 12;

    this.hudBars.clear();
    this.hudBars.fillStyle(0x2a0000, 0.85).fillRect(X, 12, BAR_W, BAR_H);
    this.hudBars.fillStyle(0x001a3a, 0.85).fillRect(X, 38, BAR_W, BAR_H);

    if (c) {
      const hp  = Math.max(0, c.currentHp);
      const mp  = Math.max(0, Math.floor(this.clientMp));
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
