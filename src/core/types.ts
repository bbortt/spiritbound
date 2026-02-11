import { Building } from "./buildings/Building";

export type PopulationType = "defenders" | "gatherers" | "builders";
export type BuildingType = "DefenseTower";

export interface IAction {
  type:
    | "ADD_FOOD"
    | "ADD_WOOD"
    | "ADD_STONE"
    | "ADD_POPULATION"
    | "REMOVE_POPULATION"
    | "ADD_DEFENDER"
    | "REMOVE_DEFENDER"
    | "ADD_GATHERER"
    | "REMOVE_GATHERER"
    | "ADD_BUILDER"
    | "REMOVE_BUILDER"
    | "ADD_IDLE"
    | "REMOVE_IDLE"
    | "SET_NEXT_WAVE_TIMER"
    | "INCREMENT_WAVE"
    | "ADD_COMBAT_LOG"
    | "ADD_CONSTRUCTION_POINTS"
    | "COMPLETE_BUILDING"
    | "START_CONSTRUCTION";
  payload?: any;
}

export interface TickResult {
  actions: IAction[];
  logs?: string[];
}

export interface IEntity {
  id: string;
  onTick(state: GameState): TickResult;
}

export interface ConstructionJob {
  buildingId: string;
  buildingType: string; // e.g., 'DefenseTower'
  constructionPointsCurrent: number;
  constructionPointsRequired: number;
}

export interface GameState {
  population: number;
  food: number;
  wood: number;
  stone: number;
  defenders: number;
  gatherers: number;
  builders: number; // Builders population
  idle: number;
  currentWave: number;
  nextWaveInSeconds: number;
  lastCombatResults: string[];
  buildingAddedInTick: boolean; // Make sure only one building can be added per tick
  buildings: Building[]; // Array of active buildings
  constructionQueue: ConstructionJob[]; // Buildings currently under construction
}

export const initialGameState: GameState = {
  population: 10,
  food: 10,
  wood: 20,
  stone: 10,
  defenders: 0,
  gatherers: 0,
  builders: 0,
  idle: 10,
  currentWave: 0,
  nextWaveInSeconds: 30,
  lastCombatResults: ["The first wave is approaching. Prepare your defenses!"],
  buildings: [],
  buildingAddedInTick: false,
  constructionQueue: [],
};
