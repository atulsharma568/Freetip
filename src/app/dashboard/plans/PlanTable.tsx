import Link from "next/link";
import { Check, Minus } from "@phosphor-icons/react/ssr";
import type { CatalogueItem, ComparisonGroupView } from "@/lib/plan-catalogue";

// Every paid feature by name, side by side: one block per group, two tick columns (Starter,
// Creator). A group is either in both plans or only in Creator, and a Creator-only group has a
// solid lime bar so it is easy to find. Server component: no state, no script. The two tick columns
// have the same fixed width in the bar and in the rows so they line up.

const COL = "w-[3.75rem] shrink-0 text-center sm:w-[4.75rem]";

function Tick({ yes, label }: { yes: boolean; label: string }) {
  return (
    <span className="inline-flex items-center justify-center">
      {yes ? (
        <Check size={18} weight="bold" aria-hidden="true" className="text-accent" />
      ) : (
        <Minus size={16} aria-hidden="true" className="text-muted/60" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

function OnForYou({ item }: { item: CatalogueItem }) {
  if (!item.on) return null;
  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-ink">
        <Check size={11} weight="bold" aria-hidden="true" />
        On for you
      </span>
      {item.href && (
        <Link href={item.href} className="text-xs text-text underline decoration-line hover:decoration-accent">
          Open
        </Link>
      )}
    </span>
  );
}

export function PlanTable({
  groups,
  handPicked,
}: {
  groups: ComparisonGroupView[];
  handPicked: CatalogueItem[];
}) {
  return (
    <section id="compare" aria-labelledby="compare-title" className="scroll-mt-6 space-y-5">
      <div className="space-y-1">
        <h2 id="compare-title" className="text-2xl font-semibold text-text">
          Every feature, side by side
        </h2>
        <p className="text-sm text-muted">
          Creator has everything in Starter, plus the groups marked <span className="font-medium text-text">Only in Creator</span>.
          Tips, the OBS alert, sounds, goals and the recap are free on every plan.
        </p>
      </div>

      {groups.map((g, i) => (
        <section
          key={g.title}
          aria-labelledby={`compare-group-${i}`}
          className="overflow-hidden rounded-[var(--radius-surface)] border border-line/60 bg-surface"
        >
          <div
            className={`flex items-center gap-3 py-3 pl-4 ${g.creatorOnly ? "on-accent bg-accent text-ink" : "bg-raised text-text"}`}
          >
            <div className="min-w-0 flex-1">
              <h3 id={`compare-group-${i}`} className="text-xl font-semibold leading-tight">
                {g.title}
              </h3>
              <p className={`mt-0.5 text-xs ${g.creatorOnly ? "text-ink/75" : "text-muted"}`}>
                {g.creatorOnly ? "Only in Creator. " : ""}
                {g.blurb}
              </p>
            </div>
            <span aria-hidden="true" className={`${COL} text-xs font-semibold`}>
              Starter
            </span>
            <span aria-hidden="true" className={`${COL} text-xs font-semibold`}>
              Creator
            </span>
          </div>
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col />
              <col className="w-[3.75rem] sm:w-[4.75rem]" />
              <col className="w-[3.75rem] sm:w-[4.75rem]" />
            </colgroup>
            <thead className="sr-only">
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Starter</th>
                <th scope="col">Creator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {g.items.map((item) => (
                <tr key={item.key}>
                  <th scope="row" className="py-3.5 pl-4 pr-3 text-left align-top font-normal">
                    <span className="block text-base font-medium text-text">
                      {item.title}
                      {item.beta && (
                        <span className="ml-2 rounded-full border border-control px-2 py-0.5 align-middle text-xs font-normal text-muted">
                          Beta
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm font-normal text-muted">{item.benefit}</span>
                    <OnForYou item={item} />
                  </th>
                  <td className={`${COL} py-3.5 align-top`}>
                    <Tick yes={item.inStarter} label={item.inStarter ? "In Starter" : "Not in Starter"} />
                  </td>
                  <td className={`${COL} py-3.5 align-top`}>
                    <Tick yes label="In Creator" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {handPicked.length > 0 && (
        <section aria-labelledby="hand-picked-title" className="space-y-3 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-4">
          <h3 id="hand-picked-title" className="text-xl font-semibold text-text">
            Switched on for you by hand
          </h3>
          <ul className="divide-y divide-line/60">
            {handPicked.map((item) => (
              <li key={item.key} className="py-3 first:pt-0 last:pb-0">
                <p className="text-base font-medium text-text">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted">{item.benefit}</p>
                <OnForYou item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
