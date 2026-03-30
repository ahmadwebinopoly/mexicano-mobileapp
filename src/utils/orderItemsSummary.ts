/**
 * Parse `order.items` from checkout: `Item (addons) xN [Instruction: …]` segments joined by `, `.
 * Comma-splitting alone breaks addon lists like `(Garlic Sauce, Extra)`.
 */

export type ParsedOrderLine = {
  title: string;
  quantity: number;
  instruction?: string;
};

export function parseOrderItemLines(raw: string): ParsedOrderLine[] {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  const out: ParsedOrderLine[] = [];
  let rest = s;
  // Checkout formats notes as `[Notes: ...]`, but older code may use `[Instruction: ...]`.
  const itemRe = /^(.+?)\s+x(\d+)(?:\s*\[(?:Instruction|Notes):\s*([^\]]*)\])?(?:,\s*|$)/i;
  while (rest.trim()) {
    const m = rest.match(itemRe);
    if (!m) break;
    const qty = parseInt(String(m[2]), 10);
    out.push({
      title: String(m[1]).trim(),
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      instruction: m[3] != null && String(m[3]).trim() ? String(m[3]).trim() : undefined,
    });
    rest = rest.slice(m[0].length);
  }
  if (out.length === 0 && s) {
    out.push({ title: s, quantity: 1, instruction: undefined });
  }
  return out;
}
