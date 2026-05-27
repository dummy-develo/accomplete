type HeroStatProps = {
  label: string;
  value: string | number;
};

export function HeroStat({ label, value }: HeroStatProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground tracking-wide">
        {label}
      </span>
      <span className="font-mono text-2xl tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
