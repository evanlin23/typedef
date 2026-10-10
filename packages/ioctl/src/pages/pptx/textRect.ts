// PowerPoint lays out a shape's text inside the text rectangle of its preset
// geometry (the inscribed rectangle of an ellipse, the shaft of an arrow, ...),
// not the whole bounding box. These are the text rectangles of common presets,
// following the formulas in the presetShapeDefinitions of ECMA-376.

export interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const NONE: Insets = { left: 0, top: 0, right: 0, bottom: 0 };

// Distance from a quarter circle's corner to where a 45° line meets it, per radius
const CORNER = 1 - Math.SQRT1_2;

// keypoints are pptxtojson's adjust values divided by 50000
export function presetTextInsets(shape: string | undefined, w: number, h: number, keypoints: Record<string, number> = {}): Insets {
  const adj = (name: string, fallback: number) => (keypoints[name] !== undefined ? keypoints[name] * 50000 : fallback);
  const ss = Math.min(w, h);
  switch (shape) {
    case 'ellipse':
    case 'flowChartConnector':
    case 'wedgeEllipseCallout':
    case 'donut': {
      const x = (w / 2) * CORNER;
      const y = (h / 2) * CORNER;
      return { left: x, top: y, right: x, bottom: y };
    }
    case 'roundRect':
    case 'wedgeRoundRectCallout': {
      const inset = ((ss * adj('adj', 16667)) / 100000) * CORNER;
      return { left: inset, top: inset, right: inset, bottom: inset };
    }
    case 'flowChartAlternateProcess': {
      const inset = (ss / 6) * CORNER;
      return { left: inset, top: inset, right: inset, bottom: inset };
    }
    case 'plaque': {
      const inset = ((ss * adj('adj', 16667)) / 100000) * Math.SQRT1_2;
      return { left: inset, top: inset, right: inset, bottom: inset };
    }
    case 'octagon': {
      const inset = (ss * adj('adj', 29289)) / 200000;
      return { left: inset, top: inset, right: inset, bottom: inset };
    }
    case 'triangle': {
      const x1 = (w * adj('adj', 50000)) / 200000;
      return { left: x1, top: h / 2, right: w - (x1 + w / 2), bottom: 0 };
    }
    case 'rtTriangle':
      return { left: w / 12, top: (7 * h) / 12, right: (5 * w) / 12, bottom: h / 12 };
    case 'diamond':
    case 'flowChartDecision':
      return { left: w / 4, top: h / 4, right: w / 4, bottom: h / 4 };
    case 'rightArrow':
    case 'leftArrow': {
      const shaft = (h * adj('adj1', 50000)) / 200000;
      const head = (ss * adj('adj2', 50000)) / 100000;
      const inset = { left: 0, top: h / 2 - shaft, right: 0, bottom: h / 2 - shaft };
      // The text runs into the head as far as the shaft's height allows
      const into = h / 2 ? ((h / 2 - shaft) * head) / (h / 2) : 0;
      if (shape === 'rightArrow') inset.right = head - into;
      else inset.left = head - into;
      return inset;
    }
    case 'upArrow':
    case 'downArrow': {
      const shaft = (w * adj('adj1', 50000)) / 200000;
      const head = (ss * adj('adj2', 50000)) / 100000;
      const into = w / 2 ? ((w / 2 - shaft) * head) / (w / 2) : 0;
      const inset = { left: w / 2 - shaft, top: 0, right: w / 2 - shaft, bottom: 0 };
      if (shape === 'downArrow') inset.bottom = head - into;
      else inset.top = head - into;
      return inset;
    }
    case 'homePlate': {
      const point = (ss * adj('adj', 50000)) / 100000;
      return { left: 0, top: 0, right: point / 2, bottom: 0 };
    }
    case 'chevron': {
      const point = (ss * adj('adj', 50000)) / 100000;
      return { left: point, top: 0, right: point, bottom: 0 };
    }
    case 'can': {
      const lid = (ss * adj('adj', 25000)) / 100000;
      return { left: 0, top: lid, right: 0, bottom: 0 };
    }
    case 'cube': {
      const depth = (ss * adj('adj', 25000)) / 100000;
      return { left: 0, top: depth, right: depth, bottom: 0 };
    }
    case 'flowChartTerminator':
      return { left: (w * 1018) / 21600, top: (h * 3163) / 21600, right: (w * 1018) / 21600, bottom: (h * 3163) / 21600 };
    case 'flowChartPredefinedProcess':
      return { left: w / 8, top: 0, right: w / 8, bottom: 0 };
    case 'cloud':
    case 'cloudCallout':
      return { left: (w * 2977) / 21600, top: (h * 3262) / 21600, right: (w * 4513) / 21600, bottom: (h * 4263) / 21600 };
    default:
      return NONE;
  }
}
