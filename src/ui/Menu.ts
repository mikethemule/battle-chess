import type { GameConfig, Difficulty, PieceColor, GameMode } from '../core/types';

type MenuCallback = (config: GameConfig) => void;

/**
 * MainMenu - Displays the game's main menu with options for game mode, player color, and difficulty
 * Uses safe DOM methods (createElement + textContent) instead of innerHTML to prevent XSS
 */
export class MainMenu {
  private container: HTMLElement;
  private menuElement: HTMLElement | null = null;
  private onStartGame: MenuCallback | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Set the callback to be called when the game starts
   */
  setOnStartGame(callback: MenuCallback): void {
    this.onStartGame = callback;
  }

  /**
   * Show the main menu
   */
  show(): void {
    if (this.menuElement) return;

    // Create menu using safe DOM methods (NO innerHTML!)
    const menu = document.createElement('div');
    menu.className = 'main-menu';

    const title = document.createElement('h1');
    title.textContent = 'Battle Chess';
    menu.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'menu-subtitle';
    subtitle.textContent = 'Fantasy Edition';
    menu.appendChild(subtitle);

    // Game Mode select
    const modeLabel = document.createElement('label');
    modeLabel.className = 'menu-label';
    modeLabel.textContent = 'Game Mode';
    menu.appendChild(modeLabel);

    const modeSelect = document.createElement('select');
    modeSelect.id = 'game-mode';
    modeSelect.className = 'menu-select';

    const aiOption = document.createElement('option');
    aiOption.value = 'ai';
    aiOption.textContent = 'vs Computer';
    modeSelect.appendChild(aiOption);

    const localOption = document.createElement('option');
    localOption.value = 'local';
    localOption.textContent = 'Local Multiplayer';
    modeSelect.appendChild(localOption);

    menu.appendChild(modeSelect);

    // AI Options container
    const aiOptions = document.createElement('div');
    aiOptions.id = 'ai-options';

    // Play As select
    const colorLabel = document.createElement('label');
    colorLabel.className = 'menu-label';
    colorLabel.textContent = 'Play As';
    aiOptions.appendChild(colorLabel);

    const colorSelect = document.createElement('select');
    colorSelect.id = 'player-color';
    colorSelect.className = 'menu-select';
    const colorOptions = [
      { value: 'w', text: 'White' },
      { value: 'b', text: 'Black' },
      { value: 'random', text: 'Random' }
    ];
    colorOptions.forEach(({ value, text }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      colorSelect.appendChild(opt);
    });
    aiOptions.appendChild(colorSelect);

    // Difficulty select
    const diffLabel = document.createElement('label');
    diffLabel.className = 'menu-label';
    diffLabel.textContent = 'Difficulty';
    aiOptions.appendChild(diffLabel);

    const diffSelect = document.createElement('select');
    diffSelect.id = 'difficulty';
    diffSelect.className = 'menu-select';
    const difficulties = ['Beginner', 'Easy', 'Medium', 'Hard', 'Master'];
    difficulties.forEach((text) => {
      const opt = document.createElement('option');
      opt.value = text.toLowerCase();
      opt.textContent = text;
      if (text === 'Medium') opt.selected = true;
      diffSelect.appendChild(opt);
    });
    aiOptions.appendChild(diffSelect);

    menu.appendChild(aiOptions);

    // Start button
    const startBtn = document.createElement('button');
    startBtn.className = 'menu-button';
    startBtn.textContent = 'Start Game';
    startBtn.style.marginTop = '20px';
    startBtn.addEventListener('click', () => this.handleStart());
    menu.appendChild(startBtn);

    // Toggle AI options visibility
    modeSelect.addEventListener('change', () => {
      aiOptions.style.display = modeSelect.value === 'ai' ? 'block' : 'none';
    });

    this.menuElement = menu;
    this.container.appendChild(menu);
  }

  /**
   * Hide the main menu
   */
  hide(): void {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
  }

  /**
   * Handle the start game button click
   */
  private handleStart(): void {
    const modeElement = document.getElementById('game-mode') as HTMLSelectElement | null;
    const colorElement = document.getElementById('player-color') as HTMLSelectElement | null;
    const difficultyElement = document.getElementById('difficulty') as HTMLSelectElement | null;

    if (!modeElement) return;

    const mode = modeElement.value as GameMode;
    let playerColor: PieceColor | undefined;

    if (mode === 'ai' && colorElement) {
      const colorValue = colorElement.value;
      playerColor = colorValue === 'random'
        ? (Math.random() > 0.5 ? 'w' : 'b')
        : colorValue as PieceColor;
    }

    const config: GameConfig = {
      mode,
      playerColor,
      aiDifficulty: mode === 'ai' && difficultyElement
        ? difficultyElement.value as Difficulty
        : undefined,
    };

    if (this.onStartGame) this.onStartGame(config);
  }
}
