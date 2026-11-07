import { describeRule, type UploadRuleKind } from "@/lib/upload-rules";

// The "What you can upload" list, drawn from the same table the upload checks use (src/lib/upload-rules.ts),
// so what is written here is exactly what is accepted.
export function UploadRules({ kind, id }: { kind: UploadRuleKind; id: string }) {
  return (
    <div className="rounded-field border border-line/60 bg-raised/40 p-3 text-xs text-muted">
      <p id={id} className="mb-1 font-semibold text-text">
        What you can upload
      </p>
      <ul aria-labelledby={id} className="list-disc space-y-0.5 pl-4">
        {describeRule(kind).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
