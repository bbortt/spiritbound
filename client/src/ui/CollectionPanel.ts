import type {
  CardDefinition,
  CardInstance,
  EquippedCard,
} from '../db';

const RARITY_COLOR: Record<string, string> = {
  Common:    '#aaaaaa',
  Uncommon:  '#44cc44',
  Rare:      '#4488ff',
  Epic:      '#cc44ff',
  Legendary: '#ffcc00',
};

function computeAttunementSlots(spiritLevel: number): number {
  return 2 + Math.floor(spiritLevel / 3);
}

function computeHandSlots(spiritLevel: number): { active: number; passive: number } {
  return {
    active:  Math.min(10, 3 + Math.floor(spiritLevel / 2)),
    passive: Math.min(5,  1 + Math.floor(spiritLevel / 4)),
  };
}

function rarityTag(tag: string): string {
  return tag.replace(/^["']?(\w+).*/, '$1');
}

function rarityOf(def: CardDefinition): string {
  return rarityTag((def.rarity as any).tag ?? String(def.rarity));
}

function cardTypeOf(def: CardDefinition): string {
  return rarityTag((def.cardType as any).tag ?? String(def.cardType));
}

function schoolOf(def: CardDefinition): string {
  return rarityTag((def.scalingSchool as any).tag ?? String(def.scalingSchool));
}

const CSS = `
#sb-collection-panel {
  position: fixed;
  top: 0; right: -420px;
  width: 400px; height: 100vh;
  background: rgba(10,10,20,0.96);
  border-left: 1px solid #333;
  color: #ccc;
  font-family: 'Segoe UI', sans-serif;
  font-size: 13px;
  overflow-y: auto;
  transition: right 0.25s ease;
  z-index: 1000;
  box-sizing: border-box;
  padding: 12px;
  user-select: none;
}
#sb-collection-panel.open { right: 0; }
.sb-section { margin-bottom: 14px; }
.sb-section-title {
  font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
  color: #888; text-transform: uppercase; margin-bottom: 6px;
}
.sb-spirit-info { font-size: 12px; color: #a0c4ff; margin-bottom: 4px; }
.sb-spirit-budget { font-size: 11px; color: #666; }
.sb-near-notice {
  font-size: 11px; color: #ff9944; text-align: center;
  padding: 6px; border: 1px solid #664422; border-radius: 4px; margin-bottom: 8px;
}
.sb-slots { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.sb-slot {
  width: 52px; height: 72px;
  border: 1px solid #444; border-radius: 4px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 10px; color: #555; cursor: pointer; position: relative;
  background: #111;
}
.sb-slot.active-slot { border-color: #4488ff55; }
.sb-slot.passive-slot { border-color: #44aa4455; }
.sb-slot.filled { border-color: #888; color: #ccc; }
.sb-slot.filled.active-slot { border-color: #4488ff; }
.sb-slot.filled.passive-slot { border-color: #44aa44; }
.sb-slot.dim { opacity: 0.3; pointer-events: none; }
.sb-slot-label { font-size: 9px; color: #555; margin-top: 2px; }
.sb-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.sb-card {
  width: 100%; aspect-ratio: 3/4;
  border: 1px solid #333; border-radius: 4px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 9px; text-align: center; padding: 2px; cursor: pointer;
  background: #111; position: relative; overflow: hidden;
}
.sb-card:hover { border-color: #777; }
.sb-card.selected { border-color: #fff; }
.sb-card.equipped { outline: 2px solid #ffcc00; }
.sb-card-name { font-size: 9px; line-height: 1.2; font-weight: 600; }
.sb-card-badges { display: flex; gap: 2px; margin-top: 2px; flex-wrap: wrap; justify-content: center; }
.sb-badge {
  font-size: 8px; padding: 1px 3px; border-radius: 2px;
  background: #333; color: #aaa;
}
.sb-lock { position: absolute; top: 2px; right: 2px; font-size: 9px; }
.sb-actions { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.sb-btn {
  padding: 6px 10px; border: 1px solid #555; border-radius: 4px;
  background: #1a1a2a; color: #ccc; cursor: pointer; font-size: 12px;
  text-align: center;
}
.sb-btn:hover { background: #2a2a3a; border-color: #888; }
.sb-btn.danger { border-color: #883333; color: #ff6666; }
.sb-btn.danger:hover { background: #2a1a1a; }
.sb-btn:disabled { opacity: 0.35; pointer-events: none; }
.sb-tooltip {
  margin-top: 8px; padding: 8px; border: 1px solid #333; border-radius: 4px;
  background: #0d0d18; font-size: 11px; line-height: 1.6;
}
.sb-tooltip-title { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.sb-tooltip-flavor { font-style: italic; color: #666; margin-top: 4px; font-size: 10px; }
`;

export class CollectionPanel {
  private panel: HTMLDivElement;
  private _open = false;
  private _nearSpirit = false;
  private _spiritLevel = 1;

  private _cardDefs    = new Map<number, CardDefinition>();
  private _instances   = new Map<bigint, CardInstance>();
  private _equipped    = new Map<bigint, EquippedCard>();   // key = cardInstanceId
  private _selected: bigint | null = null;

  constructor() {
    // Inject CSS
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.panel = document.createElement('div');
    this.panel.id = 'sb-collection-panel';
    document.body.appendChild(this.panel);

    this._render();
  }

  open() {
    this._open = true;
    this.panel.classList.add('open');
  }

  close() {
    this._open = false;
    this.panel.classList.remove('open');
  }

  toggle() {
    this._open ? this.close() : this.open();
  }

  isOpen() { return this._open; }

  setNearSpirit(near: boolean) {
    this._nearSpirit = near;
    this._render();
  }

  setSpiritLevel(level: number) {
    this._spiritLevel = level;
    this._render();
  }

  // ── Table callbacks ────────────────────────────────────────────────────────

  onCardDefInsert(def: CardDefinition) {
    this._cardDefs.set(def.cardDefId, def);
    this._render();
  }

  onCardInsert(row: CardInstance) {
    this._instances.set(row.cardInstanceId, row);
    this._render();
  }

  onCardUpdate(_old: CardInstance, row: CardInstance) {
    this._instances.set(row.cardInstanceId, row);
    this._render();
  }

  onCardDelete(row: CardInstance) {
    this._instances.delete(row.cardInstanceId);
    if (this._selected === row.cardInstanceId) this._selected = null;
    this._render();
  }

  onEquippedInsert(row: EquippedCard) {
    this._equipped.set(row.cardInstanceId, row);
    this._render();
  }

  onEquippedDelete(row: EquippedCard) {
    this._equipped.delete(row.cardInstanceId);
    this._render();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private _render() {
    const { active: maxActive, passive: maxPassive } = computeHandSlots(this._spiritLevel);
    const maxAttune = computeAttunementSlots(this._spiritLevel);

    // Rarity budget for attunement
    const rarityBudget: Record<string, { cap: number; used: number }> = {
      Common:    { cap: 3, used: 0 },
      Uncommon:  { cap: 2, used: 0 },
      Rare:      { cap: 1, used: 0 },
      Epic:      { cap: 1, used: 0 },
      Legendary: { cap: 1, used: 0 },
    };
    let attunedCount = 0;
    for (const inst of this._instances.values()) {
      if (inst.attuned) {
        attunedCount++;
        const def = this._cardDefs.get(inst.cardDefId);
        if (def) {
          const r = rarityOf(def);
          if (rarityBudget[r]) rarityBudget[r].used++;
        }
      }
    }

    // Build slot arrays
    const activeSlots: Array<CardInstance | null> = Array(10).fill(null);
    const passiveSlots: Array<CardInstance | null> = Array(5).fill(null);
    for (const eq of this._equipped.values()) {
      const inst = this._instances.get(eq.cardInstanceId);
      if (!inst) continue;
      if ((eq.slotType as any).tag === 'Active') {
        if (eq.slotIndex < 10) activeSlots[eq.slotIndex] = inst;
      } else {
        if (eq.slotIndex < 5) passiveSlots[eq.slotIndex] = inst;
      }
    }

    const sel = this._selected != null ? this._instances.get(this._selected) ?? null : null;
    const selDef = sel ? this._cardDefs.get(sel.cardDefId) ?? null : null;
    const selEquip = this._selected != null ? this._equipped.get(this._selected) ?? null : null;

    this.panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:15px;font-weight:700;color:#fff">Collection</span>
        <span style="cursor:pointer;color:#888;font-size:18px" id="sb-close">✕</span>
      </div>

      ${this._renderSpiritInfo(maxAttune, attunedCount, rarityBudget)}

      ${!this._nearSpirit ? `<div class="sb-near-notice">Visit a spirit to manage your hand</div>` : ''}

      <div class="sb-section">
        <div class="sb-section-title">Active Slots (${maxActive}/10)</div>
        <div class="sb-slots">${activeSlots.map((inst, i) => this._renderSlot(inst, i, 'active', maxActive)).join('')}</div>
      </div>

      <div class="sb-section">
        <div class="sb-section-title">Passive Slots (${maxPassive}/5)</div>
        <div class="sb-slots">${passiveSlots.map((inst, i) => this._renderSlot(inst, i, 'passive', maxPassive)).join('')}</div>
      </div>

      <div class="sb-section">
        <div class="sb-section-title">Collection (${this._instances.size})</div>
        <div class="sb-grid">${this._renderCollection()}</div>
      </div>

      ${sel && selDef ? this._renderActions(sel, selDef, selEquip, maxActive, maxPassive, attunedCount, maxAttune) : ''}
      ${sel && selDef ? this._renderTooltip(sel, selDef) : ''}
    `;

    this._attachListeners();
  }

  private _renderSpiritInfo(
    maxAttune: number,
    attunedCount: number,
    budget: Record<string, { cap: number; used: number }>,
  ) {
    const parts = Object.entries(budget)
      .filter(([, v]) => v.cap > 0)
      .map(([r, v]) => `<span style="color:${RARITY_COLOR[r]}">${r}: ${v.used}/${v.cap}</span>`)
      .join(' · ');
    return `
      <div class="sb-section">
        <div class="sb-spirit-info">Spirit Lv ${this._spiritLevel}</div>
        <div class="sb-spirit-budget">Attuned ${attunedCount}/${maxAttune} · ${parts}</div>
      </div>`;
  }

  private _renderSlot(inst: CardInstance | null, index: number, type: 'active' | 'passive', maxUnlocked: number) {
    const locked = index >= maxUnlocked;
    const def = inst ? this._cardDefs.get(inst.cardDefId) : null;
    const isSelected = inst && inst.cardInstanceId === this._selected;
    let cls = `sb-slot ${type}-slot`;
    if (inst) cls += ' filled';
    if (locked) cls += ' dim';
    if (isSelected) cls += ' selected';
    const label = type === 'active' ? `${index + 1}` : `P${index + 1}`;
    const name = def ? def.name : '';
    return `<div class="${cls}" data-slot="${type}-${index}" data-iid="${inst?.cardInstanceId ?? ''}" title="${name}">
      ${name ? `<div style="font-size:9px;padding:2px;text-align:center;line-height:1.2">${name}</div>` : `<div class="sb-slot-label">${locked ? '🔒' : label}</div>`}
    </div>`;
  }

  private _renderCollection() {
    return [...this._instances.values()].map(inst => {
      const def = this._cardDefs.get(inst.cardDefId);
      const rarity = def ? rarityOf(def) : 'Common';
      const color  = RARITY_COLOR[rarity] ?? '#aaa';
      const type   = def ? cardTypeOf(def) : '';
      const school = def ? schoolOf(def) : '';
      const isEquipped = this._equipped.has(inst.cardInstanceId);
      const isSelected = inst.cardInstanceId === this._selected;
      let cls = 'sb-card';
      if (isEquipped) cls += ' equipped';
      if (isSelected) cls += ' selected';
      return `<div class="${cls}" data-iid="${inst.cardInstanceId}" style="border-color:${color}55;background:${color}11">
        ${inst.attuned ? `<div class="sb-lock">🔒</div>` : ''}
        <div class="sb-card-name" style="color:${color}">${def?.name ?? '?'}</div>
        <div class="sb-card-badges">
          <div class="sb-badge">${type === 'Active' ? 'A' : 'P'}</div>
          <div class="sb-badge">${school === 'Physical' ? '⚔' : '✦'}</div>
        </div>
      </div>`;
    }).join('');
  }

  private _renderActions(
    inst: CardInstance,
    def: CardDefinition,
    equip: EquippedCard | null,
    maxActive: number,
    maxPassive: number,
    attunedCount: number,
    maxAttune: number,
  ) {
    const type = cardTypeOf(def);
    const isActive = type === 'Active';
    const usedActive  = [...this._equipped.values()].filter(e => (e.slotType as any).tag === 'Active').length;
    const usedPassive = [...this._equipped.values()].filter(e => (e.slotType as any).tag === 'Passive').length;
    const canEquip = this._nearSpirit && !equip && (isActive ? usedActive < maxActive : usedPassive < maxPassive);
    const canUnequip = this._nearSpirit && equip != null;
    const canAttune = !inst.attuned && attunedCount < maxAttune;
    const canUnattune = inst.attuned && !equip; // can't unattune while equipped

    return `<div class="sb-actions">
      <button class="sb-btn" data-action="equip" ${canEquip ? '' : 'disabled'}>Equip</button>
      <button class="sb-btn" data-action="unequip" ${canUnequip ? '' : 'disabled'}>Unequip</button>
      <button class="sb-btn" data-action="attune" ${canAttune ? '' : 'disabled'}>${inst.attuned ? 'Attuned 🔒' : 'Attune'}</button>
      <button class="sb-btn" data-action="unattune" ${canUnattune ? '' : 'disabled'}>Unattune</button>
      <button class="sb-btn danger" data-action="sacrifice">Sacrifice to Spirit</button>
    </div>`;
  }

  private _renderTooltip(inst: CardInstance, def: CardDefinition) {
    const rarity  = rarityOf(def);
    const color   = RARITY_COLOR[rarity] ?? '#aaa';
    const type    = cardTypeOf(def);
    const school  = schoolOf(def);
    return `<div class="sb-tooltip">
      <div class="sb-tooltip-title" style="color:${color}">${def.name}</div>
      <div>${rarity} · ${type} · ${school}</div>
      <div>Power: ${def.basePower} · Cooldown: ${def.baseCooldown}s · MP: ${def.mpCost}</div>
      <div>Merge Lv: ${inst.mergeLevel} · Min Lv: ${def.minCharacterLevel}</div>
      ${inst.attuned ? '<div>🔒 Attuned — survives death</div>' : ''}
      <div class="sb-tooltip-flavor">${def.flavor}</div>
    </div>`;
  }

  // ── Event delegation ───────────────────────────────────────────────────────

  private _attachListeners() {
    this.panel.querySelector('#sb-close')?.addEventListener('click', () => this.close());

    // Card selection from collection grid or hand slots
    this.panel.querySelectorAll('[data-iid]').forEach(el => {
      const iid = (el as HTMLElement).dataset.iid;
      if (!iid) return;
      el.addEventListener('click', () => {
        const id = BigInt(iid);
        this._selected = this._selected === id ? null : id;
        this._render();
      });
    });

    // Action buttons
    this.panel.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        if (!this._selected) return;
        const action = (el as HTMLElement).dataset.action!;
        this._handleAction(action, this._selected);
      });
    });
  }

  private _handleAction(action: string, iid: bigint) {
    const inst = this._instances.get(iid);
    const def  = inst ? this._cardDefs.get(inst.cardDefId) : null;
    if (!inst || !def) return;

    switch (action) {
      case 'equip': {
        const type = cardTypeOf(def);
        const eq   = [...this._equipped.values()];
        const usedActive  = eq.filter(e => (e.slotType as any).tag === 'Active').length;
        const usedPassive = eq.filter(e => (e.slotType as any).tag === 'Passive').length;
        const { active: maxA, passive: maxP } = computeHandSlots(this._spiritLevel);
        const slotIndex = type === 'Active' ? usedActive : usedPassive;
        const slotMax   = type === 'Active' ? maxA : maxP;
        if (slotIndex >= slotMax) return;
        this._emit('equip', { cardInstanceId: iid, slotType: type.toLowerCase(), slotIndex });
        break;
      }
      case 'unequip': {
        const equip = this._equipped.get(iid);
        if (!equip) return;
        this._emit('unequip', { equippedCardId: equip.equippedCardId });
        break;
      }
      case 'attune':
        this._emit('attune', { cardInstanceId: iid });
        break;
      case 'unattune':
        this._emit('unattune', { cardInstanceId: iid });
        break;
      case 'sacrifice': {
        if (!confirm(`Sacrifice "${def.name}" to the spirit? This cannot be undone.`)) return;
        this._emit('sacrifice', { cardInstanceId: iid });
        break;
      }
    }
  }

  // ── Simple event bus ───────────────────────────────────────────────────────

  onAction?: (action: string, payload: Record<string, unknown>) => void;

  private _emit(action: string, payload: Record<string, unknown>) {
    this.onAction?.(action, payload);
  }
}
