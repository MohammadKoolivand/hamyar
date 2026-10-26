export function Brand({
  size = "md",
  showTagline = false,
}: {
  size?: "md" | "lg";
  showTagline?: boolean;
}) {
  const large = size === "lg";
  return (
    <div className="hy-brand flex min-w-0 items-center gap-3">
      <img
        src="/icon.svg"
        width={large ? 72 : 52}
        height={large ? 72 : 52}
        alt=""
        aria-hidden
        className="shrink-0"
      />
      <div className="min-w-0">
        <span
          className={`hy-brand-wordmark block font-bold leading-tight ${large ? "text-[32px]" : "text-[25px]"}`}
        >
          هدهده
        </span>
        {showTagline && (
          <span className="mt-1 block text-xs text-[#5F7191]">
            راهنمای هوشمند یادگیری
          </span>
        )}
      </div>
    </div>
  );
}
