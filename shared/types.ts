import type { BUDGETS, DIFFICULTIES, IMAGE_TYPES, SHAPES } from './constants';

export type Vec3 = [number, number, number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type Budget = (typeof BUDGETS)[number];
export type Shape = (typeof SHAPES)[number];
export type ImageMediaType = (typeof IMAGE_TYPES)[number];

/** Material key: the AI's MATERIALS plus the extra finishes the user can pick (wenge, black_matte, ...). */
export type MaterialKey = string;

/* ---------- the plan (normalized, safe to render) ---------- */
export interface Part {
  id: string;
  name: string;
  shape: Shape;
  size: Vec3 | null;
  radius: number;
  length: number;
  wall: number;
  position: Vec3;
  rotation: Vec3;
  material: MaterialKey;
  color: string | null;
  step: number;
  from: Vec3 | null;
  /** Wood finish picked in the customize tab. */
  finish?: string;
}

export interface Hardware { name: string; qty: number }
export interface Step {
  title: string; description: string; tools: string[]; hardware: Hardware[];
  tip: string; warning: string; finish: boolean;
}
export interface Tool { name: string; purpose: string; essential: boolean; estPrice: number }
export interface ShoppingItem {
  item: string; spec: string; qty: number; unit: string; unitPrice: number; store: string; url: string; estimated: boolean;
}
export interface Cut { name: string; length: number; width: number; angle: number }
export interface CutBoard { stock: string; stockLength: number; stockWidth: number; cuts: Cut[] }
export interface Store { name: string; location: string; url: string; sells: string; cutService: boolean; note: string }
export interface Source { url: string; title: string }
export interface Dimensions { width: number; height: number; depth: number }

/** Identical pieces share a letter (א, ב, ...) like a LEGO/IKEA parts page. */
export interface PartGroup {
  key: string; name: string; shape: Shape; material: MaterialKey; dims: number[]; ids: string[]; sample: Part; letter: string;
}

export interface Answer { q: string; a: string }

export interface Plan {
  title: string; summary: string; difficulty: string; timeHours: number; dimensions: Dimensions;
  parts: Part[]; steps: Step[]; shopping: ShoppingItem[]; cutList: CutBoard[]; tools: Tool[];
  priceNote: string; stores: Store[]; simplifications: string[]; sources: Source[];
  request: Partial<PlanRequestSummary>;
  groups: PartGroup[];
}

/** What the AI (or storage) hands us: untrusted until normalizePlan has run. */
export type RawPlan = { title?: unknown; [key: string]: unknown };

/* ---------- API contract (browser <-> server) ---------- */
export interface PlanRequestBody {
  prompt: string;
  image?: { mediaType: ImageMediaType; data: string };
  city: string;
  difficulty: Difficulty;
  budget: Budget;
  answers: Answer[];
}

/** What gets stored on the plan itself. */
export interface PlanRequestSummary {
  prompt: string; city: string; hadImage: boolean; difficulty: Difficulty; budget: Budget; answers: Answer[];
}

export interface Clarification { question: string; options: string[] }
export interface Questions { understanding: string; questions: Clarification[] }

export type PlanEvent =
  | { event: 'status'; data: { stage: string; text: string } }
  | { event: 'progress'; data: { parts: number; steps: number; title: string } };
