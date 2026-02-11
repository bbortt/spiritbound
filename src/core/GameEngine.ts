import type { BuildingType, GameState, PopulationType } from "./types.ts";
import { initialGameState } from "./types.ts";
import { tick } from "../TickSystem.ts";
import { DefenseTower } from "./buildings/DefenseTower.ts";
import { v4 as uuidv4 } from "uuid";

type GameStateSubscriber = (state: GameState) => void;

class GameEngine {
  private gameState: GameState;
  private subscribers: GameStateSubscriber[] = [];
  private intervalId: number | undefined;

  constructor() {
    this.gameState = initialGameState;
    // Distribute initial population into idle workers, accounting for builders
    this.gameState.idle =
      this.gameState.population -
      this.gameState.defenders -
      this.gameState.gatherers -
      this.gameState.builders;
  }

  public getGameState(): GameState {
    return { ...this.gameState }; // Return a copy to prevent direct modification
  }

  public subscribe(callback: GameStateSubscriber): () => void {
    this.subscribers.push(callback);
    // Immediately notify the new subscriber with the current state
    callback(this.getGameState());
    return () => {
      this.unsubscribe(callback);
    };
  }

  private unsubscribe(callback: GameStateSubscriber): void {
    this.subscribers = this.subscribers.filter((sub) => sub !== callback);
  }

  private notifySubscribers(): void {
    const currentState = this.getGameState();
    this.subscribers.forEach((callback) => callback(currentState));
  }

  public start(): void {
    if (this.intervalId) {
      console.warn("GameEngine is already running.");
      return;
    }

    this.intervalId = setInterval(() => {
      this.gameState = tick(this.gameState);
      this.notifySubscribers();
    }, 1000) as unknown as number; // setInterval returns a number in Node.js, but a Node.js.Timeout in browser typings. Casting to number for broader compatibility.
    console.log("GameEngine started.");
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log("GameEngine stopped.");
    } else {
      console.warn("GameEngine is not running.");
    }
  }

  /**
   * Adjusts the number of workers in a specific category.
   * Ensures that workers are moved from/to 'idle' and total population is respected.
   */
  public assignWorkers(type: PopulationType, delta: number): void {
    const currentIdle = this.gameState.idle;
    const currentType = this.gameState[type];

    if (delta > 0) {
      // Assigning more workers to a role
      const canAssign = Math.min(delta, currentIdle);
      if (canAssign > 0) {
        this.gameState[type] += canAssign;
        this.gameState.idle -= canAssign;
        this.notifySubscribers();
      }
    } else if (delta < 0) {
      // Removing workers from a role
      const canRemove = Math.min(Math.abs(delta), currentType);
      if (canRemove > 0) {
        this.gameState[type] -= canRemove;
        this.gameState.idle += canRemove;
        this.notifySubscribers();
      }
    }
  }

  // Allow re-assigning population to idle if they are in other roles
  public movePopulationToIdle(type: PopulationType, amount: number): void {
    const currentType = this.gameState[type];
    const canMove = Math.min(amount, currentType);
    if (canMove > 0) {
      this.gameState[type] -= canMove;
      this.gameState.idle += canMove;
      this.notifySubscribers();
    }
  }

  public moveIdleToPopulation(type: PopulationType, amount: number): void {
    const currentIdle = this.gameState.idle;
    const canMove = Math.min(amount, currentIdle);
    if (canMove > 0) {
      this.gameState[type] += canMove;
      this.gameState.idle -= canMove;
      this.notifySubscribers();
    }
  }

  public startConstruction(buildingType: BuildingType): void {
    if (this.gameState.buildingAddedInTick) {
      // Don't allow adding multiple buildings in same tick
      return;
    }

    // For now, only DefenseTower is available, but this could be expanded
    if (buildingType === "DefenseTower") {
      const newBuildingId = `building-${uuidv4()}`; // Simple unique ID
      const newTower = new DefenseTower(newBuildingId);

      // Directly apply the action to the current gameState
      // In a more complex scenario, this might go into an 'action queue' for the next tick
      // For simplicity, we'll process it immediately here
      this.gameState.buildings.push(newTower);
      this.gameState.constructionQueue.push({
        buildingId: newTower.id,
        buildingType: newTower.type,
        constructionPointsCurrent: 0,
        constructionPointsRequired: newTower.constructionPointsRequired,
      });
      this.gameState.buildingAddedInTick = true;
      this.gameState.lastCombatResults.push(
        `Construction started on ${newTower.name}!`,
      );
      this.notifySubscribers();
    } else {
      console.warn(`Unknown building type: ${buildingType}`);
    }
  }
}

// Export a singleton instance of the GameEngine
export const gameEngine = new GameEngine();
