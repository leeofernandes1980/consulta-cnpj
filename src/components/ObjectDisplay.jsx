import { formatValueByKey, normalizeKey } from "../utils/formatters";

function ValueDisplay({ keyName, value }) {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="empty">Lista vazia</span>;
    if (value.every((v) => typeof v !== "object")) {
      return (
        <div className="badge-row">
          {value.map((v, i) => (
            <span key={i} className="badge">{formatValueByKey(keyName, v) ?? String(v)}</span>
          ))}
        </div>
      );
    }
    return (
      <div className="nested-list">
        {value.map((v, i) => (
          <div key={i} className="nested-card">
            <span className="nested-index">#{i + 1}</span>
            <ObjectDisplay data={v} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="nested-card nested-object">
        <ObjectDisplay data={value} />
      </div>
    );
  }

  const formatted = formatValueByKey(keyName, value);
  return <span className="field-value">{formatted ?? String(value)}</span>;
}

export default function ObjectDisplay({ data }) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data).filter(
    ([k, v]) => !k.startsWith("_") && v !== null && v !== undefined && v !== ""
  );
  if (entries.length === 0) return <span className="empty">Sem dados</span>;
  return (
    <dl className="obj-grid">
      {entries.map(([key, value]) => (
        <div key={key} className={typeof value === "object" || Array.isArray(value) ? "span-full" : ""}>
          <dt className="field-label">{normalizeKey(key)}</dt>
          <dd><ValueDisplay keyName={key} value={value} /></dd>
        </div>
      ))}
    </dl>
  );
}
