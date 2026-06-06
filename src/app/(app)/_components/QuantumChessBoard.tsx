"use client";

import React, { useState } from "react";
import {
  GameState,
  createInitialBoard,
  selectPiece,
  movePiece,
  Position,
  Piece,
} from "@/lib/quantum-chess";

export const QuantumChessBoard: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(createInitialBoard());

  const handleSquareClick = (row: number, col: number) => {
    const target = gameState.board[row][col];

    if (gameState.selectedPiece) {
      const validMove = gameState.validMoves.some(
        (m) => m.row === row && m.col === col
      );

      if (validMove) {
        setGameState(movePiece(gameState, gameState.selectedPiece, { row, col }));
        return;
      }
    }

    if (target && target.color === gameState.currentPlayer) {
      setGameState(selectPiece(gameState, target.id));
    } else {
      setGameState({
        ...gameState,
        selectedPiece: null,
        validMoves: [],
      });
    }
  };

  const handleReset = () => {
    setGameState(createInitialBoard());
  };

  const pieceUnicode: { [key: string]: string } = {
    "white-pawn": "♙",
    "white-rook": "♖",
    "white-knight": "♘",
    "white-bishop": "♗",
    "white-queen": "♕",
    "white-king": "♔",
    "black-pawn": "♟",
    "black-rook": "♜",
    "black-knight": "♞",
    "black-bishop": "♝",
    "black-queen": "♛",
    "black-king": "♚",
  };

  const getPieceSymbol = (piece: Piece | null) => {
    if (!piece) return "";
    return pieceUnicode[`${piece.color}-${piece.type}`] || "";
  };

  const renderSquare = (row: number, col: number) => {
    const piece = gameState.board[row][col];
    const isLight = (row + col) % 2 === 0;
    const isSelected = gameState.selectedPiece && piece?.id === gameState.selectedPiece;
    const isValidMove = gameState.validMoves.some(
      (m) => m.row === row && m.col === col
    );
    const isLastMove =
      (gameState.lastMove?.from.row === row && gameState.lastMove?.from.col === col) ||
      (gameState.lastMove?.to.row === row && gameState.lastMove?.to.col === col);

    return (
      <button
        key={`${row}-${col}`}
        onClick={() => handleSquareClick(row, col)}
        className={`w-12 h-12 flex items-center justify-center text-2xl font-bold border border-gray-400 transition-colors ${
          isLight ? "bg-amber-100" : "bg-amber-700"
        } ${isSelected ? "ring-2 ring-blue-500" : ""} ${
          isValidMove ? "ring-2 ring-green-500" : ""
        } ${isLastMove ? "bg-yellow-300" : ""} hover:opacity-75`}
      >
        {piece && (
          <span className={piece.color === "white" ? "text-white drop-shadow" : "text-black"}>
            {getPieceSymbol(piece)}
            {piece.isQuantum && <span className="absolute text-xs">⚛</span>}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="text-xl font-bold">
        {gameState.gameOver
          ? `Game Over! ${gameState.winner?.toUpperCase()} wins!`
          : `Current Player: ${gameState.currentPlayer.toUpperCase()}`}
      </div>

      <div className="text-sm text-gray-600">
        White moves: {gameState.moveCount.white}/{30} | Black moves:{" "}
        {gameState.moveCount.black}/{30}
      </div>

      <div className="grid gap-0 bg-gray-800 p-1 rounded-lg shadow-lg"
        style={{
          gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
          width: "fit-content",
        }}
      >
        {Array(8)
          .fill(null)
          .map((_, row) =>
            Array(8)
              .fill(null)
              .map((_, col) => renderSquare(row, col))
          )}
      </div>

      <button
        onClick={handleReset}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        New Game
      </button>

      <div className="text-xs text-gray-500 max-w-md text-center">
        <p><strong>Quantum Chess Rules:</strong></p>
        <p>• Each player has 30 moves to win, or game is lost</p>
        <p>• Capture all opponent queens and rooks to win instantly</p>
        <p>• Each piece type can phase shift through obstacles once</p>
        <p>• Last move is highlighted in yellow</p>
      </div>
    </div>
  );
};
