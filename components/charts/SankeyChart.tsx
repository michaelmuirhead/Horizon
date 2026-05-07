import type { SankeyData } from "@/lib/sankey";

const W = 720;
const NODE_W = 14;
const NODE_PADDING = 8;
const PAD_X = 12;

type Layout = {
  byId: Map<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      value: number;
      label: string;
      column: 0 | 1 | 2;
      // Cursors used while emitting flow paths so multiple flows from one
      // node stack vertically rather than overlap.
      sourceCursor: number;
      targetCursor: number;
    }
  >;
  height: number;
};

function layout(data: SankeyData, columnXs: number[]): Layout {
  // Group nodes by column and compute per-column total to derive a shared
  // unit (px per dollar).
  const cols: Record<0 | 1 | 2, typeof data.nodes> = { 0: [], 1: [], 2: [] };
  for (const n of data.nodes) cols[n.column].push(n);
  const maxColumnTotal = Math.max(
    1,
    ...([0, 1, 2] as const).map((c) =>
      cols[c].reduce((s, n) => s + n.value, 0),
    ),
  );
  // Allocate ~440px of vertical space minus padding between nodes for the
  // largest column.
  const usableHeight =
    440 -
    Math.max(...([0, 1, 2] as const).map((c) => Math.max(0, cols[c].length - 1) * NODE_PADDING));
  const unit = usableHeight / maxColumnTotal;
  const height =
    usableHeight + NODE_PADDING * Math.max(...([0, 1, 2] as const).map((c) => cols[c].length - 1, 0));

  const byId = new Map<string, Layout["byId"] extends Map<string, infer V> ? V : never>();
  for (const c of [0, 1, 2] as const) {
    let y = 0;
    for (const n of cols[c]) {
      const h = Math.max(2, n.value * unit);
      byId.set(n.id, {
        x: columnXs[c],
        y,
        width: NODE_W,
        height: h,
        value: n.value,
        label: n.label,
        column: n.column,
        sourceCursor: 0,
        targetCursor: 0,
      });
      y += h + NODE_PADDING;
    }
  }
  return { byId, height: Math.max(120, height) };
}

function flowPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  width: number,
): string {
  // Bezier "ribbon": top edge curve + bottom edge curve, closed.
  const midX = (sx + tx) / 2;
  const halfW = width / 2;
  const topStart = sy - halfW;
  const topEnd = ty - halfW;
  const botStart = sy + halfW;
  const botEnd = ty + halfW;
  return [
    `M ${sx} ${topStart}`,
    `C ${midX} ${topStart}, ${midX} ${topEnd}, ${tx} ${topEnd}`,
    `L ${tx} ${botEnd}`,
    `C ${midX} ${botEnd}, ${midX} ${botStart}, ${sx} ${botStart}`,
    "Z",
  ].join(" ");
}

export default function SankeyChart({ data }: { data: SankeyData }) {
  const columnXs: [number, number, number] = [PAD_X, W / 2 - NODE_W / 2, W - PAD_X - NODE_W];
  const { byId, height } = layout(data, columnXs);
  const flowFill = "rgb(var(--accent-rgb) / 0.18)";
  const nodeFill = "rgb(var(--accent-rgb) / 0.85)";

  if (data.nodes.length === 0) {
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label="Money flow chart"
      className="w-full"
    >
      {data.flows.map((f, i) => {
        const src = byId.get(f.source);
        const tgt = byId.get(f.target);
        if (!src || !tgt) return null;
        const sx = src.x + src.width;
        const tx = tgt.x;
        const widthPx = (f.value / src.value) * src.height;
        const sy = src.y + src.sourceCursor + widthPx / 2;
        const ty = tgt.y + tgt.targetCursor + widthPx / 2;
        src.sourceCursor += widthPx;
        tgt.targetCursor += widthPx;
        return (
          <path
            key={i}
            d={flowPath(sx, sy, tx, ty, widthPx)}
            fill={flowFill}
          />
        );
      })}
      {Array.from(byId.values()).map((n, i) => {
        const labelX = n.column === 2 ? n.x - 6 : n.x + n.width + 6;
        const labelAnchor = n.column === 2 ? "end" : "start";
        return (
          <g key={i}>
            <rect
              x={n.x}
              y={n.y}
              width={n.width}
              height={n.height}
              fill={nodeFill}
              rx={2}
            />
            <text
              x={labelX}
              y={n.y + n.height / 2 + 3}
              fontSize="11"
              fontWeight="600"
              fill="rgb(var(--fg-rgb) / 0.85)"
              textAnchor={labelAnchor}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
