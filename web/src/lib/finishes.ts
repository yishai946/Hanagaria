import type { Dimensions } from '@shared/types';

export interface Option { key: string; name: string; color?: string }
export interface Custom { dims: Dimensions | null; wood: string; woodFinish: string; metal: string }

// Choices offered in the "customize" tab. Keys match the procedural materials in three/assets.ts.
export const WOOD_TONES: Option[] = [
  { key: 'auto', name: 'כמו בתוכנית', color: '#e2bb83' },
  { key: 'pine', name: 'אורן', color: '#e2bb83' },
  { key: 'beech', name: 'בוק', color: '#e6c39a' },
  { key: 'oak', name: 'אלון', color: '#c9a16a' },
  { key: 'teak', name: 'טיק', color: '#a86f3c' },
  { key: 'walnut', name: 'אגוז', color: '#714a2e' },
  { key: 'wenge', name: 'וונגה', color: '#3b2a20' },
  { key: 'whitewash', name: 'מולבן', color: '#e9e2d3' },
];

export const WOOD_FINISHES: Option[] = [
  { key: 'auto', name: 'כמו בתוכנית' },
  { key: 'raw', name: 'גולמי' },
  { key: 'oil', name: 'שמן' },
  { key: 'satin', name: 'לכה סאטן' },
  { key: 'gloss', name: 'לכה מבריקה' },
];

export const METAL_FINISHES: Option[] = [
  { key: 'auto', name: 'כמו בתוכנית', color: '#2a2b2e' },
  { key: 'black_matte', name: 'שחור מט', color: '#232427' },
  { key: 'black_gloss', name: 'שחור מבריק', color: '#101113' },
  { key: 'raw_steel', name: 'ברזל גולמי', color: '#5d6168' },
  { key: 'stainless', name: 'נירוסטה', color: '#cfd3d8' },
  { key: 'white_coat', name: 'לבן', color: '#eceae4' },
  { key: 'brass', name: 'פליז', color: '#c9a24a' },
];

export const DEFAULT_CUSTOM: Custom = { dims: null, wood: 'auto', woodFinish: 'auto', metal: 'auto' };

// Which plan materials count as wood / painted-or-bare metal (rubber and glass are never restyled).
export const WOOD_MATERIALS = new Set(['pine', 'pine_treated', 'beech', 'oak', 'walnut', 'teak', 'plywood', 'mdf', 'osb']);
export const METAL_MATERIALS = new Set(['steel', 'black_steel', 'galvanized', 'stainless', 'aluminum', 'brass']);
