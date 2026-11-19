// Shared between server (AI tool schema) and client (material list).
export const MATERIALS = {
  pine: 'אורן', pine_treated: 'אורן מוגן (אימפרגנט)', beech: 'בוק', oak: 'אלון', walnut: 'אגוז', teak: 'טיק',
  plywood: 'דיקט / לביד', mdf: 'MDF', osb: 'OSB',
  steel: 'ברזל', black_steel: 'ברזל צבוע שחור', galvanized: 'ברזל מגולוון', stainless: 'נירוסטה', aluminum: 'אלומיניום',
  brass: 'פליז (פרזול)', glass: 'זכוכית', rubber: 'גומי / רגליות',
} as const satisfies Record<string, string>;

export const DIFFICULTIES = ['קל', 'בינוני', 'קשה'] as const;
export const BUDGETS = ['זול', 'רגיל', 'יקר'] as const;

export const SHAPES = ['box', 'cylinder', 'tube', 'squareTube'] as const;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
