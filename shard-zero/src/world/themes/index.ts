import type { ThemeId } from '../../data/types';
import type { ThemeDef } from './Theme';
import { awakeningTheme } from './awakening';
import { cathedralTheme } from './cathedral';
import { industrialTheme } from './industrial';
import { voidTheme } from './void';
import { coreTheme } from './core';

export const THEMES: Record<ThemeId, ThemeDef> = {
  awakening: awakeningTheme,
  cathedral: cathedralTheme,
  industrial: industrialTheme,
  void: voidTheme,
  core: coreTheme,
};
