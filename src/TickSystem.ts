import type { GameState, IAction, ConstructionJob } from "./core/types.ts";
import { DefenseTower } from "./core/buildings/DefenseTower.ts";

// --- Game Constants ---
const GATHERER_PRODUCTION_RATE = 1;
const FOOD_GATHER_CHANCE = 0.6;
const WOOD_GATHER_CHANCE = 0.25;
const STONE_GATHER_CHANCE = 0.15;

const FOOD_CONSUMPTION_PER_POPULATION_PER_TICK = 0.2;
const MAX_POPULATION = 100;

const WAVE_RESET_TIME = 30; // seconds (ticks)
const WAVE_BASE_SIZE = 5;
const WAVE_GROWTH = 1.25;

const DEFENSE_MULTIPLICATOR = 1.3;
const BUILDER_CP_RATE = 1; // Each builder generates 1 construction point per tick

function randIndBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/**
 * Applies a single action to the game state and returns a new state.
 * @param state The current GameState.
 * @param action The action to apply.
 * @returns A new GameState with the action applied.
 */
function applyAction(state: GameState, action: IAction): GameState {
  const newState = { ...state };

  switch (action.type) {
    case "ADD_FOOD":
      newState.food += action.payload;
      break;
    case "ADD_WOOD":
      newState.wood += action.payload;
      break;
    case "ADD_STONE":
      newState.stone += action.payload;
      break;
    case "ADD_POPULATION":
      newState.population += action.payload;
      break;
    case "REMOVE_POPULATION":
      newState.population = Math.max(0, newState.population - action.payload);
      break;
    case "ADD_DEFENDER":
      newState.defenders += action.payload;
      break;
    case "REMOVE_DEFENDER":
      newState.defenders = Math.max(0, newState.defenders - action.payload);
      break;
    case "ADD_GATHERER":
      newState.gatherers += action.payload;
      break;
    case "REMOVE_GATHERER":
      newState.gatherers = Math.max(0, newState.gatherers - action.payload);
      break;
    case "ADD_BUILDER":
      newState.builders += action.payload;
      break;
    case "REMOVE_BUILDER":
      newState.builders = Math.max(0, newState.builders - action.payload);
      break;
    case "ADD_IDLE":
      newState.idle += action.payload;
      break;
    case "REMOVE_IDLE":
      newState.idle = Math.max(0, newState.idle - action.payload);
      break;
    case "SET_NEXT_WAVE_TIMER":
      newState.nextWaveInSeconds = action.payload;
      break;
    case "INCREMENT_WAVE":
      newState.currentWave++;
      break;
    case "ADD_COMBAT_LOG":
      newState.lastCombatResults.push(action.payload);
      if (newState.lastCombatResults.length > 5) {
        // Keep log concise
        newState.lastCombatResults.shift();
      }
      break;
    case "ADD_CONSTRUCTION_POINTS":
      {
        const jobIndex = newState.constructionQueue.findIndex(
          (job) => job.buildingId === action.payload.buildingId,
        );
        if (jobIndex !== -1) {
          const job = { ...newState.constructionQueue[jobIndex] };
          job.constructionPointsCurrent += action.payload.points;
          if (job.constructionPointsCurrent >= job.constructionPointsRequired) {
            job.constructionPointsCurrent = job.constructionPointsRequired;
            // Mark for completion
            const buildingToComplete = newState.buildings.find(
              (b) => b.id === job.buildingId,
            );
            if (buildingToComplete) {
              buildingToComplete.isConstructed = true;
              newState.lastCombatResults.push(
                `${buildingToComplete.name} completed!`,
              );
            }
          }
          newState.constructionQueue = [
            ...newState.constructionQueue.slice(0, jobIndex),
            job,
            ...newState.constructionQueue.slice(jobIndex + 1),
          ];
        }
      }
      break;
    case "COMPLETE_BUILDING":
      {
        newState.constructionQueue = newState.constructionQueue.filter(
          (job) => job.buildingId !== action.payload.buildingId,
        );
        // The building was already marked as constructed in ADD_CONSTRUCTION_POINTS action
        // This action primarily removes it from the queue.
      }
      break;
    case "START_CONSTRUCTION":
      {
        const newBuilding = action.payload.building;
        const newJob: ConstructionJob = {
          buildingId: newBuilding.id,
          buildingType: newBuilding.type,
          constructionPointsCurrent: 0,
          constructionPointsRequired: newBuilding.constructionPointsRequired,
        };
        newState.buildings.push(newBuilding); // Add building to list, initially unconstructed
        newState.constructionQueue.push(newJob);
        newState.lastCombatResults.push(
          `Construction started on ${newBuilding.name}!`,
        );
      }
      break;
    default:
      console.warn(`Unknown action type: ${action.type}`);
      break;
  }
  return newState;
}

/**
 * Pure function to advance the game state by one tick.
 * It takes the current state and returns a new state.
 * @param state The current GameState.
 * @returns The new GameState after one tick.
 */
export function tick(state: GameState): GameState {
  let newState: GameState = {
    ...state,
    // Deep clone arrays
    lastCombatResults: [...state.lastCombatResults],
    buildings: [...state.buildings], // Shallow copy array, references to Building objects remain the same
    constructionQueue: state.constructionQueue.map((cq) => ({ ...cq })),
  };

  const allActions: IAction[] = [];

  // --- 1. Resource Gathering (as entity-like actions) ---
  const totalGatheringPower = newState.gatherers * GATHERER_PRODUCTION_RATE;
  allActions.push({
    type: "ADD_FOOD",
    payload: totalGatheringPower * FOOD_GATHER_CHANCE,
  });
  allActions.push({
    type: "ADD_WOOD",
    payload: totalGatheringPower * WOOD_GATHER_CHANCE,
  });
  allActions.push({
    type: "ADD_STONE",
    payload: totalGatheringPower * STONE_GATHER_CHANCE,
  });

  // --- 2. Population Dynamics (as entity-like actions) ---
  const totalPopulation =
    newState.defenders + newState.gatherers + newState.idle + newState.builders;

  // Food consumption
  const foodConsumed =
    totalPopulation * FOOD_CONSUMPTION_PER_POPULATION_PER_TICK;
  allActions.push({ type: "ADD_FOOD", payload: -foodConsumed });

  // Handle starvation (if food goes negative after applying actions, it will be handled by cleanup)
  // For now, starvation logic remains in the post-action application phase for simplicity.

  // Population growth (deterministic based on food surplus)
  if (
    newState.food > totalPopulation * 2 &&
    newState.population < MAX_POPULATION
  ) {
    allActions.push({ type: "ADD_POPULATION", payload: 1 });
    allActions.push({ type: "ADD_IDLE", payload: 1 });
  }

  // --- 3. Builder Actions: Distribute construction points ---
  if (newState.builders > 0 && newState.constructionQueue.length > 0) {
    const totalCPProduced = newState.builders * BUILDER_CP_RATE;
    const cpPerJob = totalCPProduced / newState.constructionQueue.length;

    newState.constructionQueue.forEach((job) => {
      allActions.push({
        type: "ADD_CONSTRUCTION_POINTS",
        payload: { buildingId: job.buildingId, points: cpPerJob },
      });
    });
  }

  // --- 4. Building onTick calls ---
  newState.buildings.forEach((building) => {
    const buildingTickResult = building.onTick(newState);
    allActions.push(...buildingTickResult.actions);
    if (buildingTickResult.logs) {
      buildingTickResult.logs.forEach((log) =>
        allActions.push({ type: "ADD_COMBAT_LOG", payload: log }),
      );
    }
  });

  // --- Apply all collected actions ---
  for (const action of allActions) {
    newState = applyAction(newState, action);
  }

  // --- 5. Combat & Wave Timer ---
  newState.nextWaveInSeconds--;
  if (newState.nextWaveInSeconds <= 0) {
    newState = applyAction(newState, { type: "INCREMENT_WAVE" });
    newState = applyAction(newState, {
      type: "SET_NEXT_WAVE_TIMER",
      payload: WAVE_RESET_TIME,
    });

    // Combat Resolution
    // Calculate total defense power from defenders and constructed DefenseTowers
    let totalDefensePower = newState.defenders * DEFENSE_MULTIPLICATOR;
    newState.buildings.forEach((building) => {
      if (building.isConstructed && building.type === "DefenseTower") {
        totalDefensePower += (building as DefenseTower).defenseBonus;
      }
    });

    let monsterPower = Math.floor(
      WAVE_BASE_SIZE * WAVE_GROWTH ** newState.currentWave,
    );
    if (newState.currentWave > 3) {
      monsterPower *= randIndBetween(0.8, 1.2);
    }

    newState = applyAction(newState, {
      type: "ADD_COMBAT_LOG",
      payload: `Wave ${newState.currentWave}: Hit with strength ${monsterPower}.`,
    });
    if (monsterPower > totalDefensePower) {
      const villagersLost = monsterPower - totalDefensePower;
      let remainingLosses = villagersLost;

      // Remove from idle first
      const idleLost = Math.min(newState.idle, remainingLosses);
      if (idleLost > 0) {
        newState = applyAction(newState, {
          type: "REMOVE_IDLE",
          payload: idleLost,
        });
        remainingLosses -= idleLost;
      }

      // Then from gatherers
      const gatherersLost = Math.min(newState.gatherers, remainingLosses);
      if (gatherersLost > 0) {
        newState = applyAction(newState, {
          type: "REMOVE_GATHERER",
          payload: gatherersLost,
        });
        remainingLosses -= gatherersLost;
      }

      // Then from builders
      const buildersLost = Math.min(newState.builders, remainingLosses);
      if (buildersLost > 0) {
        newState = applyAction(newState, {
          type: "REMOVE_BUILDER",
          payload: buildersLost,
        });
        remainingLosses -= buildersLost;
      }

      // Finally from defenders
      const defendersLost = Math.min(newState.defenders, remainingLosses);
      if (defendersLost > 0) {
        newState = applyAction(newState, {
          type: "REMOVE_DEFENDER",
          payload: defendersLost,
        });
      }

      newState = applyAction(newState, {
        type: "ADD_COMBAT_LOG",
        payload: `The monsters broke through! You lost ${villagersLost} villagers.`,
      });
    } else {
      newState = applyAction(newState, {
        type: "ADD_COMBAT_LOG",
        payload: `Your defenders held off the attack!`,
      });
    }

    newState = applyAction(newState, {
      type: "ADD_COMBAT_LOG",
      payload: "The next wave is approaching. Prepare your defenses!",
    });
  }

  // --- 6. State Cleanup ---

  // Ensure counts are not negative and are integers
  newState.food = Math.max(0, newState.food);
  newState.wood = Math.max(0, newState.wood);
  newState.stone = Math.max(0, newState.stone);
  newState.defenders = Math.max(0, Math.floor(newState.defenders));
  newState.gatherers = Math.max(0, Math.floor(newState.gatherers));
  newState.builders = Math.max(0, Math.floor(newState.builders));
  newState.idle = Math.max(0, Math.floor(newState.idle));

  // Handle starvation (now that food might be negative after actions)
  if (newState.food <= 0 && newState.population > 0) {
    const peopleToLose = Math.min(
      newState.population,
      Math.ceil(
        Math.abs(newState.food) / FOOD_CONSUMPTION_PER_POPULATION_PER_TICK,
      ),
    );
    newState = applyAction(newState, {
      type: "ADD_COMBAT_LOG",
      payload: `Starvation! You lost ${peopleToLose} villagers.`,
    });

    let remainingLosses = peopleToLose;

    // Remove from idle first
    const idleLost = Math.min(newState.idle, remainingLosses);
    if (idleLost > 0) {
      newState = applyAction(newState, {
        type: "REMOVE_IDLE",
        payload: idleLost,
      });
      remainingLosses -= idleLost;
    }

    // Then from gatherers
    const gatherersLost = Math.min(newState.gatherers, remainingLosses);
    if (gatherersLost > 0) {
      newState = applyAction(newState, {
        type: "REMOVE_GATHERER",
        payload: gatherersLost,
      });
      remainingLosses -= gatherersLost;
    }

    // Then from builders
    const buildersLost = Math.min(newState.builders, remainingLosses);
    if (buildersLost > 0) {
      newState = applyAction(newState, {
        type: "REMOVE_BUILDER",
        payload: buildersLost,
      });
      remainingLosses -= buildersLost;
    }

    // Finally from defenders
    const defendersLost = Math.min(newState.defenders, remainingLosses);
    if (defendersLost > 0) {
      newState = applyAction(newState, {
        type: "REMOVE_DEFENDER",
        payload: defendersLost,
      });
    }
  }

  // Ensure no negative population types before recalculating total population
  newState.idle = Math.max(0, newState.idle);
  newState.gatherers = Math.max(0, newState.gatherers);
  newState.builders = Math.max(0, newState.builders);
  newState.defenders = Math.max(0, newState.defenders);

  // Recalculate total population
  newState.population =
    newState.defenders + newState.gatherers + newState.idle + newState.builders;

  // Filter out completed construction jobs from the queue (done in applyAction but re-check for safety)
  newState.buildingAddedInTick = false;
  newState.constructionQueue = newState.constructionQueue.filter((job) => {
    const building = newState.buildings.find((b) => b.id === job.buildingId);
    return building ? !building.isConstructed : false;
  });

  return newState;
}
