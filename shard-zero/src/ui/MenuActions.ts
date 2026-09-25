/** Everything the menus can ask the game to do. Implemented by Game. */
export interface MenuActions {
  play(): void;
  startLevel(index: number): void;
  resume(): void;
  restartLevel(): void;
  retryCheckpoint(): void;
  toMenu(): void;
  nextLevel(): void;
  openSettings(returnTo: string): void;
  closeSettings(): void;
  showScreen(name: string): void;
  toggleFullscreen(): void;
  settingsChanged(): void;
  resetProgress(): void;
}

export const LOGO_HTML = '<span class="a">SHARD</span><span class="sl">//</span><span class="b">ZERO</span>';
