import type { CSSProperties } from 'react';
import { NodeStyleOverrides } from '@/types/diagram';

const FONT_WEIGHT_MAP: Record<string, number> = { normal: 400, medium: 500, semibold: 600, bold: 700 };

// Splits the Properties panel's shared style fields into the two places
// they apply: borderRadius/strokeWidth/strokeColor go on the node's own
// bordered wrapper element, fontSize/fontColor/fontWeight/fontFamily go on
// its primary text element — Tailwind's own text-* classes on that same
// element would otherwise win over anything merely inherited from an
// ancestor, since an element's own declared style always beats an
// inherited one regardless of specificity.
export function getNodeStyleOverrides(data: NodeStyleOverrides): {
  wrapperStyle: CSSProperties;
  textStyle: CSSProperties;
} {
  const wrapperStyle: CSSProperties = {};
  if (data.borderRadius !== undefined) wrapperStyle.borderRadius = data.borderRadius;
  if (data.strokeWidth !== undefined) wrapperStyle.borderWidth = data.strokeWidth;
  if (data.strokeColor) wrapperStyle.borderColor = data.strokeColor;
  if (data.opacity !== undefined) wrapperStyle.opacity = data.opacity;

  const textStyle: CSSProperties = {};
  if (data.fontSize !== undefined) textStyle.fontSize = data.fontSize;
  if (data.fontColor) textStyle.color = data.fontColor;
  if (data.fontWeight) textStyle.fontWeight = FONT_WEIGHT_MAP[data.fontWeight];
  if (data.fontFamily) textStyle.fontFamily = data.fontFamily;
  if (data.textAlign) {
    textStyle.textAlign = data.textAlign;
    textStyle.width = '100%';
  }

  return { wrapperStyle, textStyle };
}
