import { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </span>
        {hint ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
        ) : null}
      </div>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-black/20 focus:ring-4 focus:ring-black/5 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white/20 dark:focus:ring-white/10 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-black/20 focus:ring-4 focus:ring-black/5 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white/20 dark:focus:ring-white/10 ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-black/20 focus:ring-4 focus:ring-black/5 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white/20 dark:focus:ring-white/10 ${props.className ?? ""}`}
    />
  );
}

