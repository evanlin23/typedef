// src/features/animation/ffmpegAnimationCore.ts
import type { AnimationItemData, ZoomSettings } from './ffmpegTypes';
import {
  OUTPUT_WIDTH, OUTPUT_HEIGHT, FPS, TOTAL_DURATION_SEC,
  PRE_ZOOMPAN_UPSCALE_FACTOR, OVERSCAN_BORDER_FACTOR,
  DURATION_HOLD_START, DURATION_ZOOM_OUT, DURATION_PAN, DURATION_ZOOM_IN,
  // DURATION_HOLD_END is derived or TOTAL_DURATION_SEC is used
} from './ffmpegConstants';

export function generateSingleClipFilterGraph(
  itemData: AnimationItemData,
  zoomSettings: ZoomSettings
): { filterGraph: string, logData: Record<string, string | number> } {
  const p1_orig = itemData.points[0];
  const p2_orig = itemData.points[1];
  const orig_iw = itemData.naturalWidth;
  const orig_ih = itemData.naturalHeight;

  if (orig_iw === 0 || orig_ih === 0) {
    throw new Error(`Image has zero dimensions. Width: ${orig_iw}, Height: ${orig_ih}.`);
  }
  if (!p1_orig || !p2_orig) {
      throw new Error(`Animation points are missing. P1: ${p1_orig}, P2: ${p2_orig}.`);
  }

  const totalFrames = Math.round(TOTAL_DURATION_SEC * FPS);

  // Intermediate Canvas (IC) - content area for zoompan
  const IC_WIDTH = OUTPUT_WIDTH * PRE_ZOOMPAN_UPSCALE_FACTOR;
  const IC_HEIGHT = OUTPUT_HEIGHT * PRE_ZOOMPAN_UPSCALE_FACTOR;

  // Scale original image to fit IC, then calculate padding
  const ic_scale_factor = Math.min(IC_WIDTH / orig_iw, IC_HEIGHT / orig_ih);
  const ic_scaled_iw = orig_iw * ic_scale_factor;
  const ic_scaled_ih = orig_ih * ic_scale_factor;
  const ic_pad_x = (IC_WIDTH - ic_scaled_iw) / 2;
  const ic_pad_y = (IC_HEIGHT - ic_scaled_ih) / 2;

  // Transform points from original image coords to IC coords
  const p1_ic_transformed = { x: p1_orig.x * ic_scale_factor + ic_pad_x, y: p1_orig.y * ic_scale_factor + ic_pad_y };
  const p2_ic_transformed = { x: p2_orig.x * ic_scale_factor + ic_pad_x, y: p2_orig.y * ic_scale_factor + ic_pad_y };

  // Zoompan Input (ZPI) canvas with borders for overscan
  const min_zoom_for_border_calc = Math.max(1, zoomSettings.zoomLevelOutEffective);
  const PAD_X_BORDER = Math.ceil((IC_WIDTH / min_zoom_for_border_calc) / 2);
  const PAD_Y_BORDER = Math.ceil((IC_HEIGHT / min_zoom_for_border_calc) / 2);
  const ZPI_WIDTH = IC_WIDTH + 2 * PAD_X_BORDER;
  const ZPI_HEIGHT = IC_HEIGHT + 2 * PAD_Y_BORDER;

  // Transform points from IC coords to ZPI coords
  const p1_zpi_transformed_x = parseFloat((p1_ic_transformed.x + PAD_X_BORDER).toFixed(4));
  const p1_zpi_transformed_y = parseFloat((p1_ic_transformed.y + PAD_Y_BORDER).toFixed(4));
  const p2_zpi_transformed_x = parseFloat((p2_ic_transformed.x + PAD_X_BORDER).toFixed(4));
  const p2_zpi_transformed_y = parseFloat((p2_ic_transformed.y + PAD_Y_BORDER).toFixed(4));
  
  // Frame counts for animation phases
  const f_hold_start_end = Math.round(DURATION_HOLD_START * FPS);
  const f_zoom_out_end = f_hold_start_end + Math.round(DURATION_ZOOM_OUT * FPS);
  const f_pan_end = f_zoom_out_end + Math.round(DURATION_PAN * FPS);
  // const f_zoom_in_end = f_pan_end + Math.round(DURATION_ZOOM_IN * FPS); // Total duration implies end of last phase

  const currentRelativeZoomIn = parseFloat(zoomSettings.relativeZoomInFactor.toFixed(4));
  // This factor is applied to zoomLevelOutEffective in the zoom expression.
  const currentZoomOutEffectiveWithOverscan = parseFloat((zoomSettings.zoomLevelOutEffective * OVERSCAN_BORDER_FACTOR).toFixed(4));

  // Ensure duration for division is not zero
  const durZoomOutFrames = Math.max(1, DURATION_ZOOM_OUT * FPS);
  const durPanFrames = Math.max(1, DURATION_PAN * FPS);
  const durZoomInFrames = Math.max(1, DURATION_ZOOM_IN * FPS);

  const zoomExpr =
    `if(lt(on,${f_hold_start_end}),${currentRelativeZoomIn},` +
    `if(lt(on,${f_zoom_out_end}),${currentRelativeZoomIn} - (${currentRelativeZoomIn}-${currentZoomOutEffectiveWithOverscan})*(on-${f_hold_start_end})/(${durZoomOutFrames}),` + 
    `if(lt(on,${f_pan_end}),${currentZoomOutEffectiveWithOverscan},` +
    `if(lt(on,${f_pan_end + Math.round(DURATION_ZOOM_IN * FPS)}),${currentZoomOutEffectiveWithOverscan} + (${currentRelativeZoomIn}-${currentZoomOutEffectiveWithOverscan})*(on-${f_pan_end})/(${durZoomInFrames}),` + 
    `${currentRelativeZoomIn}))))`;

  const targetXTimelineExpr_zpi =
    `if(lt(on,${f_zoom_out_end}),${p1_zpi_transformed_x},` +
    `if(lt(on,${f_pan_end}),${p1_zpi_transformed_x} + (${p2_zpi_transformed_x}-${p1_zpi_transformed_x})*(on-${f_zoom_out_end})/(${durPanFrames}),` + 
    `${p2_zpi_transformed_x}))`;

  const targetYTimelineExpr_zpi =
    `if(lt(on,${f_zoom_out_end}),${p1_zpi_transformed_y},` +
    `if(lt(on,${f_pan_end}),${p1_zpi_transformed_y} + (${p2_zpi_transformed_y}-${p1_zpi_transformed_y})*(on-${f_zoom_out_end})/(${durPanFrames}),` + 
    `${p2_zpi_transformed_y}))`;

  // x,y for zoompan are top-left of the view window on the ZPI canvas.
  // The view window size is (IC_WIDTH / zoomExpr) x (IC_HEIGHT / zoomExpr).
  const zoompanXExpr = `round((${targetXTimelineExpr_zpi}) - ((${IC_WIDTH})/(${zoomExpr}))/2)`;
  const zoompanYExpr = `round((${targetYTimelineExpr_zpi}) - ((${IC_HEIGHT})/(${zoomExpr}))/2)`;
  
  const filterGraph =
    // Stage 1: Scale original to fit IC_WIDTHxIC_HEIGHT, then pad to fill it
    `scale=w=${IC_WIDTH}:h=${IC_HEIGHT}:force_original_aspect_ratio=decrease,` +
    `pad=width=${IC_WIDTH}:height=${IC_HEIGHT}:x='(ow-iw)/2':y='(oh-ih)/2':color=black,` +
    // Stage 2: Pad IC to ZPI_WIDTHxZPI_HEIGHT, creating borders for overscan
    `pad=width=${ZPI_WIDTH}:height=${ZPI_HEIGHT}:x=${PAD_X_BORDER}:y=${PAD_Y_BORDER}:color=black,` +
    // Stage 3: Zoompan on ZPI, outputting to final OUTPUT_WIDTHxOUTPUT_HEIGHT
    `zoompan=z='${zoomExpr}':x='${zoompanXExpr}':y='${zoompanYExpr}':d=${totalFrames}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${FPS},` +
    `format=yuv420p`;

  const logData = {
    orig_iw, orig_ih,
    IC_WIDTH, IC_HEIGHT, ic_scale_factor: ic_scale_factor.toFixed(4),
    ic_pad_x: ic_pad_x.toFixed(2), ic_pad_y: ic_pad_y.toFixed(2),
    p1_ic_transformed_x: p1_ic_transformed.x.toFixed(2), p1_ic_transformed_y: p1_ic_transformed.y.toFixed(2),
    p2_ic_transformed_x: p2_ic_transformed.x.toFixed(2), p2_ic_transformed_y: p2_ic_transformed.y.toFixed(2),
    ZPI_WIDTH, ZPI_HEIGHT, PAD_X_BORDER, PAD_Y_BORDER,
    p1_zpi_transformed_x, p1_zpi_transformed_y,
    p2_zpi_transformed_x, p2_zpi_transformed_y,
    currentRelativeZoomIn, currentZoomOutEffectiveWithOverscan,
  };

  return { filterGraph, logData };
}

export function getDefaultFfmpegCommandArgs(
  inputFileName: string,
  filterGraph: string,
  outputClipName: string,
  totalDurationSec: number = TOTAL_DURATION_SEC
): string[] {
  return [
    '-i', inputFileName,
    '-vf', filterGraph,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28', // Constant Rate Factor (lower is better quality, larger file)
    '-t', totalDurationSec.toString(),
    outputClipName
  ];
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}