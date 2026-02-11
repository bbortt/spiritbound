import { Building } from './Building.ts';
import type { GameState, TickResult, IAction } from '../types.ts';

export class DefenseTower extends Building {
  defenseBonus: number;

  constructor(id: string, defenseBonus: number = 5) { // Default defense bonus
    super(id, `Defense Tower ${id.substring(0, 4)}`, 'DefenseTower', 20); // 20 construction points for now
    this.defenseBonus = defenseBonus;
  }

  /**
   * Generic calculation method for a Defense Tower.
   * Currently, it simply provides a defense bonus if constructed.
   * This method can be expanded to include other combat-related effects.
   * @param state The current GameState.
   * @returns A TickResult containing actions related to its effect.
   */
  onTick(_state: GameState): TickResult { // state is not used here, so prefix with _
    const actions: IAction[] = [];

    if (this.isConstructed) {
      // In a more complex system, this might add a temporary buff action,
      // or modify combat calculations directly via a global combat manager.
      // For now, we'll assume the TickSystem will query all constructed DefenseTowers
      // for their combined defenseBonus when combat occurs.
      // So, this specific onTick method might not return direct actions,
      // but its properties will be read by the main tick system.
    }
    return { actions };
  }
}
