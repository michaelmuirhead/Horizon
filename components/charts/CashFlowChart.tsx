type Point = { date: string; balance: number };

type Props = {
  data: Point[];
  height?: number;
};

const W = 320;

// A single-line sparkline of projected cash. The zero baseline is drawn so
// negative dips read as "below the line" without needing a separate label.
export default function CashFlowChart({ data, height = 140 }: Props) {
  const padTop = 16;
  const padBottom = 22;
  const padLeft = 8;
  const padRight = 8;
  const chartH = height - padTop - padBottom;
  const chartW = W - padLeft - padRight;

  if (data.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${height}`} role="img" className="w-full" />
    );
  }

  const values = data.map((d) => d.balance);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const range = Math.max(1, rawMax - rawMin);

  function x(i: number): number {
    return padLeft + (chartW * i) / (data.length - 1);
  }
  function y(v: number): number {
    return padTop + chartH - ((v - rawMin) / range) * chartH;
  }

  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.balance)}`).join(" ");
  const fillPath = `${path} L${x(data.length - 1)},${y(rawMin)} L${x(0)},${y(rawMin)} Z`;
  const zeroY = y(0);
  const lowIdx = values.indexOf(Math.min(...values));

  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" className="w-full">
      {/* Zero baseline — only meaningful if we cross it. */}
      {rawMin < 0 && (
        <line
          x1={padLeft}
          x2={padLeft + chartW}
          y1={zeroY}
          y2={zeroY}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      <path d={fillPath} fill="rgba(99,102,241,0.18)" />
      <path d={path} fill="none" stroke="#6366f1" strokeWidth={2} />
      {/* Mark the low point so the dip is visible at a glance. */}
      <circle
        cx={x(lowIdx)}
        cy={y(values[lowIdx])}
        r={4}
        fill={values[lowIdx] < 0 ? "#f87171" : "#6366f1"}
      />
      <text
        x={padLeft}
        y={height - 6}
        fontSize="11"
        fill="rgba(255,255,255,0.55)"
      >
        Today
      </text>
      <text
        x={padLeft + chartW}
        y={height - 6}
        textAnchor="end"
        fontSize="11"
        fill="rgba(255,255,255,0.55)"
      >
        +{data.length - 1}d
      </text>
    </svg>
  );
}
