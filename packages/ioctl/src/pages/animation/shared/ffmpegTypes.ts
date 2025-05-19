// src/features/animation/ffmpegTypes.ts
export interface Point {
  x: number;
  y: number;
}

// This is used by both pages, so it can be shared.
// In MultiImageAnimatorPage, ImageItem already includes these.
// In ImageAnimatorPage, these come from imageRef.current and points state.
export interface AnimationItemData {
  points: Point[];
  naturalWidth: number;
  naturalHeight: number;
}

export interface ZoomSettings {
  relativeZoomInFactor: number;
  zoomLevelOutEffective: number;
}