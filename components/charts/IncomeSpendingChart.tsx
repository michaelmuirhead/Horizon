type Point = {
  month: string;
  income: number;
  spending: number;
};

type Props = {
  data: Point[];
  height?: number;
  /** Optional pill label anchored above a specific month (e.g. "Started Plan"). */
  marker?: { month: string; label: string };
  /** When true, draws a single bar per month showing the larger of income/spending.
   * When false, shows side-by-side income vs spending bars. */
  singleSeries?: boolean;
};

const W = 320;

export default function IncomeSpendingChart({
  data,
  height = 200,
  marker,
}: Props) {
  const padTop = 28;
  const padBottom = 36;
  const padLeft = 8;
  const padRight = 44;
  const chartH = height - padTop - padBottom;
  const chartW = W - padLeft - padRight;

  const maxValue = Math.max(
    1,
    ...data.flatMap((p) => [p.income, p.spending]),
  );
  const ticks = niceTicks(maxValue, 3);
  const yMax = ticks[ticks.length - 1];

  const slotW = chartW / data.length;
  const barW = Math.min(slotW * 0.45, 110);

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines + Y labels */}
      {ticks.map((t, i) => {
        const y = padTop + chartH - (t / yMax) * chartH;
        return (
          <g key={i}>
            <line
              x1={padLeft}
              x2={padLeft + chartW}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray={i === 0 ? "" : "3 4"}
              strokeWidth={1}
            />
            <text
              x={W - 4}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="rgba(255,255,255,0.55)"
            >
              ${t}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((p, i) => {
        const cx = padLeft + slotW * (i + 0.5);
        const incomeH = (p.income / yMax) * chartH;
        const spendingH = (p.spending / yMax) * chartH;
        return (
          <g key={p.month}>
            {p.income > 0 && (
              <rect
                x={cx - barW / 2 - 6}
                y={padTop + chartH - incomeH}
                width={barW / 2}
                height={incomeH}
                fill="#22c55e"
                rx={2}
              />
            )}
            {p.spending > 0 && (
              <rect
                x={cx + (p.income > 0 ? 6 : -barW / 2)}
                y={padTop + chartH - spendingH}
                width={p.income > 0 ? barW / 2 : barW}
                height={spendingH}
                fill="#6366f1"
                rx={2}
              />
            )}
            <text
              x={cx}
              y={height - 14}
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

      {/* Marker pill (e.g. "Started Plan") */}
      {marker &&
        (() => {
          const i = data.findIndex((d) => d.month === marker.month);
          if (i < 0) return null;
          const cx = padLeft + slotW * (i + 0.5);
          const labelW = marker.label.length * 7.5 + 18;
          return (
            <g>
              <line
                x1={cx}
                x2={cx}
                y1={padTop - 2}
                y2={padTop + chartH}
                stroke="rgba(255,255,255,0.25)"
                strokeDasharray="2 3"
                strokeWidth={1}
              />
              <rect
                x={cx - labelW / 2}
                y={4}
                width={labelW}
                height={20}
                rx={10}
                fill="#6366f1"
              />
              <text
                x={cx}
                y={18}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="white"
              >
                {marker.label}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}

function niceTicks(max: number, count: number): number[] {
  const step = niceStep(max / count);
  const ticks: number[] = [];
  for (let v = 0; v <= max + 0.0001; v += step) ticks.push(Math.round(v));
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round(ticks[ticks.length - 1] + step));
  return ticks;
}

function niceStep(raw: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const f = raw / exp;
  let nice;
  if (f < 1.5) nice = 1;
  else if (f < 3) nice = 2;
  else if (f < 7) nice = 5;
  else nice = 10;
  return nice * exp;
}
