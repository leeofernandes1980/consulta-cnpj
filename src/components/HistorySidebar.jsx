import { useMemo, useState } from "react";
import { maskCnpj } from "../utils/cnpj";
import { getCompanyCnpj, getCompanyName, getUf, getSituacaoDesc } from "../utils/company";
import { isStaleEntry, exportJson, exportCsv } from "../utils/localStorage";
import { normalizeText } from "../utils/formatters";

export default function HistorySidebar({ companies, onOpen, onClear }) {
  const [filterUf, setFilterUf] = useState("");
  const [filterAtiva, setFilterAtiva] = useState("");

  const ufs = useMemo(() => {
    const set = new Set(companies.map(getUf).filter(Boolean));
    return [...set].sort();
  }, [companies]);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (filterUf && getUf(c) !== filterUf) return false;
      if (filterAtiva) {
        const sit = normalizeText(getSituacaoDesc(c));
        if (filterAtiva === "ativa" && !sit.includes("ativa")) return false;
        if (filterAtiva === "inativa" && sit.includes("ativa")) return false;
      }
      return true;
    });
  }, [companies, filterUf, filterAtiva]);

  return (
    <aside className="panel card">
      <div className="section-title">
        <h2>Historico local</h2>
        {companies.length > 0 && (
          <button className="btn-sm danger" onClick={onClear} type="button">
            Limpar
          </button>
        )}
      </div>

      {companies.length === 0 ? (
        <p className="empty-state">
          Consulte um CNPJ ou carregue a demo. Depois disso, a busca por socio, CPF/CNPJ de socio e nome de empresa passa a funcionar localmente.
        </p>
      ) : (
        <>
          <div className="filter-row">
            <select
              className="filter-select"
              value={filterUf}
              onChange={(e) => setFilterUf(e.target.value)}
            >
              <option value="">Todos os estados</option>
              {ufs.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={filterAtiva}
              onChange={(e) => setFilterAtiva(e.target.value)}
            >
              <option value="">Qualquer situacao</option>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </select>
          </div>

          <div className="side-list">
            {filtered.slice(0, 15).map((company) => {
              const cnpj = getCompanyCnpj(company);
              const stale = isStaleEntry(company);
              return (
                <button
                  key={cnpj}
                  className={"side-item" + (stale ? " stale" : "")}
                  onClick={() => onOpen(company)}
                  type="button"
                >
                  <strong>{getCompanyName(company)}</strong>
                  <span>
                    {stale && <span className="stale-dot" title="Dados com mais de 7 dias" />}
                    {maskCnpj(cnpj)}
                    {company.socios?.length ? ` · ${company.socios.length} socio(s)` : ""}
                  </span>
                </button>
              );
            })}
            {filtered.length > 15 && (
              <p className="note">+{filtered.length - 15} empresa(s) nao exibida(s)</p>
            )}
          </div>

          <div className="export-row">
            <button className="btn-sm" onClick={() => exportJson(companies)} type="button">
              Exportar JSON
            </button>
            <button className="btn-sm" onClick={() => exportCsv(companies)} type="button">
              Exportar CSV
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
