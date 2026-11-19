interface Props<T extends string> { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }

export function Seg<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div>{options.map((o) => <button type="button" key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>)}</div>
    </div>
  );
}
