import Link from "next/link";

/** PF Desk monogram (ledger page + tick), same drawing as the shell's Brand, for the bare pages.
 *  href null = plain mark, no link (the worker's help page should not lead to the consultant site). */
export function Mark({ href = "/", small }: { href?: string | null; small?: boolean }) {
  const body = (
    <>
      <svg viewBox="0 0 28 28" className={small ? "size-6" : "size-7"} aria-hidden>
        <rect x="3" y="2" width="20" height="24" rx="2.5" fill="#23408e" />
        <path d="M7 8h12M7 12h12M7 16h6" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="21" cy="20" r="5.5" fill="#f5f3ec" stroke="#1d6b40" strokeWidth="1.6" />
        <path d="m18.6 20 1.7 1.7 3-3.2" fill="none" stroke="#1d6b40" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="whitespace-nowrap text-[1.08rem] font-semibold tracking-tight text-ink">PF Desk</span>
    </>
  );
  return href ? <Link href={href} className="flex items-center gap-2.5">{body}</Link> : <span className="flex items-center gap-2.5">{body}</span>;
}
