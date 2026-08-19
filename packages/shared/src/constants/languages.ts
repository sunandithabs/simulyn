/**
 * Supported execution languages.
 *
 * `key` is the wire format used by the execution API (POST /execute/run).
 * `enumValue` is the Prisma `Language` enum member persisted on submissions.
 * `monacoId` is the Monaco Editor language id used by the frontend.
 */
export const LANGUAGE_KEYS = ['python', 'javascript', 'cpp', 'java'] as const;

export type LanguageKey = (typeof LANGUAGE_KEYS)[number];
export type LanguageEnumValue = 'PYTHON' | 'JAVASCRIPT' | 'CPP' | 'JAVA';

export interface LanguageDefinition {
  key: LanguageKey;
  enumValue: LanguageEnumValue;
  label: string;
  monacoId: string;
  extension: string;
  /** Whether the language needs a compile step before running. */
  compiled: boolean;
  /** Comment prefix, used when generating starter-code stubs. */
  commentPrefix: string;
}

export const LANGUAGES: Record<LanguageKey, LanguageDefinition> = {
  python: {
    key: 'python',
    enumValue: 'PYTHON',
    label: 'Python 3',
    monacoId: 'python',
    extension: 'py',
    compiled: false,
    commentPrefix: '#',
  },
  javascript: {
    key: 'javascript',
    enumValue: 'JAVASCRIPT',
    label: 'JavaScript (Node)',
    monacoId: 'javascript',
    extension: 'js',
    compiled: false,
    commentPrefix: '//',
  },
  cpp: {
    key: 'cpp',
    enumValue: 'CPP',
    label: 'C++17',
    monacoId: 'cpp',
    extension: 'cpp',
    compiled: true,
    commentPrefix: '//',
  },
  java: {
    key: 'java',
    enumValue: 'JAVA',
    label: 'Java 17',
    monacoId: 'java',
    extension: 'java',
    compiled: true,
    commentPrefix: '//',
  },
};

export const LANGUAGE_LIST: LanguageDefinition[] = LANGUAGE_KEYS.map((k) => LANGUAGES[k]);

export const DEFAULT_LANGUAGE: LanguageKey = 'python';

const ENUM_TO_KEY: Record<LanguageEnumValue, LanguageKey> = {
  PYTHON: 'python',
  JAVASCRIPT: 'javascript',
  CPP: 'cpp',
  JAVA: 'java',
};

export function languageKeyFromEnum(value: LanguageEnumValue): LanguageKey {
  return ENUM_TO_KEY[value];
}

export function languageEnumFromKey(key: LanguageKey): LanguageEnumValue {
  return LANGUAGES[key].enumValue;
}

export function isLanguageKey(value: string): value is LanguageKey {
  return (LANGUAGE_KEYS as readonly string[]).includes(value);
}
