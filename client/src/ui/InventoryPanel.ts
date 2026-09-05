import type {
  ItemDefinition,
  ItemInstance,
  EquippedItem,
  StatBlock,
} from '../db';
import { decideEquipAction } from '../equipDecision';

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

const SLOT_ICON: Record<string, string> = {
  Head: '🪖',
  Chest: '🛡',
  Hands: '🧤',
  Legs: '👖',
  Boots: '👢',
  MainHand: '⚔',
  OffHand: '🔯',
  Necklace: '📿',
  Ring: '💍',
  Earring: '💎',
};

// Rate-like stats read as "multiplier delta" — shown as a percentage of the delta.
const PERCENT_STATS = new Set<keyof StatBlock>([
  'moveSpeed',
  'attackSpeed',
  'castingSpeed',
  'physicalCrit',
  'magicCrit',
  'evasion',
  'parry',
  'block',
  'magicResist',
  'healingBoost',
]);

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
  weaponDamage: 'Weapon Dmg',
  physicalAttack: 'Phys Atk',
  magicAttack: 'Mag Atk',
  attackSpeed: 'Atk Speed',
  castingSpeed: 'Cast Speed',
  physicalCrit: 'Phys Crit',
  magicCrit: 'Mag Crit',
  accuracy: 'Accuracy',
  magicAccuracy: 'Mag Accuracy',
  healingBoost: 'Healing',
  physicalDef: 'Phys Def',
  magicDef: 'Mag Def',
  evasion: 'Evasion',
  parry: 'Parry',
  block: 'Block',
  magicResist: 'Mag Resist',
};

// Priority order for picking the single "key stat" shown on a bag cell.
const PREVIEW_PRIORITY: (keyof StatBlock)[] = [
  'weaponDamage',
  'physicalAttack',
  'magicAttack',
  'physicalDef',
  'magicDef',
  'maxHp',
  'maxMp',
  'evasion',
  'moveSpeed',
  'healingBoost',
  'magicResist',
  'accuracy',
  'magicAccuracy',
  'physicalCrit',
  'magicCrit',
  'attackSpeed',
  'castingSpeed',
  'parry',
  'block',
  'hpRegen',
  'mpRegen',
  'power',
  'knowledge',
  'health',
  'will',
  'agility',
  'precision',
];

function fmtStat(key: keyof StatBlock, value: number): string {
  const sign = value >= 0 ? '+' : '';
  if (PERCENT_STATS.has(key)) return `${sign}${Math.round(value * 100)}%`;
  if (Number.isInteger(value)) return `${sign}${value}`;
  return `${sign}${value.toFixed(1)}`;
}

function nonZeroStats(stats: StatBlock): [keyof StatBlock, number][] {
  return (Object.keys(stats) as (keyof StatBlock)[])
    .filter((k) => stats[k] !== 0)
    .map((k) => [k, stats[k]]);
}

function rarityTag(v: unknown): string {
  return String((v as any)?.tag ?? v);
}

// Base .sb-panel/.sb-grid rules are shared with CollectionPanel (same #sb-panel-css id,
// injected idempotently by whichever panel constructs first) — only the left-slide
// variant and item-specific classes are unique to this file.
const BASE_CSS = `
.sb-panel {
  position: fixed;
  top: 0; right: -420px;
  width: 400px; height: 100vh;
  background: rgba(10,10,20,0.96);
  border-left: 1px solid #333;
  color: #ccc;
  font-family: 'Segoe UI', sans-serif;
  font-size: 13px;
  overflow-y: auto;
  transition: right 0.25s ease, left 0.25s ease;
  z-index: 1000;
  box-sizing: border-box;
  padding: 12px;
  user-select: none;
}
.sb-panel.open { right: 0; }
.sb-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
`;

const CSS = `
.sb-panel.from-left { left: -420px; right: auto; border-left: none; border-right: 1px solid #333; }
.sb-panel.from-left.open { left: 0; }
.sb-item-cell {
  width: 100%; aspect-ratio: 3/4;
  border: 2px solid #333; border-radius: 4px;
  display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  font-size: 9px; text-align: center; padding: 4px; cursor: pointer;
  background: #111; position: relative; overflow: hidden;
}
.sb-item-cell:hover { border-color: #fff; }
.sb-item-cell.equipped { outline: 2px solid #ffcc00; }
.sb-item-icon { font-size: 16px; }
.sb-item-name { font-size: 9px; line-height: 1.2; font-weight: 600; }
.sb-item-stat { font-size: 9px; color: #9f9; }
.sb-armor-badge {
  position: absolute; top: 2px; left: 2px;
  width: 10px; height: 10px; border-radius: 50%;
}
.sb-equipped-badge {
  position: absolute; bottom: 2px; right: 2px;
  font-size: 7px; padding: 1px 3px; border-radius: 2px;
  background: #ffcc0033; color: #ffcc00; border: 1px solid #ffcc0088;
}
.sb-hover-tooltip {
  position: fixed; z-index: 1100; max-width: 240px;
  padding: 8px 10px; border-radius: 4px;
  background: #0d0d18; border: 1px solid #444;
  font-size: 11px; line-height: 1.6; color: #ccc;
  pointer-events: none;
}
.sb-hover-tooltip .sb-tooltip-title { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
.sb-hover-tooltip .sb-tooltip-flavor { font-style: italic; color: #888; margin-top: 4px; }
.sb-hover-tooltip .sb-tooltip-death { color: #cc5555; opacity: 0.85; margin-top: 4px; }
.sb-empty-note { color: #666; font-size: 11px; text-align: center; padding: 12px 4px; }
.sb-filter-chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; color: #ffcc00; background: #ffcc0018;
  border: 1px solid #ffcc0055; border-radius: 10px;
  padding: 3px 10px; margin-bottom: 10px; cursor: pointer;
}
.sb-filter-chip:hover { background: #ffcc0030; }
`;

export class InventoryPanel {
  private panel: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private _open = false;
  private _slotFilter: string | null = null;

  private _defs = new Map<bigint, ItemDefinition>();
  private _instances = new Map<bigint, ItemInstance>();
  private _equipped = new Map<bigint, EquippedItem>(); // key = equippedItemId

  constructor() {
    if (!document.getElementById('sb-panel-css')) {
      const style = document.createElement('style');
      style.id = 'sb-panel-css';
      style.textContent = BASE_CSS;
      document.head.appendChild(style);
    }
    if (!document.getElementById('sb-inventory-css')) {
      const style = document.createElement('style');
      style.id = 'sb-inventory-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    this.panel = document.createElement('div');
    this.panel.id = 'sb-inventory-panel';
    this.panel.className = 'sb-panel from-left';
    document.body.appendChild(this.panel);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'sb-hover-tooltip';
    this.tooltip.style.display = 'none';
    document.body.appendChild(this.tooltip);

    this._render();
  }

  open() {
    this._open = true;
    this.panel.classList.add('open');
  }
  close() {
    this._open = false;
    this.panel.classList.remove('open');
    this._hideTooltip();
  }

  /** Normal I-key toggle — always shows the whole bag. */
  toggle() {
    if (this._open) {
      this.close();
      return;
    }
    this._slotFilter = null;
    this.open();
    this._render();
  }

  /** Opened from the character sheet by clicking an empty slot — bag pre-filtered to that slot. */
  openForSlot(slotTag: string) {
    this._slotFilter = slotTag;
    this.open();
    this._render();
  }

  isOpen() {
    return this._open;
  }

  // ── Table callbacks ────────────────────────────────────────────────────────

  onItemDefRow(def: ItemDefinition) {
    this._defs.set(def.itemDefId, def);
    this._render();
  }

  onInstanceInsert(row: ItemInstance) {
    this._instances.set(row.itemInstanceId, row);
    this._render();
  }

  onInstanceDelete(row: ItemInstance) {
    this._instances.delete(row.itemInstanceId);
    this._render();
  }

  onEquippedInsert(row: EquippedItem) {
    this._equipped.set(row.equippedItemId, row);
    this._render();
  }

  onEquippedDelete(row: EquippedItem) {
    this._equipped.delete(row.equippedItemId);
    this._render();
  }

  /** Fully replace the visible bag — called when the local character changes (new life). */
  reset(instances: ItemInstance[], equipped: EquippedItem[]) {
    this._instances = new Map(instances.map((i) => [i.itemInstanceId, i]));
    this._equipped = new Map(equipped.map((e) => [e.equippedItemId, e]));
    this._render();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private _equippedInstanceIds(): Set<bigint> {
    return new Set([...this._equipped.values()].map((e) => e.itemInstanceId));
  }

  private _render() {
    const equippedIds = this._equippedInstanceIds();
    const allItems = [...this._instances.values()];
    const items = this._slotFilter
      ? allItems.filter((i) => {
          const def = this._defs.get(i.itemDefId);
          return def?.slot && rarityTag(def.slot) === this._slotFilter;
        })
      : allItems;

    this.panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:15px;font-weight:700;color:#fff">Bag (${allItems.length})</span>
        <span style="cursor:pointer;color:#888;font-size:18px" id="sb-inv-close">✕</span>
      </div>
      ${
        this._slotFilter
          ? `<div class="sb-filter-chip" id="sb-inv-clear-filter">Showing: ${this._slotFilter} · Show All ✕</div>`
          : ''
      }
      ${
        items.length === 0
          ? `<div class="sb-empty-note">${
              this._slotFilter
                ? `No ${this._slotFilter} items in your bag.`
                : 'Nothing in your bag yet. Kill enemies for a chance at gear.'
            }</div>`
          : `<div class="sb-grid">${items.map((i) => this._renderCell(i, equippedIds)).join('')}</div>`
      }
    `;

    this.panel
      .querySelector('#sb-inv-close')
      ?.addEventListener('click', () => this.close());
    this.panel
      .querySelector('#sb-inv-clear-filter')
      ?.addEventListener('click', () => {
        this._slotFilter = null;
        this._render();
      });
    this._attachCellListeners();
  }

  private _renderCell(inst: ItemInstance, equippedIds: Set<bigint>): string {
    const def = this._defs.get(inst.itemDefId);
    if (!def) return '';
    const rarity = rarityTag(def.rarity);
    const color = RARITY_COLOR[rarity] ?? '#aaa';
    const armor = def.armorWeight ? rarityTag(def.armorWeight) : null;
    const slotTag = def.slot ? rarityTag(def.slot) : null;
    const icon = slotTag ? (SLOT_ICON[slotTag] ?? '❔') : '❔';
    const isEquip = equippedIds.has(inst.itemInstanceId);

    const stats = nonZeroStats(def.statModifiers);
    const preview = PREVIEW_PRIORITY.map((k) =>
      stats.find(([sk]) => sk === k),
    ).find((s): s is [keyof StatBlock, number] => !!s);
    const previewText = preview
      ? `${fmtStat(preview[0], preview[1])} ${STAT_LABEL[preview[0]].toLowerCase()}`
      : '';

    return `<div class="sb-item-cell${isEquip ? ' equipped' : ''}"
                 data-iid="${inst.itemInstanceId}"
                 style="border-color:${color}88;background:${color}11">
      ${armor ? `<div class="sb-armor-badge" style="background:${ARMOR_TINT[armor] ?? '#666'}"></div>` : ''}
      <div class="sb-item-icon">${icon}</div>
      <div class="sb-item-name" style="color:${color}">${def.name}</div>
      <div class="sb-item-stat">${previewText}</div>
      ${isEquip ? `<div class="sb-equipped-badge">Equipped</div>` : ''}
    </div>`;
  }

  private _renderTooltip(inst: ItemInstance): string {
    const def = this._defs.get(inst.itemDefId);
    if (!def) return '';
    const rarity = rarityTag(def.rarity);
    const color = RARITY_COLOR[rarity] ?? '#aaa';
    const armor = def.armorWeight ? rarityTag(def.armorWeight) : null;
    const slotTag = def.slot ? rarityTag(def.slot) : null;
    const stats = nonZeroStats(def.statModifiers);
    return `
      <div class="sb-tooltip-title" style="color:${color}">${def.name}</div>
      <div>${rarity}${slotTag ? ` · ${slotTag}` : ''}${armor ? ` · ${armor}` : ''}</div>
      ${stats.map(([k, v]) => `<div>${STAT_LABEL[k]}: ${fmtStat(k, v)}</div>`).join('')}
      <div class="sb-tooltip-flavor">${def.flavor}</div>
      <div class="sb-tooltip-death">Lost on death</div>
    `;
  }

  private _hideTooltip() {
    this.tooltip.style.display = 'none';
  }

  // ── Event delegation ───────────────────────────────────────────────────────

  private _attachCellListeners() {
    this.panel.querySelectorAll<HTMLElement>('[data-iid]').forEach((el) => {
      const iid = BigInt(el.dataset.iid!);

      el.addEventListener('mouseenter', () => {
        const inst = this._instances.get(iid);
        if (!inst) return;
        this.tooltip.innerHTML = this._renderTooltip(inst);
        const rect = el.getBoundingClientRect();
        this.tooltip.style.left = `${rect.right + 8}px`;
        this.tooltip.style.top = `${rect.top}px`;
        this.tooltip.style.display = 'block';
      });
      el.addEventListener('mouseleave', () => this._hideTooltip());
      el.addEventListener('click', () => this._handleClick(iid));
    });
  }

  private _handleClick(itemInstanceId: bigint) {
    const inst = this._instances.get(itemInstanceId);
    const def = inst ? this._defs.get(inst.itemDefId) : null;
    if (!inst || !def || !def.slot) return;
    const slotTag = rarityTag(def.slot);
    const isDual = slotTag === 'Ring' || slotTag === 'Earring';

    const decision = decideEquipAction(itemInstanceId, slotTag, isDual, [
      ...this._equipped.values(),
    ]);
    switch (decision.kind) {
      case 'unequip':
        if (confirm(`Unequip ${def.name}?`)) {
          this._emit('unequipItem', {
            equippedItemId: decision.equippedItemId,
          });
        }
        return;
      case 'equip':
        this._equip(itemInstanceId, decision.slot, decision.slotOrdinal);
        return;
      case 'replace':
        this._confirmReplace(decision.occupant, () =>
          this._equip(itemInstanceId, decision.slot, decision.slotOrdinal),
        );
        return;
    }
  }

  private _confirmReplace(occupant: EquippedItem, onConfirm: () => void) {
    const curInst = this._instances.get(occupant.itemInstanceId);
    const curDef = curInst ? this._defs.get(curInst.itemDefId) : null;
    if (confirm(`Replace ${curDef?.name ?? 'equipped item'}?`)) onConfirm();
  }

  private _equip(itemInstanceId: bigint, slot: string, slotOrdinal: number) {
    this._emit('equipItem', { itemInstanceId, slot, slotOrdinal });
  }

  // ── Simple event bus ───────────────────────────────────────────────────────

  onAction?: (action: string, payload: Record<string, unknown>) => void;

  private _emit(action: string, payload: Record<string, unknown>) {
    this.onAction?.(action, payload);
  }
}
