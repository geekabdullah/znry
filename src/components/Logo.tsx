export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="https://images.pexels.com/photos/7923707/pexels-photo-7923707.jpeg?auto=compress&cs=tinysrgb&h=128&w=128"
        alt="Zinariya Farms"
        className="h-9 w-9 rounded-xl object-cover shadow-sm ring-1 ring-field-600/20"
      />
      <div className="leading-tight">
        <div className="font-display text-[15px] font-semibold tracking-tight text-ink-900">
          ZINARIYA
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-field-700">
          Farms Limited
        </div>
      </div>
    </div>
  );
}
