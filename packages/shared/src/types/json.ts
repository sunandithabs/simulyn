/**
 * Shapes of the JSON-encoded string columns on `Problem`.
 *
 * SQLite has no native JSON/array columns, so these are stored as strings and
 * parsed at the edges. Use the helpers in `src/utils/json.ts` to read them.
 */
import type { LanguageKey } from '../constants/languages';

/** Problem.starterCode — per-language stubs shown in the editor. */
export type StarterCode = Partial<Record<LanguageKey, string>>;

/** Types the execution harness knows how to marshal (Phase 3). */
export type HarnessType =
  | 'int'
  | 'double'
  | 'string'
  | 'bool'
  | 'intArray'
  | 'stringArray'
  | 'listNode'
  | 'treeNode'
  | 'grid';

export interface HarnessParam {
  name: string;
  type: HarnessType;
}

/**
 * Problem.harness — how the generated driver calls the student's function.
 *
 * Test case wire format (TestCase.input / TestCase.expected):
 *   input    — one JSON literal per line, in `params` order
 *   expected — a single JSON literal matching `returnType`
 */
export interface HarnessSpec {
  funcName: string;
  params: HarnessParam[];
  returnType: HarnessType;
  /** Optional per-language function name override. */
  funcNameByLang?: Partial<Record<LanguageKey, string>>;
  /**
   * Output canonicalisation applied before comparing to `expected`, for
   * problems whose answer is order-insensitive.
   *   sortArray — sort the returned array
   *   sortRows  — sort each row, then sort the rows
   */
  normalize?: 'sortArray' | 'sortRows';
}

/** Problem.examples — worked examples rendered above the editor. */
export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

/** Problem.questions — electronics numeric-answer questions. */
export interface ElectronicsQuestion {
  id: string;
  text: string;
  answer: number;
  tolerance: number;
  unit?: string;
}

/** Problem.params — electronics circuit parameters. */
export type ElectronicsParams = Record<string, number | string>;

/** Problem.constraints / Problem.tags — JSON string arrays. */
export type StringList = string[];
