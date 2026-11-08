type Variant = "primary" | "secondary" | "danger" | "danger-solid" | "ghost";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-pen text-pen-ink hover:bg-pen-hover",
  secondary: "border border-line-strong bg-sheet text-ink hover:border-ink",
  danger: "border border-red text-red hover:bg-red-soft",
  "danger-solid": "bg-red text-sheet hover:opacity-90",
  ghost: "text-pencil hover:text-ink underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-base",
};

/** Class names for buttons and button-like links. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}

export const inputClass =
  "block w-full rounded-md border border-line-strong bg-sheet px-3 h-10 text-base text-ink placeholder:text-pencil/80 aria-[invalid=true]:border-red";
