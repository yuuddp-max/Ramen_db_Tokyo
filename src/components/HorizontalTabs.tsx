"use client";

export type HorizontalTab = { id: string; label: string; icon?: string };

export function HorizontalTabs({ tabs, value, onChange, label }: { tabs: HorizontalTab[]; value: string; onChange: (value: string) => void; label: string }) {
  return <div className="scrollbar-none -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={label}>
    {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} onClick={() => onChange(tab.id)} className={`min-h-11 shrink-0 snap-start whitespace-nowrap rounded-full border px-4 text-sm font-bold transition duration-200 active:scale-[.98] ${value === tab.id ? "border-accent bg-accent text-white" : "border-border bg-white text-text-secondary hover:border-accent hover:text-accent"}`}>
      {tab.icon ? <span className="mr-1.5" aria-hidden="true">{tab.icon}</span> : null}{tab.label}
    </button>)}
  </div>;
}
