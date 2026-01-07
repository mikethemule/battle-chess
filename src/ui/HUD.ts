import type { PieceColor, PieceType } from '../core/types';

const PIECE_SYMBOLS: Record<PieceType, string> = {
  k: '\u2654', // King
  q: '\u2655', // Queen
  r: '\u2656', // Rook
  b: '\u2657', // Bishop
  n: '\u2658', // Knight
  p: '\u2659'  // Pawn
};

type NewGameCallback = () => void;

/**
 * GameHUD - Displays the in-game heads-up display with turn indicator, status, and captured pieces
 * Uses safe DOM methods (createElement + textContent) instead of innerHTML to prevent XSS
 */
export class GameHUD {
  private container: HTMLElement;
  private hudElement: HTMLElement | null = null;
  private capturedWhite: PieceType[] = [];
  private capturedBlack: PieceType[] = [];
  private onNewGame: NewGameCallback | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Set the callback for new game button
   */
  setOnNewGame(callback: NewGameCallback): void {
    this.onNewGame = callback;
  }

  /**
   * Show the HUD
   */
  show(): void {
    if (this.hudElement) return;
    this.hudElement = document.createElement('div');
    this.hudElement.className = 'game-hud';
    this.updateHUD('w');
    this.container.appendChild(this.hudElement);
  }

  /**
   * Hide the HUD
   */
  hide(): void {
    this.hudElement?.remove();
    this.hudElement = null;
  }

  /**
   * Update the turn indicator
   */
  updateTurn(player: PieceColor): void {
    this.updateHUD(player);
  }

  /**
   * Update the status text
   */
  updateStatus(status: string): void {
    const statusEl = this.hudElement?.querySelector('.hud-status');
    if (statusEl) statusEl.textContent = status;
  }

  /**
   * Add a captured piece to the display
   */
  addCapturedPiece(piece: PieceType, capturedBy: PieceColor): void {
    if (capturedBy === 'w') this.capturedWhite.push(piece);
    else this.capturedBlack.push(piece);
    this.updateCapturedDisplay();
  }

  /**
   * Reset the HUD state
   */
  reset(): void {
    this.capturedWhite = [];
    this.capturedBlack = [];
    this.updateHUD('w');
  }

  /**
   * Rebuild the HUD content
   */
  private updateHUD(currentPlayer: PieceColor): void {
    if (!this.hudElement) return;

    // Clear and rebuild using safe DOM methods
    while (this.hudElement.firstChild) {
      this.hudElement.removeChild(this.hudElement.firstChild);
    }

    const turnDiv = document.createElement('div');
    turnDiv.className = 'hud-turn';
    turnDiv.textContent = currentPlayer === 'w' ? "White's Turn" : "Black's Turn";
    this.hudElement.appendChild(turnDiv);

    const statusDiv = document.createElement('div');
    statusDiv.className = 'hud-status';
    this.hudElement.appendChild(statusDiv);

    const capturedDiv = document.createElement('div');
    capturedDiv.className = 'hud-captured';

    const whiteTitle = document.createElement('div');
    whiteTitle.className = 'hud-captured-title';
    whiteTitle.textContent = 'White captured:';
    capturedDiv.appendChild(whiteTitle);

    const whitePieces = document.createElement('div');
    whitePieces.className = 'hud-captured-pieces';
    whitePieces.id = 'captured-white';
    whitePieces.textContent = this.getCapturedString(this.capturedWhite);
    capturedDiv.appendChild(whitePieces);

    const blackTitle = document.createElement('div');
    blackTitle.className = 'hud-captured-title';
    blackTitle.textContent = 'Black captured:';
    blackTitle.style.marginTop = '8px';
    capturedDiv.appendChild(blackTitle);

    const blackPieces = document.createElement('div');
    blackPieces.className = 'hud-captured-pieces';
    blackPieces.id = 'captured-black';
    blackPieces.textContent = this.getCapturedString(this.capturedBlack);
    capturedDiv.appendChild(blackPieces);

    this.hudElement.appendChild(capturedDiv);

    const newGameBtn = document.createElement('button');
    newGameBtn.className = 'hud-button';
    newGameBtn.textContent = 'New Game';
    newGameBtn.addEventListener('click', () => {
      if (this.onNewGame) {
        this.onNewGame();
      } else {
        window.location.reload();
      }
    });
    this.hudElement.appendChild(newGameBtn);
  }

  /**
   * Update just the captured pieces display
   */
  private updateCapturedDisplay(): void {
    const whiteEl = document.getElementById('captured-white');
    const blackEl = document.getElementById('captured-black');
    if (whiteEl) whiteEl.textContent = this.getCapturedString(this.capturedWhite);
    if (blackEl) blackEl.textContent = this.getCapturedString(this.capturedBlack);
  }

  /**
   * Convert an array of piece types to a display string
   */
  private getCapturedString(pieces: PieceType[]): string {
    return pieces.length === 0 ? '-' : pieces.map(p => PIECE_SYMBOLS[p]).join(' ');
  }

  /**
   * Show the game over modal
   */
  showGameOver(winner: PieceColor | 'draw', reason: string): void {
    const modal = document.createElement('div');
    modal.className = 'game-over-modal';

    const title = document.createElement('h2');
    if (winner === 'draw') {
      title.textContent = 'Draw!';
    } else {
      title.textContent = winner === 'w' ? 'White Wins!' : 'Black Wins!';
    }
    modal.appendChild(title);

    const reasonP = document.createElement('p');
    reasonP.textContent = reason;
    modal.appendChild(reasonP);

    const playAgainBtn = document.createElement('button');
    playAgainBtn.className = 'menu-button';
    playAgainBtn.textContent = 'Play Again';
    playAgainBtn.addEventListener('click', () => {
      if (this.onNewGame) {
        modal.remove();
        this.onNewGame();
      } else {
        window.location.reload();
      }
    });
    modal.appendChild(playAgainBtn);

    this.container.appendChild(modal);
  }
}
