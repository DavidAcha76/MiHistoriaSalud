import test from 'node:test';
import assert from 'node:assert/strict';
import { colors } from '../src/theme/colors.ts';

function luminance(hex) {
  const values = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
function contrast(first, second) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test('el texto normal y secundario mantiene al menos 4.5:1 sobre las superficies', () => {
  for (const foreground of ['text', 'muted']) for (const background of ['background', 'surface', 'surfaceRaised', 'primarySoft', 'accentSoft', 'aiSoft', 'warningSoft', 'dangerSoft']) {
    const ratio = contrast(colors[foreground], colors[background]);
    assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(2)}:1`);
  }
});
test('los colores de botones, estados y bordes conservan el contraste mínimo', () => {
  for (const foreground of ['primary', 'accent', 'success', 'danger', 'warning', 'ai']) {
    assert.ok(contrast(colors[foreground], colors.surface) >= 4.5, foreground);
  }
  assert.ok(contrast(colors.background, colors.primary) >= 4.5);
  assert.ok(contrast(colors.background, colors.danger) >= 4.5);
  assert.ok(contrast(colors.inputBorder, colors.surfaceRaised) >= 3);
});
