type Point = {
  month: string;
  assets: number;
  debts: number;
};

type Props = {
  data: Point[];
  height?: number;
  /** Index of the month to mark as "current" with a vertical dotted line + dot. */
  currentIndex?: number;
};

const W = 320;

export default function NetWorthChart({
  data,
  height = 160,
  currentIndex,
}: Props) {
  const padTop = 18;
  const padBottom = 26;
  const padLeft = 8;
  const padRight = 44;
  const chartH = height - padTop - padBottom;
  const chartW = W - padLeft - padRight;

  const maxValue = Math.max(
    1,
    ...data.flatMap((p) => [p.assets, Math.abs(p.debts)]),
  );
  const yMax = niceTop(maxValue);
  const slotW = chartW / data.length;
  const barW = Math.min(slotW * 0.45, 80);

  const tickLabels = [`$${formatShort(yMax)}`, "$0K"];
  const tickYs = [padTop, padTop + chartH];

  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" className="w-full">
      {/* Top + bottom gridlines */}
      {tickYs.map((y, i) => (
        <g key={i}>
          <line
            x1={padLeft}
            x2={padLeft + chartW}
            y1={y}
            y2={y}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
          />
          <text
            x={W - 4}
            y={y + 4}
            textAnchor="end"
            fontSize="11"
            fill="rgba(255,255,255,0.55)"
          >
            {tickLabels[i]}
          </text>
        </g>
      ))}

      {data.map((p, i) => {
        const cx = padLeft + slotW * (i + 0.5);
        const aH = (p.assets / yMax) * chartH;
        const dH = (Math.abs(p.debts) / yMax) * chartH;
        return (
          <g key={p.month}>
            {p.assets > 0 && (
              <rect
                x={cx - barW / 2 - 2}
                y={padTop + chartH - aH}
                width={barW / 2}
                height={aH}
                fill="#6366f1"
                rx={2}
              />
            )}
            {p.debts !== 0 && (
              <rect
                x={cx + 2}
                y={padTop + chartH - dH}
                width={barW / 2}
                height={dH}
                fill="#f87171"
                rx={2}
              />
            )}
            <text
              x={cx}
              y={height - 8}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="#6366f1"
            >
              {p.month}
            </text>
          </g>
        );
      })}

      {currentIndex !== undefined &&
        (() => {
          const cx = padLeft + slotW * (currentIndex + 0.5);
          return (
            <g>
              <line
                x1={cx}
                x2={cx}
                y1={padTop}
                y2={padTop + chartH}
                stroke="rgba(255,255,255,0.4)"
                strokeDasharray="2 3"
                strokeWidth={1}
              />
              <circle
                cx={cx}
                cy={padTop + chartH * 0.35}
                r={5}
                fill="rgba(255,255,255,0.9)"
              />
            </g>
          );
        })()}
    </svg>
  );
}

function niceTop(max: number): number {
  if (max <= 1000) return Math.ceil(max / 100) * 100;
  if (max <= 10000) return Math.ceil(max / 1000) * 1000;
  return Math.ceil(max / 10000) * 10000;
}

function formatShort(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}
