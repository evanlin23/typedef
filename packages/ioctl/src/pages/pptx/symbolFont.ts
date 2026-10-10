// Old decks and equation editors write Greek letters and math symbols with the
// Symbol font, which draws e.g. "Q" as Θ. These are the Unicode equivalents of
// its characters 0x20-0x7E and 0xA0-0xFE.
const SYMBOL_LOW = ' !∀#∃%&∋()∗+,−./0123456789:;<=>?≅ΑΒΧΔΕΦΓΗΙϑΚΛΜΝΟΠΘΡΣΤΥςΩΞΨΖ[∴]⊥_‾αβχδεφγηιϕκλμνοπθρστυϖωξψζ{|}∼';
const SYMBOL_HIGH = '€ϒ′≤⁄∞ƒ♣♦♥♠↔←↑→↓°±″≥×∝∂•÷≠≡≈…|─↵ℵℑℜ℘⊗⊕∅∩∪⊃⊇⊄⊂⊆∈∉∠∇®©™∏√⋅¬∧∨⇔⇐⇑⇒⇓◊⟨®©™∑⎛⎜⎝⎡⎢⎣⎧⎨⎩⎪ ⟩∫⌠⎮⌡⎞⎟⎠⎤⎥⎦⎫⎬⎭';

// The characters MathType commonly uses from its MT Extra font
const MT_EXTRA: Record<string, string> = { K: '…', L: '⋯', M: '⋮', N: '⋰', O: '⋱', l: 'ℓ' };

// The Symbol font character code that symbolFontToUnicode maps to `char`
export function symbolCode(char: string) {
  const low = SYMBOL_LOW.indexOf(char);
  if (low !== -1) return low + 0x20;
  const high = SYMBOL_HIGH.indexOf(char);
  return high === -1 ? null : high + 0xa0;
}

export const isSymbolFont = (font: string) => /^["']?(symbol|mt extra)["']?$/i.test(font.trim());

export function symbolFontToUnicode(text: string, font: string) {
  const mtExtra = /mt extra/i.test(font);
  return Array.from(text, (char) => {
    let code = char.charCodeAt(0);
    // Symbol fonts are often stored in the private-use area (U+F020-U+F0FF)
    if (code >= 0xf020 && code <= 0xf0ff) code -= 0xf000;
    if (mtExtra) return MT_EXTRA[String.fromCharCode(code)] ?? char;
    if (code >= 0x20 && code <= 0x7e) return SYMBOL_LOW[code - 0x20];
    if (code >= 0xa0 && code <= 0xfe) return SYMBOL_HIGH[code - 0xa0];
    return char;
  }).join('');
}
