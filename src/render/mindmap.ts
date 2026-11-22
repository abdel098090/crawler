// The mind map ending: the spider weaves the key ideas into a web.
// layoutMindMap only computes positions (easy to test); drawMindMap paints them.

import type { AnalysisResult } from '../core/types';

export interface MindNode {
  id: string;
  label: string;
  x: number;
  y: number;
  level: 0 | 1 | 2;
  parent?: string;
  page?: number;
}

export function layoutMindMap(result: AnalysisResult, width: number, height: number): MindNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const r1 = Math.min(width, height) * 0.27;
  const r2 = Math.min(width, height) * 0.44;
  const center: MindNode = { id: 'c', label: result.keywords[0]?.display ?? '…', x: cx, y: cy, level: 0 };
  const nodes: MindNode[] = [center];
  const used = new Set([center.label.toLowerCase()]);
  // Branches: one per chunk when there are several, otherwise the top keywords.
  const branches = result.chunks.length > 1
    ? result.chunks.slice(0, 8).map((c) => ({ label: c.keywords.find((k) => !used.has(k.display.toLowerCase()))?.display ?? c.chunk.title, leaves: c.keywords, page: c.chunk.fromPage }))
    : result.keywords.slice(1, 7).map((k) => ({ label: k.display, leaves: [] as typeof result.keywords, page: k.pages[0] }));
  branches.forEach((b, i) => {
    const a = (i / branches.length) * Math.PI * 2 - Math.PI / 2;
    const id = `b${i}`;
    used.add(b.label.toLowerCase());
    nodes.push({ id, label: b.label, x: cx + Math.cos(a) * r1, y: cy + Math.sin(a) * r1, level: 1, parent: 'c', page: b.page });
    const leaves = b.leaves.filter((k) => !used.has(k.display.toLowerCase())).slice(0, 3);
    const spread = (Math.PI * 2) / branches.length / 2.2;
    leaves.forEach((k, j) => {
      used.add(k.display.toLowerCase());
      const la = a + (leaves.length === 1 ? 0 : (j / (leaves.length - 1) - 0.5) * spread * 2);
      nodes.push({ id: `${id}l${j}`, label: k.display, x: cx + Math.cos(la) * r2, y: cy + Math.sin(la) * r2, level: 2, parent: id, page: k.pages[0] });
    });
  });
  return nodes;
}

export function drawMindMap(ctx: CanvasRenderingContext2D, nodes: MindNode[], colors: { bg: string; text: string; silk: string; accent: string; amber: string }, progress = 1): void {
  // Work in drawing units, even when the canvas is scaled up for sharp text.
  const scale = ctx.getTransform().a || 1;
  const width = ctx.canvas.width / scale;
  const height = ctx.canvas.height / scale;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const center = nodes[0];
  // Silk rings: the web behind the map.
  ctx.strokeStyle = colors.silk;
  ctx.lineWidth = 1;
  for (let r = 1; r <= 5; r++) {
    ctx.beginPath();
    const rr = (Math.min(width, height) * 0.48 * r) / 5;
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = center.x + Math.cos(a) * rr;
      const y = center.y + Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.globalAlpha = 0.35 * progress;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Threads from parent to child.
  ctx.lineWidth = 2;
  for (const n of nodes) {
    if (!n.parent) continue;
    const p = byId.get(n.parent)!;
    const t = Math.min(1, progress * (n.level === 1 ? 1.6 : 1.1));
    ctx.strokeStyle = n.level === 1 ? colors.accent : colors.silk;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + (n.x - p.x) * t, p.y + (n.y - p.y) * t);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const n of nodes) {
    if (progress < (n.level === 0 ? 0 : n.level === 1 ? 0.5 : 0.85)) continue;
    const size = n.level === 0 ? 22 : n.level === 1 ? 17 : 14;
    ctx.font = `${n.level < 2 ? '600 ' : ''}${size}px "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif`;
    const w = ctx.measureText(n.label).width + 20;
    const h = size + 14;
    ctx.fillStyle = n.level === 0 ? colors.accent : n.level === 1 ? colors.amber : colors.bg;
    ctx.strokeStyle = colors.accent;
    ctx.beginPath();
    ctx.roundRect(n.x - w / 2, n.y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = n.level === 0 ? '#fff' : colors.text;
    ctx.fillText(n.label, n.x, n.y + 1);
  }
}

export function nodeAt(nodes: MindNode[], x: number, y: number): MindNode | null {
  let best: MindNode | null = null;
  let bestD = 40;
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestD) [best, bestD] = [n, d];
  }
  return best;
}
