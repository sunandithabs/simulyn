/**
 * Proctoring violation catalogue. Mirrors the `ViolationType` enum in
 * prisma/schema.prisma.
 *
 * `weight` is subtracted from the attempt's integrity score (starts at 100).
 * `alert` is shown to the student the moment the violation is detected.
 * `critical` violations trigger the audio alert on the teacher proctor view.
 */
export const VIOLATION_TYPE_KEYS = [
  'COPY',
  'PASTE',
  'CUT',
  'RIGHTCLICK',
  'SELECTION',
  'DEVTOOLS',
  'TABSWITCH',
  'BLUR',
  'REFRESH',
  'CLOSE',
  'MULTIMONITOR',
  'FULLSCREEN',
  'SCREENSHOT',
  'MANUAL',
] as const;

export type ViolationTypeKey = (typeof VIOLATION_TYPE_KEYS)[number];

export interface ViolationTypeDefinition {
  key: ViolationTypeKey;
  label: string;
  /** Integrity-score penalty. */
  weight: number;
  /** Message shown to the student. */
  alert: string;
  /** Message shown in the teacher's live violation feed ({name} = student). */
  teacherAlert: string;
  severity: 'low' | 'medium' | 'high';
  critical: boolean;
}

export const VIOLATION_TYPES: Record<ViolationTypeKey, ViolationTypeDefinition> = {
  COPY: {
    key: 'COPY',
    label: 'Copy',
    weight: 5,
    alert: 'Copying is disabled during the exam. This action has been logged.',
    teacherAlert: '{name} copied text from the exam',
    severity: 'medium',
    critical: false,
  },
  PASTE: {
    key: 'PASTE',
    label: 'Paste',
    weight: 10,
    alert: 'Only content copied from inside this exam can be pasted. This has been logged.',
    teacherAlert: '{name} tried to paste content from outside the exam',
    severity: 'high',
    critical: true,
  },
  CUT: {
    key: 'CUT',
    label: 'Cut',
    weight: 5,
    alert: 'Cutting is disabled during the exam. This action has been logged.',
    teacherAlert: '{name} cut text from the exam',
    severity: 'medium',
    critical: false,
  },
  RIGHTCLICK: {
    key: 'RIGHTCLICK',
    label: 'Right Click',
    weight: 2,
    alert: 'The context menu is disabled during the exam.',
    teacherAlert: '{name} opened the context menu',
    severity: 'low',
    critical: false,
  },
  SELECTION: {
    key: 'SELECTION',
    label: 'Text Selection',
    weight: 1,
    alert: 'Selecting the problem text is restricted during the exam.',
    teacherAlert: '{name} selected problem text',
    severity: 'low',
    critical: false,
  },
  DEVTOOLS: {
    key: 'DEVTOOLS',
    label: 'Developer Tools',
    weight: 25,
    alert: 'Developer tools are not allowed. Your instructor has been notified.',
    teacherAlert: '{name} opened developer tools',
    severity: 'high',
    critical: true,
  },
  TABSWITCH: {
    key: 'TABSWITCH',
    label: 'Tab Switch',
    weight: 15,
    alert: 'You left the exam tab. Stay on this page until you submit.',
    teacherAlert: '{name} switched away from the exam tab',
    severity: 'high',
    critical: true,
  },
  BLUR: {
    key: 'BLUR',
    label: 'Window Blur',
    weight: 10,
    alert: 'The exam window lost focus. Keep it focused until you submit.',
    teacherAlert: '{name} moved focus out of the exam window',
    severity: 'medium',
    critical: false,
  },
  REFRESH: {
    key: 'REFRESH',
    label: 'Page Refresh',
    weight: 15,
    alert: 'Reloading the exam page is logged as a violation.',
    teacherAlert: '{name} attempted to reload the exam page',
    severity: 'high',
    critical: true,
  },
  CLOSE: {
    key: 'CLOSE',
    label: 'Close Attempt',
    weight: 20,
    alert: 'Closing the exam before submitting is logged as a violation.',
    teacherAlert: '{name} attempted to close the exam',
    severity: 'high',
    critical: true,
  },
  MULTIMONITOR: {
    key: 'MULTIMONITOR',
    label: 'Multiple Monitors',
    weight: 20,
    alert: 'Multiple displays detected. Disconnect extra monitors to continue.',
    teacherAlert: '{name} is using multiple displays',
    severity: 'high',
    critical: true,
  },
  FULLSCREEN: {
    key: 'FULLSCREEN',
    label: 'Fullscreen Exit',
    weight: 10,
    alert: 'You exited fullscreen mode. Please return to fullscreen.',
    teacherAlert: '{name} exited fullscreen mode',
    severity: 'medium',
    critical: false,
  },
  SCREENSHOT: {
    key: 'SCREENSHOT',
    label: 'Screenshot',
    weight: 20,
    alert: 'Screenshots are not permitted during the exam.',
    teacherAlert: '{name} attempted to take a screenshot',
    severity: 'high',
    critical: true,
  },
  MANUAL: {
    key: 'MANUAL',
    label: 'Manual Flag',
    weight: 0,
    alert: 'Your instructor flagged this attempt for review.',
    teacherAlert: '{name} was flagged manually',
    severity: 'medium',
    critical: false,
  },
};

export const VIOLATION_TYPE_LIST: ViolationTypeDefinition[] = VIOLATION_TYPE_KEYS.map(
  (k) => VIOLATION_TYPES[k],
);

export const INITIAL_INTEGRITY_SCORE = 100;

/**
 * Violations at or above this count flag the attempt and remove the student
 * from the exam. Counted from the attempt's `violationBaseline`, so a student a
 * proctor readmits starts again from zero rather than being ejected instantly.
 */
export const FLAG_THRESHOLD = 10;

/** Integrity score bands used for the color-coded proctor cards. */
export const INTEGRITY_BANDS = {
  clean: { min: 85, color: 'green' },
  watch: { min: 60, color: 'yellow' },
  flagged: { min: 0, color: 'red' },
} as const;

export function violationWeight(key: ViolationTypeKey): number {
  return VIOLATION_TYPES[key]?.weight ?? 0;
}

export function isViolationTypeKey(value: string): value is ViolationTypeKey {
  return (VIOLATION_TYPE_KEYS as readonly string[]).includes(value);
}
