export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type PieceColor = 'w' | 'b';

export interface Position {
  file: number; // 0-7 (a-h)
  rank: number; // 0-7 (1-8)
}

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  position: Position;
}

export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'master';

export type GameMode = 'ai' | 'local';

export interface GameConfig {
  mode: GameMode;
  playerColor?: PieceColor;
  aiDifficulty?: Difficulty;
}

export interface MoveResult {
  from: Position;
  to: Position;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
}
