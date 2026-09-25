import type { LevelBuilder } from '../../world/LevelBuilder';
import type { ThemeId } from '../../world/Themes';
import type { WeaponId } from '../../weapons/WeaponDefs';

/** A world is data + a build script that places scenery, gameplay objects and objectives. */
export interface WorldDef {
  id: number;
  theme: ThemeId;
  name: string;
  subtitle: string;
  accent: string;
  size: number;
  /** Weapon awarded when this world is completed. */
  reward?: WeaponId;
  build(b: LevelBuilder): void;
}
