type Props = {
  label?: string;
  disabled?: boolean;
};

export default function SaveButton({ label = "Save", disabled }: Props) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-full bg-accent px-5 py-3.5 text-base font-bold text-fg shadow-lg transition-opacity disabled:opacity-50"
    >
      {label}
    </button>
  );
}
