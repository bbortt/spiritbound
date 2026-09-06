// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import type {
  Character,
  ItemDefinition,
  ItemInstance,
  EquippedItem,
  StatBlock,
} from '../db';
import { RACE_BASE, computeEffectiveStats } from '../effectiveStats';
import { BODY_SLOTS, findEquippedInSlot } from '../paperDoll';

const RARITY_COLOR: Record<string, string> = {
  Common: '#aaaaaa',
  Uncommon: '#44cc44',
  Rare: '#4488ff',
  Epic: '#cc44ff',
  Legendary: '#ffcc00',
};

const ARMOR_TINT: Record<string, string> = {
  Cloth: '#a066ff',
  Chain: '#22cccc',
  Plate: '#999999',
};

const PERCENT_FIELDS = new Set<keyof StatBlock>([
  'evasion',
  'parry',
  'block',
  'magicResist',
  'physicalCrit',
  'magicCrit',
]);
const MULTIPLIER_FIELDS = new Set<keyof StatBlock>([
  'moveSpeed',
  'attackSpeed',
  'castingSpeed',
  'healingBoost',
]);

const PRIMARY_FIELDS: (keyof StatBlock)[] = [
  'power',
  'knowledge',
  'health',
  'will',
  'agility',
  'precision',
];
const OFFENSIVE_FIELDS: (keyof StatBlock)[] = [
  'weaponDamage',
  'physicalAttack',
  'magicAttack',
  'attackSpeed',
  'castingSpeed',
  'physicalCrit',
  'magicCrit',
  'accuracy',
  'magicAccuracy',
  'healingBoost',
];
const DEFENSIVE_FIELDS: (keyof StatBlock)[] = [
  'physicalDef',
  'magicDef',
  'evasion',
  'parry',
  'block',
  'magicResist',
];

const STAT_LABEL: Record<keyof StatBlock, string> = {
  power: 'Power',
  knowledge: 'Knowledge',
  health: 'Health',
  will: 'Will',
  agility: 'Agility',
  precision: 'Precision',
  maxHp: 'Max HP',
  hpRegen: 'HP Regen',
  maxMp: 'Max MP',
  mpRegen: 'MP Regen',
  moveSpeed: 'Move Speed',
  weaponDamage: 'Weapon Damage',
  physicalAttack: 'Physical Attack',
  magicAttack: 'Magic Attack',
  attackSpeed: 'Attack Speed',
  castingSpeed: 'Casting Speed',
  physicalCrit: 'Physical Crit',
  magicCrit: 'Magic Crit',
  accuracy: 'Accuracy',
  magicAccuracy: 'Magic Accuracy',
  healingBoost: 'Healing Boost',
  physicalDef: 'Physical Def',
  magicDef: 'Magic Def',
  evasion: 'Evasion',
  parry: 'Parry',
  block: 'Block',
  magicResist: 'Magic Resist',
};

// One-liners mirror the field comments in spacetimedb/src/types.ts.
const STAT_DESC: Record<keyof StatBlock, string> = {
  power: 'Primary attribute — feeds Physical Attack.',
  knowledge: 'Primary attribute — feeds Magic Attack.',
  health: 'Primary attribute — feeds Max HP and HP Regen.',
  will: 'Primary attribute — feeds Max MP, MP Regen, Magic Resist, Healing Boost.',
  agility: 'Primary attribute — feeds Evasion, Parry, Attack Speed.',
  precision: 'Primary attribute — feeds Accuracy, Magic Accuracy, Crit.',
  maxHp: 'Maximum health. At 0 HP you die — permadeath.',
  hpRegen: 'HP restored per tick while out of combat.',
  maxMp: 'Maximum mana. Active cards cost MP to cast.',
  mpRegen: 'MP restored per tick.',
  moveSpeed: 'Movement speed multiplier (1.0 = base).',
  weaponDamage: 'Weapon-only base damage for a bare weapon swing.',
  physicalAttack: 'Increases physical-school card damage.',
  magicAttack: 'Increases magic-school card damage (and healing).',
  attackSpeed: 'Basic attack speed multiplier — higher is faster.',
  castingSpeed: 'Card cast speed multiplier — higher is faster.',
  physicalCrit: 'Chance for a physical hit to crit for extra damage.',
  magicCrit: 'Chance for a magic hit to crit for extra damage.',
  accuracy: "Counters the target's evasion/parry on a physical hit.",
  magicAccuracy: "Counters the target's magic resist on a magic hit.",
  healingBoost: 'Multiplier on healing-card output.',
  physicalDef: 'Flat mitigation against physical damage.',
  magicDef: 'Flat mitigation against magic damage.',
  evasion:
    'Glancing-blow chance on a connected physical hit (partial reduction, capped).',
  parry: 'Reduces a connected physical hit, capped.',
  block: "Off-hand shield's damage reduction.",
  magicResist: 'Resists connected magic damage and secondary effects, capped.',
};

function fmtTotal(key: keyof StatBlock, value: number): string {
  if (PERCENT_FIELDS.has(key)) return `${Math.round(value * 100)}%`;
  if (MULTIPLIER_FIELDS.has(key)) return `${value.toFixed(2)}×`;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function rarityTag(v: unknown): string {
  return String((v as any)?.tag ?? v);
}

const CSS = `
.sb-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 1050; display: none; align-items: center; justify-content: center;
}
.sb-modal-overlay.open { display: flex; }
.sb-modal {
  width: 760px; max-width: 92vw; max-height: 88vh; overflow-y: auto;
  background: rgba(12,12,20,0.98); border: 1px solid #444; border-radius: 8px;
  color: #ccc; font-family: 'Segoe UI', sans-serif; font-size: 13px;
  padding: 18px; box-sizing: border-box; user-select: none;
}
.sb-sheet-cols { display: flex; gap: 24px; }
.sb-sheet-left { flex: 0 0 250px; }
.sb-sheet-right { flex: 1; min-width: 0; }
.sb-body-grid {
  display: grid;
  grid-template-columns: 72px 72px 72px;
  grid-template-rows: repeat(7, 54px);
  grid-template-areas:
    "off   .     main"
    "ear0  head  ear1"
    ".     neck  ."
    ".     chest ."
    "ring0 hands ring1"
    ".     legs  ."
    ".     boots .";
  gap: 6px; justify-content: center; margin-top: 8px;
}
.sb-body-slot {
  border-radius: 6px; border: 1px dashed #444;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 9px; color: #555; cursor: pointer; position: relative; text-align: center; padding: 2px;
  background: #0d0d15;
}
.sb-body-slot:hover { border-color: #999; }
.sb-body-slot.filled { border-style: solid; color: #eee; }
.sb-body-slot .sb-armor-badge { position: absolute; top: 2px; right: 2px; width: 8px; height: 8px; border-radius: 50%; }
.sb-body-slot .sb-slot-item-name { font-size: 9px; line-height: 1.2; font-weight: 600; padding: 0 2px; }
.sb-char-header { font-size: 13px; margin-bottom: 4px; }
.sb-char-header b { color: #fff; }
.sb-hp-mp { font-size: 12px; margin-top: 6px; }
.sb-hp-mp .hp { color: #ef5350; }
.sb-hp-mp .mp { color: #42a5f5; }
.sb-stat-group { margin-bottom: 14px; }
.sb-stat-group-title {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  color: #888; text-transform: uppercase; margin-bottom: 6px;
  border-bottom: 1px solid #333; padding-bottom: 3px;
}
.sb-stat-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; cursor: help; }
.sb-stat-row .sb-stat-base { color: #888; }
.sb-stat-row .sb-stat-bonus { color: #ffcc00; }
`;

export class CharacterSheet {
  private overlay: HTMLDivElement;
  private modal: HTMLDivElement;
  private _open = false;

  private _character: Character | null = null;
  private _spiritLevel = 1;

  private _defs = new Map<bigint, ItemDefinition>();
  private _instances = new Map<bigint, ItemInstance>();
  private _equipped = new Map<bigint, EquippedItem>(); // key = equippedItemId

  constructor() {
    if (!document.getElementById('sb-charsheet-css')) {
      const style = document.createElement('style');
      style.id = 'sb-charsheet-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'sb-charsheet-overlay';
    this.overlay.className = 'sb-modal-overlay';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.body.appendChild(this.overlay);

    this.modal = document.createElement('div');
    this.modal.className = 'sb-modal';
    this.overlay.appendChild(this.modal);

    this._render();
  }

  open() {
    this._open = true;
    this.overlay.classList.add('open');
    this._render();
  }
  close() {
    this._open = false;
    this.overlay.classList.remove('open');
  }
  toggle() {
    this._open ? this.close() : this.open();
  }
  isOpen() {
    return this._open;
  }

  // ── State setters ──────────────────────────────────────────────────────────

  setCharacter(row: Character) {
    this._character = row;
    if (this._open) this._render();
  }

  setSpiritLevel(level: number) {
    this._spiritLevel = level;
    if (this._open) this._render();
  }

  onItemDefRow(def: ItemDefinition) {
    this._defs.set(def.itemDefId, def);
    if (this._open) this._render();
  }

  onInstanceInsert(row: ItemInstance) {
    this._instances.set(row.itemInstanceId, row);
    if (this._open) this._render();
  }

  onInstanceDelete(row: ItemInstance) {
    this._instances.delete(row.itemInstanceId);
    if (this._open) this._render();
  }

  onEquippedInsert(row: EquippedItem) {
    this._equipped.set(row.equippedItemId, row);
    if (this._open) this._render();
  }

  onEquippedDelete(row: EquippedItem) {
    this._equipped.delete(row.equippedItemId);
    if (this._open) this._render();
  }

  // ── Effective stats (mirrors rules/stats.ts#computeEffectiveStats) ──────────

  private _equippedDefs(): ItemDefinition[] {
    const defs: ItemDefinition[] = [];
    for (const eq of this._equipped.values()) {
      const inst = this._instances.get(eq.itemInstanceId);
      if (!inst) continue;
      const def = this._defs.get(inst.itemDefId);
      if (def) defs.push(def);
    }
    return defs;
  }

  private _effectiveStats(): StatBlock {
    return computeEffectiveStats(this._equippedDefs());
  }

  private _gearBonus(): StatBlock {
    const total = this._effectiveStats();
    const bonus = { ...total };
    for (const key of Object.keys(bonus) as (keyof StatBlock)[]) {
      (bonus as any)[key] = total[key] - RACE_BASE[key];
    }
    return bonus;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private _render() {
    this.modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:16px;font-weight:700;color:#fff">Character Sheet</span>
        <span style="cursor:pointer;color:#888;font-size:18px" id="sb-sheet-close">✕</span>
      </div>
      <div class="sb-sheet-cols">
        <div class="sb-sheet-left">
          ${this._renderHeader()}
          <div class="sb-body-grid">${BODY_SLOTS.map((s) => this._renderBodySlot(...s)).join('')}</div>
        </div>
        <div class="sb-sheet-right">${this._renderStats()}</div>
      </div>
    `;
    this.modal
      .querySelector('#sb-sheet-close')
      ?.addEventListener('click', () => this.close());
    this._attachSlotListeners();
  }

  private _renderHeader(): string {
    const c = this._character;
    const total = this._effectiveStats();
    const hp = c?.currentHp ?? total.maxHp;
    const mp = c?.currentMp ?? total.maxMp;
    return `
      <div class="sb-char-header">Level <b>${c?.level ?? 1}</b> &nbsp;|&nbsp; Spirit Lv <b>${this._spiritLevel}</b></div>
      <div class="sb-hp-mp"><span class="hp">HP: ${hp}/${total.maxHp}</span> &nbsp; <span class="mp">MP: ${mp}/${total.maxMp}</span></div>
    `;
  }

  private _renderBodySlot(
    slotTag: string,
    ordinal: number,
    gridArea: string,
    placeholder: string,
  ): string {
    const eq = findEquippedInSlot(
      [...this._equipped.values()],
      slotTag,
      ordinal,
    );
    if (!eq) {
      return `<div class="sb-body-slot" style="grid-area:${gridArea}" data-empty-slot="${slotTag}">${placeholder}</div>`;
    }
    const inst = this._instances.get(eq.itemInstanceId);
    const def = inst ? this._defs.get(inst.itemDefId) : null;
    if (!def) {
      return `<div class="sb-body-slot" style="grid-area:${gridArea}" data-empty-slot="${slotTag}">${placeholder}</div>`;
    }
    const rarity = rarityTag(def.rarity);
    const color = RARITY_COLOR[rarity] ?? '#aaa';
    const armor = def.armorWeight ? rarityTag(def.armorWeight) : null;
    return `<div class="sb-body-slot filled" style="grid-area:${gridArea};border-color:${color};background:${color}22"
                 data-equipped-id="${eq.equippedItemId}" title="Click to unequip ${def.name}">
      ${armor ? `<div class="sb-armor-badge" style="background:${ARMOR_TINT[armor] ?? '#666'}"></div>` : ''}
      <div class="sb-slot-item-name" style="color:${color}">${def.name}</div>
    </div>`;
  }

  private _renderStats(): string {
    const total = this._effectiveStats();
    const bonus = this._gearBonus();
    return `
      <div class="sb-stat-group">
        <div class="sb-stat-group-title">Attributes</div>
        ${PRIMARY_FIELDS.map(
          (k) => `
          <div class="sb-stat-row" title="${STAT_DESC[k]}">
            <span>${STAT_LABEL[k]}</span>
            <span><span class="sb-stat-base">${RACE_BASE[k]}</span> ${bonus[k] !== 0 ? `<span class="sb-stat-bonus">(+${bonus[k]})</span>` : ''} = <b>${total[k]}</b></span>
          </div>`,
        ).join('')}
      </div>
      <div class="sb-stat-group">
        <div class="sb-stat-group-title">Offensive</div>
        ${OFFENSIVE_FIELDS.map(
          (k) => `
          <div class="sb-stat-row" title="${STAT_DESC[k]}">
            <span>${STAT_LABEL[k]}</span><span>${fmtTotal(k, total[k])}</span>
          </div>`,
        ).join('')}
      </div>
      <div class="sb-stat-group">
        <div class="sb-stat-group-title">Defensive</div>
        ${DEFENSIVE_FIELDS.map(
          (k) => `
          <div class="sb-stat-row" title="${STAT_DESC[k]}">
            <span>${STAT_LABEL[k]}</span><span>${fmtTotal(k, total[k])}</span>
          </div>`,
        ).join('')}
      </div>
    `;
  }

  // ── Event delegation ───────────────────────────────────────────────────────

  private _attachSlotListeners() {
    this.modal
      .querySelectorAll<HTMLElement>('[data-equipped-id]')
      .forEach((el) => {
        const id = BigInt(el.dataset.equippedId!);
        el.addEventListener('click', () =>
          this._emit('unequipItem', { equippedItemId: id }),
        );
      });
    this.modal
      .querySelectorAll<HTMLElement>('[data-empty-slot]')
      .forEach((el) => {
        const slot = el.dataset.emptySlot!;
        el.addEventListener('click', () => this._emit('browseSlot', { slot }));
      });
  }

  // ── Simple event bus (mirrors CollectionPanel/InventoryPanel) ───────────────

  onAction?: (action: string, payload: Record<string, unknown>) => void;

  private _emit(action: string, payload: Record<string, unknown>) {
    this.onAction?.(action, payload);
  }
}
