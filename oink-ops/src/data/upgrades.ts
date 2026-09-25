export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  costs: number[];
}

/** Permanent upgrades bought with coins between levels. */
export const UPGRADES: UpgradeDef[] = [
  { id: 'health', name: 'Hearty Hog', desc: '+20 max health per level', icon: '❤', costs: [60, 140, 260, 420] },
  { id: 'damage', name: 'Sizzling Shots', desc: '+12% weapon damage per level', icon: '✸', costs: [80, 180, 320, 500] },
  { id: 'mag', name: 'Bigger Belly Mag', desc: '+6 Bacon Blaster rounds per level', icon: '▤', costs: [70, 160, 300] },
  { id: 'reload', name: 'Quick Trotters', desc: '-12% reload time per level', icon: '↻', costs: [70, 160, 300] },
  { id: 'magnet', name: 'Coin Magnet', desc: 'Pull coins from further away', icon: '◎', costs: [50, 120, 240] },
];
