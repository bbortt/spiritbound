export interface GameState {
  population: number;
  food: number;
  wood: number;
  stone: number;
  defenders: number;
  gatherers: number;
  idle: number;
  currentWave: number;
  nextWaveInSeconds: number;
  lastCombatResults: string[];
}

export const initialGameState: GameState = {
  population: 10,
  food: 10,
  wood: 20,
  stone: 10,
  defenders: 0,
  gatherers: 0,
  idle: 10,
  currentWave: 0,
  nextWaveInSeconds: 30,
  lastCombatResults: ['The first wave is approaching. Prepare your defenses!'],
};
