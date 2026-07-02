import { useState, useRef } from "react";
import { onlyDigits, isValidCnpj, maskCnpj } from "../utils/cnpj";
import { consultarCnpj } from "../services/consultaService";

export default function BatchSearch({ onResult }) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);

  function parseCnpjs(text) {
    return [...new Set(
      text.split(/[\n,;]+/).map((t) => onlyDigits(t.trim())).filter((d) => d.length > 0)
    )];
  }

  async function runBatch() {
    const cnpjs = parseCnpjs(input);
    if (!cnpjs.length) return;

    abortRef.current = false;
    setRunning(true);
    const initial = cnpjs.map((c) => ({ cnpj: c, status: "loading", name: "", error: "" }));
    setResults(initial);

    for (let i = 0; i < cnpjs.length; i++) {
      if (abortRef.current) break;
      const cnpj = cnpjs[i];

      if (cnpj.length !== 14 || !isValidCnpj(cnpj)) {
        setResults((prev) => prev.map((r) => r.cnpj === cnpj ? { ...r, status: "invalid", error: "CNPJ invalido" } : r));
        continue;
      }

      try {
        const data = await consultarCnpj(cnpj);
        const name = data?.razao_social || data?.nome_fantasia || cnpj;
        setResults((prev) => prev.map((r) => r.cnpj === cnpj ? { ...r, status: "ok", name } : r));
        onResult?.(data);
      } catch (e) {
        setResults((prev) => prev.map((r) => r.cnpj === cnpj ? { ...r, status: "error", error: e.message || "Erro" } : r));
      }
    }

    setRunning(false);
  }

  function stop() {
    abortRef.current = true;
    setRunning(false);
  }

  return (
    <section className="panel batch-panel">
      <div className="section-title">
        <h2>Consulta em lote</h2>
      </div>
      <p className="note">Cole um CNPJ por linha (ou separado por virgula/ponto-e-virgula). Os resultados sao salvos no historico automaticamente.</p>
      <textarea
        className="query-input batch-textarea"
        placeholder={"00.000.000/0001-91\n33.000.167/0001-01\n..."}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={running}
      />
      <div className="search-actions">
        <button className="btn-primary" onClick={runBatch} disabled={running || !input.trim()}>
          {running ? "Consultando..." : `Consultar ${parseCnpjs(input).length || 0} CNPJ(s)`}
        </button>
        {running && (
          <button className="btn-sm danger" onClick={stop}>
            Parar
          </button>
        )}
        {!running && results.length > 0 && (
          <button className="btn-sm" onClick={() => { setResults([]); setInput(""); }}>
            Limpar
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="batch-results">
          {results.map((r) => (
            <div key={r.cnpj} className={`batch-row ${r.status}`}>
              <span className="batch-cnpj">{maskCnpj(r.cnpj)}</span>
              {r.status === "loading" && <span className="batch-spinner" />}
              {r.status === "ok" && <span className="batch-name">{r.name}</span>}
              {(r.status === "error" || r.status === "invalid") && (
                <span className="batch-error">{r.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
