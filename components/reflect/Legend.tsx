type Item = { color: string; label: string };

export default function Legend({ items }: { items: Item[] }) {
  return (
    <div className="mt-3 flex items-center justify-center gap-6 text-sm text-fg/70">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
