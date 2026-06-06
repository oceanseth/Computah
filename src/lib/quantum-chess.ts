export type Color = "white" | "black";
export type PieceType = "pawn" | "rook" | "knight" | "bishop" | "queen" | "king";

export interface Position {
  row: number;
  col: number;
}

export interface Piece {
  type: PieceType;
  color: Color;
  position: Position;
  id: string;
  isQuantum: boolean;
  quantumPositions?: Position[]; // additional superposition squares
  hasPhaseShifted: boolean;
}

export interface GameState {
  board: (Piece | null)[][];
  pieces: Piece[];
  currentPlayer: Color;
  moveCount: { white: number; black: number };
  gameOver: boolean;
  winner: Color | null;
  selectedPiece: string | null;
  validMoves: Position[];
  lastMove: { from: Position; to: Position } | null;
}

const BOARD_SIZE = 8;
const MAX_MOVES_PER_PLAYER = 30;

export const createInitialBoard = (): GameState => {
  const pieces: Piece[] = [];
  let id = 0;

  // Setup pawns
  for (let col = 0; col < BOARD_SIZE; col++) {
    pieces.push({
      type: "pawn",
      color: "white",
      position: { row: 6, col },
      id: `white-pawn-${id++}`,
      isQuantum: false,
      hasPhaseShifted: false,
    });
    pieces.push({
      type: "pawn",
      color: "black",
      position: { row: 1, col },
      id: `black-pawn-${id++}`,
      isQuantum: false,
      hasPhaseShifted: false,
    });
  }

  // Setup major pieces
  const backRowPieces: PieceType[] = [
    "rook",
    "knight",
    "bishop",
    "queen",
    "king",
    "bishop",
    "knight",
    "rook",
  ];
  backRowPieces.forEach((type, col) => {
    pieces.push({
      type,
      color: "white",
      position: { row: 7, col },
      id: `white-${type}-${col}`,
      isQuantum: false,
      hasPhaseShifted: false,
    });
    pieces.push({
      type,
      color: "black",
      position: { row: 0, col },
      id: `black-${type}-${col}`,
      isQuantum: false,
      hasPhaseShifted: false,
    });
  });

  const board: (Piece | null)[][] = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));

  pieces.forEach((piece) => {
    board[piece.position.row][piece.position.col] = piece;
  });

  return {
    board,
    pieces,
    currentPlayer: "white",
    moveCount: { white: 0, black: 0 },
    gameOver: false,
    winner: null,
    selectedPiece: null,
    validMoves: [],
    lastMove: null,
  };
};

const isValid = (pos: Position): boolean => {
  return pos.row >= 0 && pos.row < BOARD_SIZE && pos.col >= 0 && pos.col < BOARD_SIZE;
};

const getPieceAt = (board: (Piece | null)[][], pos: Position): Piece | null => {
  if (!isValid(pos)) return null;
  return board[pos.row][pos.col];
};

const isOpponentPiece = (piece: Piece | null, color: Color): boolean => {
  return piece !== null && piece.color !== color;
};

const isFriendlyPiece = (piece: Piece | null, color: Color): boolean => {
  return piece !== null && piece.color === color;
};

const getPawnMoves = (
  piece: Piece,
  board: (Piece | null)[][],
  hasPhaseShifted: boolean
): Position[] => {
  const moves: Position[] = [];
  const direction = piece.color === "white" ? -1 : 1;
  const startRow = piece.color === "white" ? 6 : 1;

  // Forward move
  const forward = { row: piece.position.row + direction, col: piece.position.col };
  if (isValid(forward) && !getPieceAt(board, forward)) {
    moves.push(forward);

    // Double move from start
    if (piece.position.row === startRow) {
      const doubleForward = {
        row: piece.position.row + 2 * direction,
        col: piece.position.col,
      };
      if (!getPieceAt(board, doubleForward)) {
        moves.push(doubleForward);
      }
    }
  }

  // Captures
  [-1, 1].forEach((dcol) => {
    const capture = { row: piece.position.row + direction, col: piece.position.col + dcol };
    const targetPiece = getPieceAt(board, capture);
    if (targetPiece && isOpponentPiece(targetPiece, piece.color)) {
      moves.push(capture);
    }
  });

  // Phase shift: jump over one piece
  if (!hasPhaseShifted) {
    const phaseJump = { row: piece.position.row + 2 * direction, col: piece.position.col };
    if (isValid(phaseJump) && getPieceAt(board, { row: piece.position.row + direction, col: piece.position.col })) {
      moves.push(phaseJump);
    }
  }

  return moves;
};

const getRookMoves = (
  piece: Piece,
  board: (Piece | null)[][],
  hasPhaseShifted: boolean
): Position[] => {
  const moves: Position[] = [];
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  directions.forEach(({ row: dr, col: dc }) => {
    let pos = { row: piece.position.row + dr, col: piece.position.col + dc };
    let blocked = false;

    while (isValid(pos) && !blocked) {
      const target = getPieceAt(board, pos);
      if (isFriendlyPiece(target, piece.color)) {
        blocked = true;
      } else if (isOpponentPiece(target, piece.color)) {
        moves.push(pos);
        blocked = true;
      } else {
        moves.push(pos);
      }
      pos = { row: pos.row + dr, col: pos.col + dc };
    }

    // Phase shift through one piece
    if (!hasPhaseShifted && blocked && moves.length > 0) {
      const lastMove = moves[moves.length - 1];
      const phasePos = { row: lastMove.row + dr, col: lastMove.col + dc };
      if (isValid(phasePos) && !isFriendlyPiece(getPieceAt(board, phasePos), piece.color)) {
        moves.push(phasePos);
      }
    }
  });

  return moves;
};

const getKnightMoves = (piece: Piece, board: (Piece | null)[][]): Position[] => {
  const moves: Position[] = [];
  const offsets = [
    { row: -2, col: -1 },
    { row: -2, col: 1 },
    { row: -1, col: -2 },
    { row: -1, col: 2 },
    { row: 1, col: -2 },
    { row: 1, col: 2 },
    { row: 2, col: -1 },
    { row: 2, col: 1 },
  ];

  offsets.forEach(({ row: dr, col: dc }) => {
    const pos = { row: piece.position.row + dr, col: piece.position.col + dc };
    if (isValid(pos)) {
      const target = getPieceAt(board, pos);
      if (!isFriendlyPiece(target, piece.color)) {
        moves.push(pos);
      }
    }
  });

  return moves;
};

const getBishopMoves = (piece: Piece, board: (Piece | null)[][]): Position[] => {
  const moves: Position[] = [];
  const directions = [
    { row: -1, col: -1 },
    { row: -1, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 1 },
  ];

  directions.forEach(({ row: dr, col: dc }) => {
    let pos = { row: piece.position.row + dr, col: piece.position.col + dc };
    while (isValid(pos)) {
      const target = getPieceAt(board, pos);
      if (isFriendlyPiece(target, piece.color)) break;
      moves.push(pos);
      if (isOpponentPiece(target, piece.color)) break;
      pos = { row: pos.row + dr, col: pos.col + dc };
    }
  });

  return moves;
};

const getQueenMoves = (piece: Piece, board: (Piece | null)[][]): Position[] => {
  return [
    ...getRookMoves(piece, board, false),
    ...getBishopMoves(piece, board),
  ];
};

const getKingMoves = (piece: Piece, board: (Piece | null)[][]): Position[] => {
  const moves: Position[] = [];
  const offsets = [
    { row: -1, col: -1 },
    { row: -1, col: 0 },
    { row: -1, col: 1 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ];

  offsets.forEach(({ row: dr, col: dc }) => {
    const pos = { row: piece.position.row + dr, col: piece.position.col + dc };
    if (isValid(pos)) {
      const target = getPieceAt(board, pos);
      if (!isFriendlyPiece(target, piece.color)) {
        moves.push(pos);
      }
    }
  });

  return moves;
};

export const getValidMoves = (
  piece: Piece,
  board: (Piece | null)[][],
  state: GameState
): Position[] => {
  switch (piece.type) {
    case "pawn":
      return getPawnMoves(piece, board, piece.hasPhaseShifted);
    case "rook":
      return getRookMoves(piece, board, piece.hasPhaseShifted);
    case "knight":
      return getKnightMoves(piece, board);
    case "bishop":
      return getBishopMoves(piece, board);
    case "queen":
      return getQueenMoves(piece, board);
    case "king":
      return getKingMoves(piece, board);
    default:
      return [];
  }
};

export const movePiece = (
  state: GameState,
  pieceId: string,
  toPos: Position
): GameState => {
  const newState = { ...state };
  const piece = newState.pieces.find((p) => p.id === pieceId);

  if (!piece || newState.gameOver) return newState;

  const oldPos = piece.position;
  const targetPiece = getPieceAt(newState.board, toPos);

  // Clear old position
  newState.board[oldPos.row][oldPos.col] = null;

  // Handle capture
  if (targetPiece) {
    newState.pieces = newState.pieces.filter((p) => p.id !== targetPiece.id);
  }

  // Move piece
  piece.position = toPos;
  piece.isQuantum = false; // Collapse any superposition
  newState.board[toPos.row][toPos.col] = piece;

  // Update move count
  newState.moveCount[newState.currentPlayer]++;

  // Check game over conditions
  if (newState.moveCount[newState.currentPlayer] >= MAX_MOVES_PER_PLAYER) {
    newState.gameOver = true;
    newState.winner = newState.currentPlayer === "white" ? "black" : "white";
  }

  // Check if opponent has no pieces of their major types
  const opponent = newState.currentPlayer === "white" ? "black" : "white";
  const opponentMajorPieces = newState.pieces.filter(
    (p) => p.color === opponent && (p.type === "queen" || p.type === "rook")
  );

  if (opponentMajorPieces.length === 0) {
    newState.gameOver = true;
    newState.winner = newState.currentPlayer;
  }

  // Switch player
  newState.currentPlayer = newState.currentPlayer === "white" ? "black" : "white";
  newState.selectedPiece = null;
  newState.validMoves = [];
  newState.lastMove = { from: oldPos, to: toPos };

  return newState;
};

export const selectPiece = (state: GameState, pieceId: string): GameState => {
  const newState = { ...state };
  const piece = newState.pieces.find((p) => p.id === pieceId);

  if (!piece || piece.color !== newState.currentPlayer) {
    return newState;
  }

  newState.selectedPiece = pieceId;
  newState.validMoves = getValidMoves(piece, newState.board, newState);

  return newState;
};

export const toggleQuantumMode = (state: GameState, pieceId: string): GameState => {
  const newState = { ...state };
  const piece = newState.pieces.find((p) => p.id === pieceId);

  if (!piece || piece.type !== "pawn") return newState;

  piece.isQuantum = !piece.isQuantum;
  return newState;
};

export const usePhaseShift = (state: GameState, pieceId: string): GameState => {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (piece) {
    piece.hasPhaseShifted = true;
  }
  return state;
};
