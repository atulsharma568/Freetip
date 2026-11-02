import Link from "next/link";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { listHref } from "@/lib/admin/list-view";

// The search box above an owner table. A plain GET form, so a search is a link that can be
// shared; `keep` carries filters that must survive it (the date range).
export function ListSearch({
  action,
  q,
  keep = {},
  label,
  placeholder,
}: {
  action: string;
  q: string;
  keep?: Record<string, string>;
  label: string;
  placeholder: string;
}) {
  return (
    <form action={action} className="flex flex-wrap gap-2">
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={label}
        className={`${FIELD_CLASS} w-full max-w-md`}
      />
      <button type="submit" className={buttonClass("quiet", "md")}>
        Search
      </button>
      {q && (
        <Link href={listHref(action, keep, "")} className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-text">
          Clear
        </Link>
      )}
    </form>
  );
}
