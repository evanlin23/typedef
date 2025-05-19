// src/features/animation/ffmpegConstants.ts
export const OUTPUT_WIDTH = 720;
export const OUTPUT_HEIGHT = 1280;
export const FPS = 60;
export const MAX_FILE_SIZE_MB = 20; // This might be page-specific for error messages, but the value can be shared.

export const PRE_ZOOMPAN_UPSCALE_FACTOR = 8;
export const OVERSCAN_BORDER_FACTOR = 1.5;

export const DEFAULT_RELATIVE_ZOOM_IN_FACTOR = 6;
export const DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE = 2;

export const INITIAL_ZOOM_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

// Durations
export const DURATION_HOLD_START = 0.05;
export const DURATION_ZOOM_OUT = 0.90;
export const DURATION_PAN = 1.0;
export const DURATION_ZOOM_IN = 0.90;
export const DURATION_HOLD_END = 0.05;

export const TOTAL_DURATION_SEC =
  DURATION_HOLD_START +
  DURATION_ZOOM_OUT +
  DURATION_PAN +
  DURATION_ZOOM_IN +
  DURATION_HOLD_END;

// For MultiImageAnimatorPage
export const TRANSITION_DURATION_SEC = 0.5;
export const TRANSITION_OVERLAP_SEC = 0.25;