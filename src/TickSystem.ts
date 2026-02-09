import type { GameState } from './types.ts';

// --- Game Constants ---

// Gathering: Each gatherer produces 1 unit of "stuff" per tick, distributed by probability.
const GATHERER_PRODUCTION_RATE = 1;
const FOOD_GATHER_CHANCE = 0.6;
const WOOD_GATHER_CHANCE = 0.25;
const STONE_GATHER_CHANCE = 0.15;

// Population
const FOOD_CONSUMPTION_PER_POPULATION_PER_TICK = 0.2;

// Combat
const WAVE_RESET_TIME = 30; // seconds (ticks)
const WAVE_BASE_SIZE = 2; // Base for soft exponential growth of wave size
const WAVE_GROWTH = 1.25; // Growth for soft exponential growth of wave size

// Balancing
const DEFENSE_MULTIPLICATOR = 1.3;

function randIndBetween(min: number, max: number) {
  return Math.random() * (max -min) + min
}

/**
 * Pure function to advance the game state by one tick.
 * It takes the current state and returns a new state.
 * @param state The current GameState.
 * @returns The new GameState after one tick.
 */
export function tick(state: GameState): GameState {
  const newState: GameState = { ...state };

  // --- 1. Resource Gathering ---
  const totalGatheringPower = newState.gatherers * GATHERER_PRODUCTION_RATE;
  // Note: This is a simplified probabilistic model. For true per-gatherer probability, you'd loop.
  // This approach gives a smoother resource flow.
  newState.food += totalGatheringPower * FOOD_GATHER_CHANCE;
  newState.wood += totalGatheringPower * WOOD_GATHER_CHANCE;
  newState.stone += totalGatheringPower * STONE_GATHER_CHANCE;

  // --- 2. Population Dynamics ---
  const totalPopulation = newState.defenders + newState.gatherers + newState.idle;

  // Food consumption
  newState.food -= totalPopulation * FOOD_CONSUMPTION_PER_POPULATION_PER_TICK;

  // Handle starvation
  if (newState.food < 0) {
    newState.food = 0;
    // Simple starvation: lose one person if food is 0.
    if (newState.population > 0) {
      newState.population--;
      // Remove from idle first, then gatherers, then defenders.
      if (newState.idle > 0) newState.idle--;
      else if (newState.gatherers > 0) newState.gatherers--;
      else if (newState.defenders > 0) newState.defenders--;
    }
  }

  // Population growth (deterministic based on food surplus)
  if (newState.food > totalPopulation * 2 && newState.population < 100) { // Max pop 100
    newState.population++;
    newState.idle++;
  }

  // --- 3. Combat & Wave Timer ---
  newState.nextWaveInSeconds--;
  if (newState.nextWaveInSeconds <= 0) {
    newState.currentWave++;
    newState.nextWaveInSeconds = WAVE_RESET_TIME;

    // Combat Resolution
    const defensePower = newState.defenders * DEFENSE_MULTIPLICATOR;
    let monsterPower = Math.floor(WAVE_BASE_SIZE * (WAVE_GROWTH ** newState.currentWave));
    if (newState.currentWave > 3) {
      monsterPower *= randIndBetween( 0.8,1.2);
    }

    if (monsterPower > defensePower) {
      const villagersLost = monsterPower - defensePower;
      let remainingLosses = villagersLost;

      // Remove from idle first
      const idleLost = Math.min(newState.idle, remainingLosses);
      newState.idle -= idleLost;
      remainingLosses -= idleLost;

      // Then from gatherers
      const gatherersLost = Math.min(newState.gatherers, remainingLosses);
      newState.gatherers -= gatherersLost;
      remainingLosses -= gatherersLost;
      
      // Finally from defenders
      const defendersLost = Math.min(newState.defenders, remainingLosses);
      newState.defenders -= defendersLost;

      newState.lastCombatResults.push( `Wave ${newState.currentWave}: Hit with strength ${monsterPower}.`);
      newState.lastCombatResults.push( `The monsters broke through! You lost ${villagersLost} villagers.`);
    } else {
      newState.lastCombatResults.push(`Your defenders held off the attack!`);
    }

    newState.lastCombatResults.push('The next wave is approaching. Prepare your defenses!');
  }

  // --- 4. State Cleanup ---

  // Ensure counts are not negative and are integers
  newState.food = Math.max(0, newState.food);
  newState.wood = Math.max(0, newState.wood);
  newState.stone = Math.max(0, newState.stone);
  newState.defenders = Math.max(0, Math.floor(newState.defenders));
  newState.gatherers = Math.max(0, Math.floor(newState.gatherers));
  newState.idle = Math.max(0, Math.floor(newState.idle));

  // Recalculate total population
  newState.population = newState.defenders + newState.gatherers + newState.idle;

  return newState;
}
