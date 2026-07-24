import Phaser from 'phaser';
import type { Identity } from 'spacetimedb';
import { connect, callReducer, type DbConnection } from '../db';
import type { Character, PersonalSpirit, Enemy, CardDefinition, CardDrop, CardInstance, EquippedCard } from '../db';
import { CollectionPanel } from '../ui/CollectionPanel';

// ── Tilemap constants ─────────────────────────────────────────────────────────
const TILE_SIZE  = 48;
const MAP_W      = 60;
const MAP_H      = 60;
const TILE_GRASS = 0;
const TILE_DIRT  = 1;
const TILE_STONE = 2;

const WORLD_W = MAP_W * TILE_SIZE;  // 2880
const WORLD_H = MAP_H * TILE_SIZE;  // 2880

const PLAYER_R = 20;
const OTHER_R  = 18;
const ENEMY_R  = 24;

const MOVE_SPEED  = 180; // px/second
const STOP_RADIUS = 60;

// Enemy position smoothing: server ticks every 500ms, so this interpolation
// speed just needs to comfortably out-pace the enemy's fastest server speed
// (chase, 110 px/s) to avoid visibly lagging behind between ticks.
const ENEMY_LERP_SPEED = 140; // px/second

// Card slot dimensions
const CARD_SW  = 52;
const CARD_SH  = 72;
const CARD_GAP = 6;

// Spirit anchor
const SPIRIT_X = 360;
const SPIRIT_Y = 360;
const SPIRIT_PROX_R = 100;
const DROP_PICKUP_R  = 80;

const DROP_COLORS: Record<string, number> = {
  Common: 0xcccccc, Uncommon: 0x44cc44, Rare: 0x4488ff, Epic: 0xaa44ff, Legendary: 0xffcc00,
};

function _rarityTag(tag: unknown): string {
  return String((tag as any)?.tag ?? tag).match(/^(\w+)/)?.[1] ?? 'Common';
}

// Basic attack (right-click)
const ATTACK_RANGE    = 280;
const ATTACK_HALF_ANG = 15 * Math.PI / 180;
const ATTACK_COOLDOWN = 500;
const ATTACK_DAMAGE   = 10;

// Card 1 — Ember Strike geometry (fixed; actual power values come from DB)
const EMBER_RANGE    = 320;
const EMBER_HALF_ANG = 30 * Math.PI / 180;
const EMBER_MP_REGEN = 2;

const maxHp = (level: number) => 100 + level * 15;
const maxMp = (level: number) => 50 + level * 8;

// ── Map layout ────────────────────────────────────────────────────────────────

function buildMap(): number[][] {
  const rows = Array.from({ length: MAP_H }, () => Array<number>(MAP_W).fill(TILE_GRASS));

  for (let x = 0; x < MAP_W; x++) {
    rows[0][x]        = TILE_STONE;
    rows[MAP_H - 1][x] = TILE_STONE;
  }
  for (let y = 0; y < MAP_H; y++) {
    rows[y][0]        = TILE_STONE;
    rows[y][MAP_W - 1] = TILE_STONE;
  }

  const PATH = [
    [1, 30], [12, 25], [20, 38], [30, 30],
    [38, 18], [46, 34], [54, 28], [58, 30],
  ];
  for (let i = 0; i < PATH.length - 1; i++) {
    const [x0, y0] = PATH[i];
    const [x1, y1] = PATH[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = Math.round(x0 + (x1 - x0) * t);
      const cy = Math.round(y0 + (y1 - y0) * t);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx > 0 && nx < MAP_W - 1 && ny > 0 && ny < MAP_H - 1) {
            rows[ny][nx] = TILE_DIRT;
          }
        }
      }
    }
  }

  return rows;
}

const MAP_DATA = buildMap();
const TILE_TEX = 'tiles';

// ── Enemy graphics data (client side, mirrors DB row) ─────────────────────────

type EnemyGfx = {
  enemyId: bigint;
  x: number;
  y: number;
  serverX: number;
  serverY: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  bodyGfx: Phaser.GameObjects.Graphics;
  hpBarGfx: Phaser.GameObjects.Graphics;
  castCircleGfx: Phaser.GameObjects.Graphics;
  castBarGfx: Phaser.GameObjects.Graphics;
  aggroIndicatorGfx: Phaser.GameObjects.Graphics;
  aggroState: 'Idle' | 'Chasing' | 'Casting' | 'Cooldown' | 'Resetting';
  castStartedAtMs: number | null;
  castDurationMs: number;
  castRadius: number;
};

// ── CastController ─────────────────────────────────────────────────────────────

type CastCfg = {
  key: string;
  range: number;
  halfAngle: number;
  indicatorColor: number;
  cooldown: number;
  mpCost: number;
  slotX: number;
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
    this.indicatorGfx = scene.add.graphics().setDepth(4);
    this.overlayGfx   = scene.add.graphics().setScrollFactor(0).setDepth(12);
    this._bindKeys();
  }

  cancelIfHolding() {
    if (!this.holding) return;
    this.holding = false;
    this.indicatorGfx.clear();
  }

  setCooldown(ms: number): void {
    this.cfg.cooldown = ms;
  }

  update() {
    const now = this.scene.time.now;
    const { slotX: sx, slotY: sy, cooldown } = this.cfg;

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

    kb.on('keydown-ESC', () => this.cancelIfHolding());
  }

  private _tryFire() {
    const now = this.scene.time.now;
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

  private targetX = 0;
  private targetY = 0;

  private playerCircle!: Phaser.GameObjects.Graphics;
  private moveLine!: Phaser.GameObjects.Graphics;
  private facingLine!: Phaser.GameObjects.Graphics;

  // DB-synced enemy graphics
  private dbEnemies = new Map<bigint, EnemyGfx>();

  private lastAttackTime = 0;
  private clientMp = 0;

  private emberCast!: CastController;
  private emberDef: CardDefinition | null = null;
  private emberDamage = 25;   // default; overwritten when card_definition row arrives
  private emberMpCost = 10;   // default; overwritten when card_definition row arrives
  private slot1X = 0;
  private slot1Y = 0;
  private slot1Label!: Phaser.GameObjects.Text;

  private hudBars!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private spiritLevelText!: Phaser.GameObjects.Text;

  // Death overlay
  private isDead = false;
  private deathOverlay!: Phaser.GameObjects.Graphics;
  private deathSummaryText: Phaser.GameObjects.Text | null = null;

  // Card lifecycle
  private collectionPanel!: CollectionPanel;
  private spiritPanel!: CollectionPanel;
  private _cardDefs        = new Map<number, CardDefinition>();
  private localCardInst    = new Map<bigint, CardInstance>();
  private localEquipped    = new Map<bigint, EquippedCard>(); // key = equippedCardId
  private worldDrops       = new Map<bigint, { dropRow: CardDrop; gfx: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }>();
  private spiritGfx!: Phaser.GameObjects.Graphics;
  private spiritLabel!:  Phaser.GameObjects.Text;
  private nearSpirit      = false;
  private nearDropId: bigint | null = null;
  private deathText!: Phaser.GameObjects.Text;
  private returnBtn!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    const canvas = this.textures.createCanvas(TILE_TEX, TILE_SIZE * 3, TILE_SIZE)!;
    const ctx    = canvas.getContext();

    ctx.fillStyle = '#2d4a1e';
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    ctx.fillStyle = '#6b4c2a';
    ctx.fillRect(TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);

    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(TILE_SIZE * 2, 0, TILE_SIZE, TILE_SIZE);

    canvas.refresh();
  }

  create() {
    // ── Tilemap ────────────────────────────────────────────────────────────────
    const map     = this.make.tilemap({ data: MAP_DATA, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage(TILE_TEX, TILE_TEX, TILE_SIZE, TILE_SIZE)!;
    map.createLayer(0, tileset, 0, 0)!.setDepth(-1);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    // ── Local player circle ───────────────────────────────────────────────────
    this.playerCircle = this.add.graphics();
    this.playerCircle.fillStyle(0x4fc3f7, 1);
    this.playerCircle.fillCircle(0, 0, PLAYER_R);
    this.playerCircle.setDepth(1);
    this.cameras.main.startFollow(this.playerCircle);

    // ── Move line & facing indicator ──────────────────────────────────────────
    this.moveLine   = this.add.graphics().setDepth(0);
    this.facingLine = this.add.graphics().setDepth(2);

    // ── HUD (must run before _createCasts so slot1X/Y are set) ───────────────
    this._createHud();

    // ── Death overlay (hidden by default) ────────────────────────────────────
    this._createDeathOverlay();

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
    this.conn.db.character.onUpdate?.((_ctx, old, row) => this._onCharUpdate(old, row));
    this.conn.db.character.onDelete((_ctx, row) => this._onCharDelete(row));
    this.conn.db.personalSpirit.onInsert((_ctx, row) => this._onSpiritRow(row));
    this.conn.db.personalSpirit.onUpdate?.((_ctx, _old, row) => this._onSpiritRow(row));
    this.conn.db.enemy.onInsert((_ctx, row) => this._onEnemyInsert(row));
    this.conn.db.enemy.onUpdate?.((_ctx, old, row) => this._onEnemyUpdate(old, row));
    this.conn.db.enemy.onDelete((_ctx, row) => this._onEnemyDelete(row));
    this.conn.db.cardDefinition.onInsert((_ctx, row) => this._onCardDefRow(row));
    this.conn.db.cardDefinition.onUpdate?.((_ctx, _old, row) => this._onCardDefRow(row));

    this.conn.db.cardDrop.onInsert((_ctx, row) => this._onDropInsert(row));
    this.conn.db.cardDrop.onDelete((_ctx, row) => this._onDropDelete(row));

    this.conn.db.cardInstance.onInsert((_ctx, row) => {
      this.localCardInst.set(row.cardInstanceId, row);
      this.collectionPanel.onCardInsert(row);
      this.spiritPanel.onCardInsert(row);
    });
    this.conn.db.cardInstance.onUpdate?.((_ctx, old, row) => {
      this.localCardInst.set(row.cardInstanceId, row);
      this.collectionPanel.onCardUpdate(old, row);
      this.spiritPanel.onCardUpdate(old, row);
    });
    this.conn.db.cardInstance.onDelete((_ctx, row) => {
      this.localCardInst.delete(row.cardInstanceId);
      this.collectionPanel.onCardDelete(row);
      this.spiritPanel.onCardDelete(row);
    });

    this.conn.db.equippedCard.onInsert((_ctx, row) => {
      this.localEquipped.set(row.equippedCardId, row);
      this.collectionPanel.onEquippedInsert(row);
      this.spiritPanel.onEquippedInsert(row);
    });
    this.conn.db.equippedCard.onDelete((_ctx, row) => {
      this.localEquipped.delete(row.equippedCardId);
      this.collectionPanel.onEquippedDelete(row);
      this.spiritPanel.onEquippedDelete(row);
    });

    // ── CollectionPanel / SpiritPanel ─────────────────────────────────────────
    this.collectionPanel = new CollectionPanel({ mode: 'collection' });
    this.spiritPanel     = new CollectionPanel({ mode: 'spirit' });
    this.collectionPanel.onAction = (action, payload) => this._onPanelAction(action, payload);
    this.spiritPanel.onAction     = (action, payload) => this._onPanelAction(action, payload);

    // ── Spirit ─────────────────────────────────────────────────────────────────
    this.spiritGfx = this.add.graphics().setDepth(0.8);
    this.spiritGfx.fillStyle(0xffd700, 0.25);
    this.spiritGfx.fillCircle(SPIRIT_X, SPIRIT_Y, 22);
    this.spiritGfx.lineStyle(2, 0xffd700, 0.9);
    this.spiritGfx.strokeCircle(SPIRIT_X, SPIRIT_Y, 22);
    this.tweens.add({
      targets: this.spiritGfx,
      alpha: { from: 0.6, to: 1.0 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.spiritLabel = this.add
      .text(SPIRIT_X, SPIRIT_Y - 34, 'Press E — Spirit', {
        fontSize: '11px', color: '#ffd700', fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(3)
      .setVisible(false);
  }

  update(_time: number, delta: number) {
    if (!this.localCharacter) return;

    if (this.localCharacter.alive) {
      // ── Move ────────────────────────────────────────────────────────────────
      {
        const dx   = this.targetX - this.playerCircle.x;
        const dy   = this.targetY - this.playerCircle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 4) {
          const step = MOVE_SPEED * (delta / 1000);
          if (step >= dist) {
            this.playerCircle.x = this.targetX;
            this.playerCircle.y = this.targetY;
          } else {
            this.playerCircle.x += (dx / dist) * step;
            this.playerCircle.y += (dy / dist) * step;
          }
        }
      }

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

      // ── MP regen ────────────────────────────────────────────────────────────
      this.clientMp = Math.min(
        this.clientMp + EMBER_MP_REGEN * (delta / 1000),
        maxMp(this.localCharacter.level),
      );
    }

    this._updateHud();
    this.emberCast.update();
    this._updateEnemyMovement(delta);
    this._updateCastTelegraphs();
    this._updateProximity();
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
      if (this.isDead) this._hideDeathOverlay();
      this._updateHud();
    } else if (row.zoneId === (this.localCharacter?.zoneId ?? 1)) {
      this._addOtherPlayer(row);
    }
  }

  private _onCharUpdate(old: Character, row: Character) {
    if (this._isLocal(row.accountIdentity)) {
      const wasAlive = this.localCharacter?.alive;
      this.localCharacter = row;

      if (row.alive && old.alive) {
        const hpLost = old.currentHp - row.currentHp;
        if (hpLost > 0) this._showPlayerHitFeedback(hpLost);
      }

      if (!row.alive && wasAlive) {
        const survived = [...this.localCardInst.values()]
          .filter(ci => ci.attuned)
          .map(ci => this._cardDefs.get(ci.cardDefId)?.name ?? '?');
        const lost = [...this.localCardInst.values()]
          .filter(ci => !ci.attuned)
          .map(ci => this._cardDefs.get(ci.cardDefId)?.name ?? '?');
        this._showDeathOverlay(survived, lost);
      }

      if (row.alive) {
        const dx = row.posX - this.playerCircle.x;
        const dy = row.posY - this.playerCircle.y;
        if (dx * dx + dy * dy > 25) {
          this.targetX = row.posX;
          this.targetY = row.posY;
        }
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
      if (g) { g.destroy(); this.otherCircles.delete(row.characterId); }
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
    this.collectionPanel?.setSpiritLevel(row.level);
    this.spiritPanel?.setSpiritLevel(row.level);
    this.spiritPanel?.setSpiritName(row.name);
  }

  // ── Enemy table callbacks ──────────────────────────────────────────────────────

  private _onEnemyInsert(row: Enemy) {
    const bodyGfx = this.add.graphics();
    bodyGfx.fillStyle(0x8b0000, 1);
    bodyGfx.fillCircle(0, 0, ENEMY_R);
    bodyGfx.setPosition(row.posX, row.posY);
    bodyGfx.setDepth(1);

    const hpBarGfx         = this.add.graphics().setDepth(2);
    const castCircleGfx    = this.add.graphics().setDepth(0.5).setVisible(false);
    const castBarGfx       = this.add.graphics().setDepth(3).setVisible(false);
    const aggroIndicatorGfx = this.add.graphics().setDepth(2).setVisible(false);

    const data: EnemyGfx = {
      enemyId: row.enemyId,
      x: row.posX,
      y: row.posY,
      serverX: row.posX,
      serverY: row.posY,
      hp: row.currentHp,
      maxHp: row.maxHp,
      alive: row.alive,
      bodyGfx,
      hpBarGfx,
      castCircleGfx,
      castBarGfx,
      aggroIndicatorGfx,
      aggroState:      row.aggroState.tag as EnemyGfx['aggroState'],
      castStartedAtMs: row.castStartedAt
        ? Number(row.castStartedAt.microsSinceUnixEpoch) / 1000
        : null,
      castDurationMs: row.castDurationSeconds * 1000,
      castRadius:     row.attackRangePx,
    };
    this._drawEnemyHpBar(data);
    this.dbEnemies.set(row.enemyId, data);
  }

  private _onEnemyUpdate(old: Enemy, row: Enemy) {
    const data = this.dbEnemies.get(row.enemyId);
    if (!data) return;

    // Position is smoothed toward the new server value each frame in
    // _updateEnemyMovement rather than snapped here (see respawn handling below
    // for the one case — teleporting home — where we do want an instant snap).
    data.serverX = row.posX;
    data.serverY = row.posY;
    data.hp      = row.currentHp;
    data.alive   = row.alive;

    const dmg = old.currentHp - row.currentHp;
    if (dmg > 0) {
      this._drawEnemyHpBar(data);
      this._showFloatingDamage(data.x, data.y - ENEMY_R - 20, dmg, '#ff4444');
    }

    // ── Aggro/cast state transitions ────────────────────────────────────────────
    const wasCasting  = old.aggroState.tag === 'Casting';
    const nowCasting  = row.aggroState.tag === 'Casting';
    const nowCooldown = row.aggroState.tag === 'Cooldown';
    const nowIdle     = row.aggroState.tag === 'Idle';

    if (!wasCasting && nowCasting) {
      // → CASTING: show telegraph
      data.aggroState      = 'Casting';
      data.castStartedAtMs = row.castStartedAt
        ? Number(row.castStartedAt.microsSinceUnixEpoch) / 1000
        : Date.now();
      data.castDurationMs = row.castDurationSeconds * 1000;
      data.castCircleGfx.setVisible(true);
      data.castBarGfx.setVisible(true);
    } else if (wasCasting && nowCooldown) {
      // CASTING → COOLDOWN: flash and remove telegraph
      data.aggroState = 'Cooldown';
      data.castCircleGfx.clear();
      data.castCircleGfx.fillStyle(0xff0000, 0.6);
      data.castCircleGfx.fillCircle(data.x, data.y, data.castRadius);
      data.castBarGfx.clear();
      this.time.delayedCall(150, () => {
        data.castCircleGfx.clear();
        data.castCircleGfx.setVisible(false);
        data.castBarGfx.setVisible(false);
      });
    } else if (nowIdle && data.aggroState !== 'Idle') {
      // → IDLE
      data.aggroState      = 'Idle';
      data.castStartedAtMs = null;
      data.castCircleGfx.setVisible(false).clear();
      data.castBarGfx.setVisible(false).clear();
    } else {
      data.aggroState = row.aggroState.tag as EnemyGfx['aggroState'];
    }

    if (!row.alive && old.alive) {
      // Death: cancel telegraph, flash white and fade
      data.castCircleGfx.clear().setVisible(false);
      data.castBarGfx.clear().setVisible(false);
      data.aggroIndicatorGfx.clear().setVisible(false);
      data.aggroState = 'Idle';
      data.hpBarGfx.setVisible(false);
      data.bodyGfx.clear();
      data.bodyGfx.fillStyle(0xffffff, 1);
      data.bodyGfx.fillCircle(0, 0, ENEMY_R);
      this.tweens.add({
        targets: data.bodyGfx,
        alpha: 0,
        duration: 400,
        ease: 'Quad.easeIn',
        onComplete: () => data.bodyGfx.setVisible(false),
      });
    }

    if (row.alive && !old.alive) {
      // Respawn: teleport home instantly (no slide-in) and restore visuals
      data.x = data.serverX = row.posX;
      data.y = data.serverY = row.posY;
      data.aggroState       = 'Idle';
      data.castStartedAtMs  = null;
      data.castCircleGfx.clear().setVisible(false);
      data.castBarGfx.clear().setVisible(false);
      data.aggroIndicatorGfx.clear().setVisible(false);
      data.bodyGfx.setAlpha(1).setVisible(true);
      data.bodyGfx.clear();
      data.bodyGfx.fillStyle(0x8b0000, 1);
      data.bodyGfx.fillCircle(0, 0, ENEMY_R);
      data.bodyGfx.setPosition(row.posX, row.posY);
      data.hpBarGfx.setVisible(true);
      this._drawEnemyHpBar(data);
    }
  }

  private _onEnemyDelete(row: Enemy) {
    const data = this.dbEnemies.get(row.enemyId);
    if (data) {
      data.bodyGfx.destroy();
      data.hpBarGfx.destroy();
      data.castCircleGfx.destroy();
      data.castBarGfx.destroy();
      data.aggroIndicatorGfx.destroy();
      this.dbEnemies.delete(row.enemyId);
    }
  }

  /** Smoothly steps each enemy's rendered position toward its server-authoritative
   *  position, repositions its GameObjects, and shows/hides the chase indicator. */
  private _updateEnemyMovement(delta: number) {
    for (const data of this.dbEnemies.values()) {
      if (!data.alive) continue;

      const dx   = data.serverX - data.x;
      const dy   = data.serverY - data.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.5) {
        const step = ENEMY_LERP_SPEED * (delta / 1000);
        if (step >= dist) {
          data.x = data.serverX;
          data.y = data.serverY;
        } else {
          data.x += (dx / dist) * step;
          data.y += (dy / dist) * step;
        }
      }

      data.bodyGfx.setPosition(data.x, data.y);
      this._drawEnemyHpBar(data);

      data.aggroIndicatorGfx.clear();
      if (data.aggroState === 'Chasing') {
        data.aggroIndicatorGfx.setVisible(true);
        const ix = data.x;
        const iy = data.y - ENEMY_R - 32;
        data.aggroIndicatorGfx.lineStyle(2, 0xff2222, 0.9);
        data.aggroIndicatorGfx.beginPath();
        data.aggroIndicatorGfx.moveTo(ix - 6, iy + 5);
        data.aggroIndicatorGfx.lineTo(ix, iy - 5);
        data.aggroIndicatorGfx.lineTo(ix + 6, iy + 5);
        data.aggroIndicatorGfx.strokePath();
      } else {
        data.aggroIndicatorGfx.setVisible(false);
      }
    }
  }

  // ── Card definition callbacks ─────────────────────────────────────────────────

  private _onCardDefRow(row: CardDefinition) {
    this._cardDefs.set(row.cardDefId, row);
    this.collectionPanel?.onCardDefInsert(row);
    this.spiritPanel?.onCardDefInsert(row);
    if (row.slug === 'ember-strike') {
      this.emberDef    = row;
      this.emberDamage = row.basePower;
      this.emberMpCost = row.mpCost;
      this.emberCast.setCooldown(row.baseCooldown * 1000);
      this.slot1Label?.setText(row.name);
    }
  }

  // ── Cast controllers ──────────────────────────────────────────────────────────

  private _createCasts() {
    this.emberCast = new CastController(this, {
      key:            'ONE',
      range:          EMBER_RANGE,
      halfAngle:      EMBER_HALF_ANG,
      indicatorColor: 0xff7700,
      cooldown:       1200,   // default until card_definition row arrives
      mpCost:         this.emberMpCost,
      slotX:          this.slot1X,
      slotY:          this.slot1Y,
      getPlayerPos:   () => ({ x: this.playerCircle.x, y: this.playerCircle.y }),
      isAlive:        () => !!this.localCharacter?.alive,
      hasMp:          () => this.clientMp >= this.emberMpCost,
      spendMp:        () => { this.clientMp -= this.emberMpCost; },
      onFire:         (nx, ny) => this._executeEmberStrike(nx, ny),
    });
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  private _setupInput() {
    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      if (!this.localCharacter?.alive) return;

      this.emberCast.cancelIfHolding();

      let dest = this._resolveClickTarget(pointer.worldX, pointer.worldY);
      dest = this._clampWalkable(dest.x, dest.y);
      this.targetX = dest.x;
      this.targetY = dest.y;

      callReducer('move', () =>
        this.conn.reducers.move({ x: dest.x, y: dest.y }),
      );
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) return;
      if (!this.localCharacter?.alive) return;
      this._fireBasicAttack(pointer.worldX, pointer.worldY);
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-F', () => {
      if (this.nearDropId != null) {
        const entry = this.worldDrops.get(this.nearDropId);
        const def   = entry ? this._cardDefs.get(entry.dropRow.cardDefId) : null;
        callReducer('pickup_card', () =>
          this.conn.reducers.pickupCard({ dropId: this.nearDropId! }),
        );
        this._showToast(def ? `Picked up: ${def.name}` : 'Picked up card');
      }
    });
    kb.on('keydown-E', () => {
      if (this.nearSpirit) {
        this.spiritPanel.open();
      } else {
        this._showToast('You must be near a spirit to manage your hand.');
      }
    });
    kb.on('keydown-C', () => this.collectionPanel.toggle());
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────

  private _showToast(message: string) {
    const W = this.cameras.main.width;
    const txt = this.add
      .text(W / 2, 100, message, {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setAlpha(0);

    this.tweens.add({
      targets: txt,
      alpha: 1,
      duration: 150,
      yoyo: true,
      hold: 1600,
      onComplete: () => txt.destroy(),
    });
  }

  // ── Tile collision helpers ────────────────────────────────────────────────────

  private _isSolid(worldX: number, worldY: number): boolean {
    const R = PLAYER_R + 2;
    return this._tileSolid(worldX - R, worldY)
        || this._tileSolid(worldX + R, worldY)
        || this._tileSolid(worldX, worldY - R)
        || this._tileSolid(worldX, worldY + R);
  }

  private _tileSolid(worldX: number, worldY: number): boolean {
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    return MAP_DATA[ty][tx] === TILE_STONE;
  }

  private _clampWalkable(tx: number, ty: number): { x: number; y: number } {
    if (!this._isSolid(tx, ty)) return { x: tx, y: ty };

    const px = this.playerCircle.x;
    const py = this.playerCircle.y;
    const dx = tx - px;
    const dy = ty - py;

    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      if (this._isSolid(px + dx * mid, py + dy * mid)) hi = mid;
      else lo = mid;
    }
    return { x: px + dx * lo, y: py + dy * lo };
  }

  // ── Movement helpers ──────────────────────────────────────────────────────────

  private _resolveClickTarget(clickX: number, clickY: number): { x: number; y: number } {
    for (const data of this.dbEnemies.values()) {
      if (!data.alive) continue;
      const dx = clickX - data.x;
      const dy = clickY - data.y;
      if (dx * dx + dy * dy < STOP_RADIUS * STOP_RADIUS) {
        const pdx = data.x - this.playerCircle.x;
        const pdy = data.y - this.playerCircle.y;
        const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pDist <= STOP_RADIUS) return { x: this.playerCircle.x, y: this.playerCircle.y };
        return {
          x: data.x - (pdx / pDist) * STOP_RADIUS,
          y: data.y - (pdy / pDist) * STOP_RADIUS,
        };
      }
    }
    return { x: clickX, y: clickY };
  }

  // ── Cast telegraph ────────────────────────────────────────────────────────────

  private _updateCastTelegraphs() {
    const now = this.time.now;
    for (const [, data] of this.dbEnemies) {
      if (data.aggroState !== 'Casting' || data.castStartedAtMs === null) continue;

      const elapsed  = Date.now() - data.castStartedAtMs;
      const fraction = Math.min(elapsed / data.castDurationMs, 1.0);
      const pulse    = 1.0 + 0.04 * Math.sin((now / 300) * Math.PI);
      const r        = data.castRadius * pulse;

      data.castCircleGfx.clear();
      data.castCircleGfx.fillStyle(0xff2222, 0.12);
      data.castCircleGfx.fillCircle(data.x, data.y, r);
      data.castCircleGfx.lineStyle(2, 0xff2222, 0.85);
      data.castCircleGfx.strokeCircle(data.x, data.y, r);

      this._drawCastBar(data, fraction);
    }
  }

  private _drawCastBar(data: EnemyGfx, fraction: number) {
    const remaining = 1.0 - fraction;
    const W = 48, H = 4;
    const bx = data.x - W / 2;
    const by = data.y - ENEMY_R - 26;

    // White (remaining=1) → red (remaining=0)
    const gb       = Math.round(255 * remaining);
    const barColor = (0xff << 16) | (gb << 8) | gb;

    data.castBarGfx.clear();
    data.castBarGfx.fillStyle(0x222222, 0.85);
    data.castBarGfx.fillRect(bx, by, W, H);
    if (remaining > 0.001) {
      data.castBarGfx.fillStyle(barColor, 1);
      data.castBarGfx.fillRect(bx, by, W * remaining, H);
    }
  }

  // ── Player hit feedback ───────────────────────────────────────────────────────

  private _showPlayerHitFeedback(damage: number) {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    const vignette = this.add.graphics().setScrollFactor(0).setDepth(16);
    vignette.fillStyle(0xff0000, 0.35);
    vignette.fillRect(0, 0, W, H);
    this.tweens.add({
      targets: vignette,
      alpha: 0,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => vignette.destroy(),
    });

    const px  = this.playerCircle.x;
    const py  = this.playerCircle.y;
    const txt = this.add
      .text(px, py - PLAYER_R - 10, `-${damage}`, {
        fontSize: '18px',
        color: '#ff4444',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.tweens.add({
      targets: txt,
      y: py - PLAYER_R - 50,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  // ── Enemy HP bar ──────────────────────────────────────────────────────────────

  private _drawEnemyHpBar(data: EnemyGfx) {
    const W = 48, H = 6;
    const bx = data.x - W / 2;
    const by = data.y - ENEMY_R - 14;
    data.hpBarGfx.clear();
    data.hpBarGfx.fillStyle(0x333333, 1);
    data.hpBarGfx.fillRect(bx, by, W, H);
    if (data.hp > 0) {
      data.hpBarGfx.fillStyle(0xff3333, 1);
      data.hpBarGfx.fillRect(bx, by, W * (data.hp / data.maxHp), H);
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
        for (const [, data] of this.dbEnemies) {
          if (!data.alive) continue;
          if (this._inCone(data.x, data.y, ox, oy, nx, ny, ATTACK_RANGE, ATTACK_HALF_ANG)) {
            callReducer('damageEnemy', () =>
              this.conn.reducers.damageEnemy({
                enemyId: data.enemyId,
                damage:  ATTACK_DAMAGE,
                school:  { tag: 'Physical' },
              }),
            );
            hitAny = true;
          }
        }
        if (hitAny) this.cameras.main.shake(100, 0.002);
      },
    });
  }

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
      duration: (EMBER_RANGE / 400) * 1000,
      ease: 'Linear',
      onComplete: () => {
        proj.destroy();
        let hitAny = false;
        for (const [, data] of this.dbEnemies) {
          if (!data.alive) continue;
          if (this._inCone(data.x, data.y, ox, oy, nx, ny, EMBER_RANGE, EMBER_HALF_ANG)) {
            callReducer('damageEnemy', () =>
              this.conn.reducers.damageEnemy({
                enemyId: data.enemyId,
                damage:  Math.round(this.emberDamage),
                school:  this.emberDef?.scalingSchool ?? { tag: 'Physical' as const },
              }),
            );
            this._emberBurnFlash(data);
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

  private _emberBurnFlash(data: EnemyGfx) {
    const flash = this.add.graphics();
    flash.fillStyle(0xff6600, 0.7);
    flash.fillCircle(0, 0, ENEMY_R + 6);
    flash.setPosition(data.x, data.y);
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
      .text(x, y, `-${amount}`, {
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

  // ── Death overlay ─────────────────────────────────────────────────────────────

  private _createDeathOverlay() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.deathOverlay = this.add.graphics()
      .setScrollFactor(0)
      .setDepth(20);
    this.deathOverlay.fillStyle(0x000000, 0.72);
    this.deathOverlay.fillRect(0, 0, W, H);
    this.deathOverlay.setVisible(false);

    this.deathText = this.add
      .text(W / 2, H / 2 - 50, 'YOU DIED', {
        fontSize: '72px',
        color: '#cc2222',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setVisible(false);

    this.returnBtn = this.add
      .text(W / 2, H / 2 + 60, '[ RETURN ]', {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'monospace',
        backgroundColor: '#1a1a2e',
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    this.returnBtn.on('pointerover',  () => this.returnBtn.setColor('#ffcc44'));
    this.returnBtn.on('pointerout',   () => this.returnBtn.setColor('#ffffff'));
    this.returnBtn.on('pointerdown',  () => {
      this.returnBtn.setVisible(false);
      callReducer('startLife', () =>
        this.conn.reducers.startLife({ spiritName: 'your spirit', startZoneId: 1 }),
      );
    });
  }

  private _showDeathOverlay(survived: string[] = [], lost: string[] = []) {
    this.isDead = true;
    this.emberCast.cancelIfHolding();
    this.moveLine.clear();
    this.collectionPanel.close();
    this.spiritPanel.close();
    this.deathOverlay.setVisible(true);

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const lines = [
      survived.length ? `Survived (attuned): ${survived.join(', ')}` : 'No cards were attuned.',
      lost.length     ? `Lost: ${lost.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    this.deathSummaryText = this.add
      .text(W / 2, H / 2 - 140, lines, {
        fontSize: '13px', color: '#aaaaaa', fontFamily: 'monospace',
        align: 'center', lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21);
    this.time.delayedCall(3500, () => {
      if (this.deathSummaryText) {
        this.tweens.add({
          targets: this.deathSummaryText, alpha: 0, duration: 500,
          onComplete: () => { this.deathSummaryText?.destroy(); this.deathSummaryText = null; },
        });
      }
    });

    this.deathText.setVisible(true);
    this.time.delayedCall(2000, () => {
      if (this.isDead) this.returnBtn.setVisible(true);
    });
  }

  private _hideDeathOverlay() {
    this.isDead = false;
    this.deathSummaryText?.destroy();
    this.deathSummaryText = null;
    this.deathOverlay.setVisible(false);
    this.deathText.setVisible(false);
    this.returnBtn.setVisible(false);
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

    this.slot1X = ax;
    this.slot1Y = activeY;

    const g = this.add.graphics().setScrollFactor(0).setDepth(10);
    g.lineStyle(2, 0xffffff, 0.35);
    for (let i = 0; i < activeCount; i++) {
      g.strokeRect(ax + i * (CARD_SW + CARD_GAP), activeY, CARD_SW, CARD_SH);
    }
    for (let i = 0; i < passiveCount; i++) {
      g.strokeRect(px + i * (CARD_SW + CARD_GAP), passiveY, CARD_SW, CARD_SH);
    }

    const art = this.add.graphics().setScrollFactor(0).setDepth(10);
    art.fillStyle(0xc43a08, 1);
    art.fillRect(ax + 2, activeY + 2, CARD_SW - 4, CARD_SH - 4);

    this.slot1Label = this.add
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

      if (hp > 0) this.hudBars.fillStyle(0xef5350, 1).fillRect(X, 12, BAR_W * (hp / mhp), BAR_H);
      if (mp > 0) this.hudBars.fillStyle(0x42a5f5, 1).fillRect(X, 38, BAR_W * (mp / mmp), BAR_H);

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

  // ── Card drops ────────────────────────────────────────────────────────────────

  private _onDropInsert(row: CardDrop) {
    const def    = this._cardDefs.get(row.cardDefId);
    const rarity = def ? _rarityTag(def.rarity) : 'Common';
    const color  = DROP_COLORS[rarity] ?? 0xcccccc;

    const gfx = this.add.graphics().setDepth(1);
    gfx.fillStyle(color, 0.9);
    gfx.fillCircle(row.posX, row.posY, 8);
    gfx.lineStyle(1.5, 0xffffff, 0.5);
    gfx.strokeCircle(row.posX, row.posY, 8);
    this.tweens.add({
      targets: gfx,
      alpha: { from: 0.5, to: 1.0 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const label = this.add
      .text(row.posX, row.posY - 18, 'F', {
        fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
        backgroundColor: '#00000099',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(3)
      .setVisible(false);

    this.worldDrops.set(row.dropId, { dropRow: row, gfx, label });
  }

  private _onDropDelete(row: CardDrop) {
    const entry = this.worldDrops.get(row.dropId);
    if (entry) {
      this.tweens.killTweensOf(entry.gfx);
      entry.gfx.destroy();
      entry.label.destroy();
      this.worldDrops.delete(row.dropId);
    }
  }

  // ── Proximity update ──────────────────────────────────────────────────────────

  private _updateProximity() {
    if (!this.localCharacter?.alive) return;

    const px = this.playerCircle.x;
    const py = this.playerCircle.y;

    // Spirit
    const sdx = px - SPIRIT_X;
    const sdy = py - SPIRIT_Y;
    const nearSpirit = sdx * sdx + sdy * sdy < SPIRIT_PROX_R * SPIRIT_PROX_R;
    if (nearSpirit !== this.nearSpirit) {
      this.nearSpirit = nearSpirit;
      this.collectionPanel.setNearSpirit(nearSpirit);
      this.spiritPanel.setNearSpirit(nearSpirit);
      this.spiritLabel.setVisible(nearSpirit);
      if (!nearSpirit) this.spiritPanel.close();
    }

    // Drops
    let closestId: bigint | null = null;
    let closestD2 = DROP_PICKUP_R * DROP_PICKUP_R;
    for (const [id, { dropRow }] of this.worldDrops) {
      const dx = px - dropRow.posX;
      const dy = py - dropRow.posY;
      const d2 = dx * dx + dy * dy;
      if (d2 < closestD2) { closestD2 = d2; closestId = id; }
    }
    this.nearDropId = closestId;
    for (const [id, { label }] of this.worldDrops) {
      label.setVisible(id === closestId);
    }
  }

  // ── Collection panel action handler ───────────────────────────────────────────

  private _onPanelAction(action: string, payload: Record<string, unknown>) {
    switch (action) {
      case 'equip':
        callReducer('equip_card', () =>
          this.conn.reducers.equipCard({
            cardInstanceId: payload.cardInstanceId as bigint,
            slotType:       { tag: (payload.slotType as string) === 'active' ? 'Active' : 'Passive' },
            slotIndex:      payload.slotIndex as number,
          }),
        );
        break;
      case 'unequip':
        callReducer('unequip_card', () =>
          this.conn.reducers.unequipCard({ equippedCardId: payload.equippedCardId as bigint }),
        );
        break;
      case 'attune':
      case 'unattune':
        callReducer('toggle_attune', () =>
          this.conn.reducers.toggleAttune({ cardInstanceId: payload.cardInstanceId as bigint }),
        );
        break;
      case 'sacrifice':
        callReducer('sacrifice_card', () =>
          this.conn.reducers.sacrificeCard({ cardInstanceId: payload.cardInstanceId as bigint }),
        );
        break;
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
