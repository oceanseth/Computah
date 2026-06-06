'use client';

import { useState } from 'react';

type Player = 'X' | 'O' | null;

interface GameState {
  board: Player[];
  isXNext: boolean;
  winner: Player;
}

export function TicTacToe() {
  const [gameState, setGameState] = useState<GameState>({
    board: Array(9).fill(null),
    isXNext: true,
    winner: null,
  });

  const calculateWinner = (squares: Player[]): Player => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (let line of lines) {
      const [a, b, c] = line;
      if (
        squares[a] &&
        squares[a] === squares[b] &&
        squares[a] === squares[c]
      ) {
        return squares[a];
      }
    }
    return null;
  };

  const winner = calculateWinner(gameState.board);
  const isBoardFull = gameState.board.every((square) => square !== null);
  const isGameOver = winner !== null || isBoardFull;

  const handleClick = (index: number) => {
    if (gameState.board[index] !== null || winner !== null) {
      return;
    }

    const newBoard = [...gameState.board];
    newBoard[index] = gameState.isXNext ? 'X' : 'O';

    setGameState({
      board: newBoard,
      isXNext: !gameState.isXNext,
      winner: calculateWinner(newBoard),
    });
  };

  const handleReset = () => {
    setGameState({
      board: Array(9).fill(null),
      isXNext: true,
      winner: null,
    });
  };

  const getStatus = () => {
    if (winner) {
      return `Player ${winner} wins!`;
    }
    if (isBoardFull) {
      return "It's a draw!";
    }
    return `Current player: ${gameState.isXNext ? 'X' : 'O'}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="bg-panel border border-border rounded-lg p-8 max-w-sm w-full">
        <h1 className="text-3xl font-bold text-center text-foreground mb-6">
          Tic Tac Toe
        </h1>

        <div className="mb-6 p-4 bg-background rounded text-center">
          <p className="text-lg font-semibold text-accent">{getStatus()}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6 bg-border p-2 rounded">
          {gameState.board.map((value, index) => (
            <button
              key={index}
              onClick={() => handleClick(index)}
              disabled={isGameOver}
              className="w-20 h-20 bg-panel border-2 border-border rounded-lg text-3xl font-bold hover:bg-accent/10 transition-colors disabled:cursor-not-allowed"
              style={{
                color:
                  value === 'X'
                    ? '#5eead4'
                    : value === 'O'
                      ? '#34d399'
                      : 'transparent',
              }}
            >
              {value}
            </button>
          ))}
        </div>

        <button
          onClick={handleReset}
          className="w-full py-3 bg-accent text-background font-semibold rounded-lg hover:bg-accent/80 transition-colors"
        >
          Reset Game
        </button>
      </div>
    </div>
  );
}
