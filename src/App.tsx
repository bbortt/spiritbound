import { useEffect, useState } from 'react';
import { gameEngine } from './GameEngine';
import type { GameState as GameStateType } from './types.ts';


function App() {
  const [gameState, setGameState] = useState<GameStateType | null>(null);

  useEffect(() => {
    // Start the game engine when the component mounts
    gameEngine.start();

    // Subscribe to game state changes
    const unsubscribe = gameEngine.subscribe((newState) => {
      setGameState(newState);
    });

    // Clean up subscription when the component unmounts
    return () => {
      gameEngine.stop(); // Stop the engine as well
      unsubscribe();
    };
  }, []); // Empty dependency array means this effect runs once on mount and clean up on unmount

  if (!gameState) {
    return <div>Loading Game...</div>;
  }

  const handleAssignWorker = (type: 'defenders' | 'gatherers', delta: number) => {
    if (delta > 0) { // Moving idle to a role
      gameEngine.moveIdleToPopulation(type, delta);
    } else { // Moving from a role to idle
      gameEngine.movePopulationToIdle(type, Math.abs(delta));
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Idle Strategy Game</h1>

      <h2>Current State:</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 15px', marginBottom: '20px' }}>
        <div>Population:</div> <div>{gameState.population}</div>
        <div>Food:</div> <div>{gameState.food.toFixed(1)}</div>
        <div>Wood:</div> <div>{gameState.wood.toFixed(1)}</div>
        <div>Stone:</div> <div>{gameState.stone.toFixed(1)}</div>
        <div>Defenders:</div> <div>{gameState.defenders}</div>
        <div>Gatherers:</div> <div>{gameState.gatherers}</div>
        <div>Idle:</div> <div>{gameState.idle}</div>
        <div>Current Wave:</div> <div>{gameState.currentWave}</div>
        <div>Next Wave In:</div> <div>{gameState.nextWaveInSeconds}s</div>
      </div>

      <h2>Assign Workers:</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '10px' }}>
        <div>Defenders:</div>
        <button onClick={() => handleAssignWorker('defenders', -1)}>-</button>
        <button onClick={() => handleAssignWorker('defenders', 1)}>+</button>

        <div>Gatherers:</div>
        <button onClick={() => handleAssignWorker('gatherers', -1)}>-</button>
        <button onClick={() => handleAssignWorker('gatherers', 1)}>+</button>
        
        {/* Idle workers are adjusted automatically when assigning to defenders/gatherers */}
      </div>

      <div style={{ margin: '20px 0', padding: '0 5px', fontStyle: 'italic', color: '#666', border: '1px solid black' , height: '20vh', overflowY: 'hidden' }}>
       {gameState.lastCombatResults.reverse().map(combatResult => {
          return (
              <p>{combatResult}</p>
          )
        })}
      </div>
    </div>
  );
}

export default App;
