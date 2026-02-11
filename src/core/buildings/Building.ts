import type { IEntity, TickResult, IAction, GameState } from '../types.ts';

export class Building implements IEntity {
  id: string;
  name: string;
  type: string; // e.g., 'DefenseTower', 'Granary'
  isConstructed: boolean;
  constructionPointsCurrent: number;
  constructionPointsRequired: number;

  constructor(id: string, name: string, type: string, constructionPointsRequired: number) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.isConstructed = false;
    this.constructionPointsCurrent = 0;
    this.constructionPointsRequired = constructionPointsRequired;
  }

  onTick(_state: GameState): TickResult { // state is not used here, so prefix with _
    const actions: IAction[] = [];

    // Buildings primarily contribute to state once constructed or manage their own construction
    if (!this.isConstructed) {
      // Logic for construction handled by TickSystem or ConstructionJob
      // This onTick for Building base class might not do much directly for construction,
      // but subclasses can override for specific effects during construction or after.
    } else {
      // Generic constructed building effects (subclasses will override for specifics)
    }

    return { actions };
  }

  // Method to apply construction points
  addConstructionPoints(points: number): void {
    if (!this.isConstructed) {
      this.constructionPointsCurrent += points;
      if (this.constructionPointsCurrent >= this.constructionPointsRequired) {
        this.constructionPointsCurrent = this.constructionPointsRequired;
        this.isConstructed = true;
        console.log(`${this.name} (ID: ${this.id}) has been constructed!`);
      }
    }
  }
}
