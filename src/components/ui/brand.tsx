import Image from "next/image";

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
      <Image
        src="/icon.svg"
        width={large ? 72 : 52}
        height={large ? 72 : 52}
        alt=""
        aria-hidden
        className="shrink-0 drop-shadow-[0_7px_14px_rgba(48,90,164,0.13)]"
      />
      <div className="min-w-0">
        <span className={`hy-brand-wordmark block font-bold leading-tight ${large ? "text-[32px]" : "text-[25px]"}`}>
          همیار
        </span>
        {showTagline && (
          <span className="mt-1 block text-xs text-[#5F7191]">
            همراه روشن یادگیری
          </span>
        )}
      </div>
    </div>
  );
}
