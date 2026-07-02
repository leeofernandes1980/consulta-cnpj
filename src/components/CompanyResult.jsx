import { useState, useCallback } from "react";
import { maskCnpj } from "../utils/cnpj";
import { getCompanyCnpj, getCompanyName, getTradeName } from "../utils/company";

export function SummaryRow({ label, value, accent }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [value]);

  if (!value) return null;
  return (
    <div className="summary-row" onClick={copy} title="Clique para copiar">
      <span className="summary-label">{label}</span>
      <span className={"summary-value" + (accent ? " accent" : "")}>{value}</span>
      <div className="copy-hint">{copied ? "Copiado!" : "Copiar"}</div>
    </div>
  );
}

export function CompanyResult({ result, onOpen }) {
  const { company, reason, partnerMatches = [], documentMatches = [] } = result;
  const est = company.estabelecimento;
  const cnpj = getCompanyCnpj(company);
  const cityUF = [est?.cidade?.nome, est?.estado?.sigla].filter(Boolean).join(" / ");
  const uniquePartners = [...partnerMatches, ...documentMatches].filter(
    (p, i, arr) =>
      arr.findIndex((x) => x?.nome === p?.nome && x?.cpf_cnpj_socio === p?.cpf_cnpj_socio) === i
  );

  return (
    <article className="result-card">
      <div>
        <div className="result-kicker">{reason}</div>
        <h3>{getCompanyName(company)}</h3>
        {getTradeName(company) && <p>{getTradeName(company)}</p>}
        <div className="mini-row">
          {cnpj && <span>{maskCnpj(cnpj)}</span>}
          {cityUF && <span>{cityUF}</span>}
          {company.socios?.length > 0 && <span>{company.socios.length} socio(s)</span>}
        </div>
        {uniquePartners.length > 0 && (
          <div className="match-list">
            {uniquePartners.slice(0, 3).map((p, i) => (
              <span key={`${p.nome}-${i}`}>
                {p.nome}
                {p.cpf_cnpj_socio ? ` (${p.cpf_cnpj_socio})` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
      <button className="btn-secondary" onClick={() => onOpen(company)}>
        Abrir
      </button>
    </article>
  );
}

export function KnownCompanyResult({ company, onConsult }) {
  return (
    <article className="result-card suggested">
      <div>
        <div className="result-kicker">Sugestao por nome</div>
        <h3>{company.name}</h3>
        <p>{company.note}</p>
        <div className="mini-row">
          <span>{maskCnpj(company.cnpj)}</span>
          {company.aliases.slice(0, 3).map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>
      </div>
      <button className="btn-secondary" onClick={() => onConsult(company.cnpj)}>
        Consultar
      </button>
    </article>
  );
}
