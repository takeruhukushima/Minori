export function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {props.label} {props.required && <span className="req">*</span>}
      </span>
      {props.textarea ? (
        <textarea
          value={props.value}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
        />
      ) : (
        <input
          type={props.type ?? "text"}
          value={props.value}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </label>
  );
}

export function SelectField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {props.label} {props.required && <span className="req">*</span>}
      </span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Checkbox(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="field checkbox">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}

export type Msg = { kind: "ok" | "err"; text: string } | null;

export function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <div className={`msg ${msg.kind}`}>{msg.text}</div>;
}

// Trim strings, drop empty ones, and only include a field if it has content.
export function clean<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (t !== "") out[k] = t;
    } else if (Array.isArray(v)) {
      if (v.length > 0) out[k] = v;
    } else if (typeof v === "object") {
      const c = clean(v);
      if (Object.keys(c).length > 0) out[k] = c;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function now(): string {
  return new Date().toISOString();
}
