import "./App.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { consultarCnpj as consultarCnpjApi, buscarEmpresasPorDocumentoSocio } from "./services/consultaService";
import { readHistory, writeHistory, upsertCompany } from "./utils/localStorage";
import { getCompanyCnpj, getCompanyName, getTradeName, getAddress, getPhone } from "./utils/company";
import { maskCnpj, onlyDigits, isValidCnpj } from "./utils/cnpj";
import { normalizeText, formatDate, formatMoney, formatCep, countFilledFields } from "./utils/formatters";
import { KNOWN_COMPANIES } from "./data/knownCompanies";
import SituacaoBadge from "./components/SituacaoBadge";
import ObjectDisplay from "./components/ObjectDisplay";
import { SummaryRow, CompanyResult, KnownCompanyResult } from "./components/CompanyResult";
import BatchSearch from "./components/BatchSearch";
import HistorySidebar from "./components/HistorySidebar";

const MOCK_DATA = {
  cnpj: "00000000000191",
  razao_social: "BANCO DO BRASIL SA",
  nome_fantasia: "BANCO DO BRASIL",
  capital_social: "120000000000.00",
  porte: { id: "05", descricao: "DEMAIS" },
  natureza_juridica: { id: "2038", descricao: "Sociedade Anonima Aberta" },
  qualificacao_do_responsavel: { id: 10, descricao: "Diretor" },
  socios: [
    { cpf_cnpj_socio: "***806118**", nome: "LUIZ HENRIQUE DE FREITAS", tipo: "Pessoa Fisica", data_entrada: "2023-01-10", faixa_etaria: "51 a 60 anos", qualificacao_socio: { id: 10, descricao: "Diretor" } },
    { cpf_cnpj_socio: "00.000.000/0001-91", nome: "BB ADMINISTRADORA DE CARTOES LTDA", tipo: "Pessoa Juridica", data_entrada: "2021-06-17", qualificacao_socio: { id: 22, descricao: "Socio" } },
  ],
  estabelecimento: {
    cnpj: "00000000000191",
    atividade_principal: { subclasse: "6422100", descricao: "Bancos multiplos, com carteira comercial" },
    data_inicio_atividade: "1966-08-01",
    nome_fantasia: "BANCO DO BRASIL",
    situacao_cadastral: { id: 2, descricao: "Ativa" },
    cidade: { id: 9701, nome: "BRASILIA", ibge_id: 5300108 },
    estado: { id: 53, sigla: "DF", nome: "Distrito Federal" },
    tipo_logradouro: "SAUN",
    logradouro: "QUADRA 5 LOTE B TORRE I",
    numero: "SN",
    complemento: "ANDAR 1 A 16",
    bairro: "ASA NORTE",
    cep: "70040912",
    ddd1: "61",
    telefone1: "34939002",
    email: "rfc@bb.com.br",
    inscricoes_estaduais: [{ inscricao_estadual: "0731702000197", ativo: true, estado: { id: 53, sigla: "DF", nome: "Distrito Federal" } }],
  },
  simples: { simples: false, mei: false },
};

const SEARCH_MODES = [
  { id: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { id: "company", label: "Empresa", placeholder: "Razao social ou nome fantasia" },
  { id: "partner", label: "Socio", placeholder: "Nome do socio" },
  { id: "document", label: "CPF/CNPJ socio", placeholder: "CPF/CNPJ parcial ou mascarado" },
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function findMatches(companies, mode, query) {
  const textQ = normalizeText(query);
  const digitQ = onlyDigits(query);
  if (!textQ && !digitQ) return [];

  return companies.map((company) => {
    const socios = Array.isArray(company?.socios) ? company.socios : [];
    const haystack = normalizeText(
      [company?.razao_social, company?.nome_fantasia, company?.estabelecimento?.nome_fantasia].filter(Boolean).join(" ")
    );
    const partnerMatches = socios.filter((s) => normalizeText(s?.nome).includes(textQ));
    const documentMatches = socios.filter((s) => {
      const doc = String(s?.cpf_cnpj_socio ?? "");
      return (digitQ && onlyDigits(doc).includes(digitQ)) || (textQ && normalizeText(doc).includes(textQ));
    });

    let matched = false;
    let reason = "";
    if (mode === "company") { matched = haystack.includes(textQ); reason = "Empresa"; }
    if (mode === "partner") { matched = partnerMatches.length > 0; reason = `${partnerMatches.length} socio(s)`; }
    if (mode === "document") { matched = documentMatches.length > 0; reason = `${documentMatches.length} doc(s)`; }
    if (mode === "cnpj") { matched = Boolean(digitQ && getCompanyCnpj(company).includes(digitQ)); reason = "CNPJ salvo"; }

    return { company, reason, partnerMatches, documentMatches, matched };
  }).filter((r) => r.matched);
}

function findKnownCompanies(query) {
  const textQ = normalizeText(query);
  const digitQ = onlyDigits(query);
  if (!textQ && !digitQ) return [];
  if (textQ && textQ.length < 2 && !digitQ) return [];
  return KNOWN_COMPANIES.map((c) => {
    const fields = [c.name, ...c.aliases].map(normalizeText);
    const score = fields.some((f) => f.startsWith(textQ)) ? 2
      : (fields.some((f) => f.includes(textQ)) || (digitQ && c.cnpj.includes(digitQ))) ? 1 : 0;
    return { ...c, _score: score };
  }).filter((c) => c._score > 0).sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));
}

export default function App() {
  const [mode, setMode] = useState("cnpj");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [remoteMatches, setRemoteMatches] = useState([]);
  const [quickCnpj, setQuickCnpj] = useState("");
  const [socioUf, setSocioUf] = useState("");
  const [savedCompanies, setSavedCompanies] = useState(readHistory);

  useEffect(() => { writeHistory(savedCompanies); }, [savedCompanies]);

  const activeMode = SEARCH_MODES.find((m) => m.id === mode) || SEARCH_MODES[0];
  const rawCnpj = onlyDigits(input);
  const localMatches = useMemo(() => findMatches(savedCompanies, mode, input), [savedCompanies, mode, input]);
  const knownMatches = useMemo(() => mode === "company" ? findKnownCompanies(input) : [], [input, mode]);
  const availableCompanyMatches = useMemo(() => {
    const localCnpjs = new Set(localMatches.map((r) => getCompanyCnpj(r.company)));
    return { local: localMatches, suggestions: knownMatches.filter((c) => !localCnpjs.has(c.cnpj)) };
  }, [knownMatches, localMatches]);
  const combinedMatches = useMemo(() => {
    const seen = new Set();
    return [...remoteMatches, ...localMatches].filter((r) => {
      const cnpj = getCompanyCnpj(r.company);
      if (!cnpj || seen.has(cnpj)) return false;
      seen.add(cnpj);
      return true;
    });
  }, [localMatches, remoteMatches]);
  const resultCount = mode === "company"
    ? availableCompanyMatches.local.length + availableCompanyMatches.suggestions.length
    : combinedMatches.length;

  const saveCompany = useCallback((company) => {
    setSavedCompanies((prev) => upsertCompany(prev, company));
  }, []);

  const handleInput = (e) => {
    const v = e.target.value;
    setError(null); setShowRaw(false); setRemoteMatches([]);
    if (data) setData(null);
    setIsDemo(false);
    if (mode === "cnpj") { setInput(maskCnpj(v)); return; }
    if (mode === "document") { setInput(v.replace(/[^\d*./-]/g, "").slice(0, 18)); return; }
    setInput(v);
  };

  const changeMode = (next) => {
    setMode(next); setInput(""); setError(null); setRemoteMatches([]); setQuickCnpj(""); setSocioUf("");
  };

  const resetSearch = () => {
    setInput(""); setError(null); setData(null); setIsDemo(false);
    setShowRaw(false); setCopied(false); setRemoteMatches([]); setQuickCnpj(""); setSocioUf("");
  };

  const loadDemo = () => {
    setError(null); setData(MOCK_DATA); setIsDemo(true); setShowRaw(false);
    setInput(maskCnpj(MOCK_DATA.cnpj)); setMode("cnpj");
    saveCompany(MOCK_DATA);
  };

  const openSavedCompany = (company) => {
    setError(null); setData(company); setIsDemo(false); setShowRaw(false);
    setMode("cnpj"); setInput(maskCnpj(getCompanyCnpj(company)));
    saveCompany(company);
  };

  const consultCnpj = useCallback(async (cnpj) => {
    const clean = onlyDigits(cnpj);
    setError(null); setData(null); setIsDemo(false); setShowRaw(false);
    setMode("cnpj"); setInput(maskCnpj(clean));
    if (clean.length !== 14) {
      setError({ type: "invalid", msg: "CNPJ invalido. Digite os 14 digitos." }); return;
    }
    if (!isValidCnpj(clean)) {
      setError({ type: "invalid", msg: `CNPJ ${maskCnpj(clean)} invalido: digitos verificadores nao conferem.` }); return;
    }
    const cached = savedCompanies.find((c) => getCompanyCnpj(c) === clean);
    if (cached) setData(cached);
    setLoading(true);
    try {
      const json = await consultarCnpjApi(clean);
      setData(json); saveCompany(json);
    } catch (e) {
      const details = e?.details || [];
      const hasNotFound = details.every?.((d) => d.status === 404) || e?.details?.status === 404;
      const hasRateLimit = details.some?.((d) => d.status === 429) || e?.details?.status === 429;
      if (hasNotFound) { setError({ type: "notfound", msg: "CNPJ nao encontrado nas APIs gratuitas consultadas." }); return; }
      if (hasRateLimit) { setError({ type: "ratelimit", msg: "API gratuita atingiu limite temporario. Aguarde e tente novamente." }); return; }
      setError({ type: "network", msg: e?.message?.includes("Failed to fetch")
        ? "Falha de rede ou bloqueio de CORS nas APIs gratuitas."
        : e?.message || "Falha ao consultar o CNPJ." });
    } finally { setLoading(false); }
  }, [saveCompany, savedCompanies]);

  const clearHistory = () => {
    setSavedCompanies([]); setData(null); setShowRaw(false); setError(null); setRemoteMatches([]);
  };

  const searchPartnerDocument = useCallback(async () => {
    setLoading(true); setRemoteMatches([]);
    try {
      const companies = await buscarEmpresasPorDocumentoSocio(onlyDigits(input), socioUf);
      const results = companies.map((c) => ({
        company: c, reason: "Minha Receita", partnerMatches: c.socios || [], documentMatches: c.socios || [], matched: true,
      }));
      setRemoteMatches(results);
      if (!results.length) setError({ type: "notfound", msg: "Nenhuma empresa encontrada. Tente CPF completo (11 dig.), CNPJ completo (14 dig.) ou 6 dig. centrais do CPF." });
    } catch (e) {
      if (e?.details?.isUnavailable) {
        setError({ type: "ratelimit", msg: e.message || "Busca remota indisponivel nesta fonte. Resultados abaixo sao do historico local." });
      } else {
        setError({ type: "network", msg: e?.message || "Falha na busca por documento de socio." });
      }
    } finally { setLoading(false); }
  }, [input, socioUf]);

  const consultar = useCallback(async () => {
    setError(null); setShowRaw(false);
    if (mode !== "cnpj") {
      setData(null);
      if (!input.trim()) { setError({ type: "empty", msg: "Digite um termo para pesquisar." }); return; }
      if (mode === "document") { await searchPartnerDocument(); return; }
      if (mode === "company" && resultCount > 0) return;
      if (mode === "company") {
        const term = encodeURIComponent(input.trim() + " CNPJ");
        setError({ type: "notfound", msg: `"${input.trim()}" nao encontrada no historico nem nas sugestoes. Pesquise o CNPJ na web e cole abaixo.`, webSearch: `https://www.google.com/search?q=${term}` });
      } else if (mode === "partner") {
        setError({ type: "notfound", msg: savedCompanies.length === 0
          ? "Historico vazio. Consulte CNPJs na aba CNPJ primeiro."
          : `Socio "${input.trim()}" nao encontrado nas ${savedCompanies.length} empresa(s) do historico.` });
      }
      return;
    }
    if (!rawCnpj) { setError({ type: "empty", msg: "Digite um CNPJ para consultar." }); return; }
    await consultCnpj(rawCnpj);
  }, [consultCnpj, input, mode, rawCnpj, resultCount, savedCompanies.length, searchPartnerDocument]);

  const copyJSON = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true); setTimeout(() => setCopied(false), 2200);
  };

  const est = data?.estabelecimento;
  const cnpjRaw = data ? getCompanyCnpj(data) : rawCnpj;
  const cityUF = est ? [est.cidade?.nome, est.estado?.sigla].filter(Boolean).join(" / ") : null;
  const cnaePrincipal = est?.atividade_principal
    ? `${est.atividade_principal.subclasse} - ${est.atividade_principal.descricao}` : null;
  const inscricoes = est?.inscricoes_estaduais?.length
    ? est.inscricoes_estaduais.map((ie) => `${ie.inscricao_estadual} (${ie.estado?.sigla || ""})`).join(", ") : null;
  const filledCount = data ? countFilledFields(data) : 0;

  return (
    <div className="wrap">
      <main className="container">
        <header className="topbar">
          <div>
            <span className="kicker">Receita Federal / CNPJ.ws</span>
            <h1>Consulta CNPJ</h1>
            <p className="lead">Consulte por CNPJ na API publica e pesquise localmente por empresa, socio ou documento de socio nos CNPJs ja carregados.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
            <div className="history-pill">{savedCompanies.length} empresa(s) no historico local</div>
            <button className={"btn-sm" + (showBatch ? " on" : "")} onClick={() => setShowBatch((v) => !v)} type="button">
              {showBatch ? "Ocultar lote" : "Busca em lote"}
            </button>
          </div>
        </header>

        {showBatch && <BatchSearch onResult={saveCompany} />}

        <section className="panel search-panel">
          <div className="mode-row" role="tablist">
            {SEARCH_MODES.map((m) => (
              <button key={m.id} className={"mode-btn" + (mode === m.id ? " active" : "")} onClick={() => changeMode(m.id)} type="button">
                {m.label}
              </button>
            ))}
          </div>
          <div className="input-row">
            <input
              className={"query-input" + (mode === "cnpj" || mode === "document" ? " mono" : "")}
              value={input}
              onChange={handleInput}
              onKeyDown={(e) => e.key === "Enter" && consultar()}
              placeholder={activeMode.placeholder}
              inputMode={mode === "company" || mode === "partner" ? "text" : "numeric"}
              aria-label={activeMode.label}
            />
            {mode === "document" && (
              <select
                className="query-input mono"
                style={{ maxWidth: 90, flex: "0 0 auto" }}
                value={socioUf}
                onChange={(e) => setSocioUf(e.target.value)}
                aria-label="UF do socio"
              >
                <option value="">UF (todas)</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            )}
            <button className="btn-primary" onClick={consultar} disabled={loading}>
              {loading ? "Consultando..." : mode === "cnpj" ? "Consultar" : "Pesquisar"}
            </button>
            <button className="btn-ghost" onClick={loadDemo} type="button">Demo</button>
          </div>
          <p className="note">
            {mode === "cnpj" && "Consulta CNPJ.ws com fallback automatico para Minha Receita e BrasilAPI. O resultado e salvo no historico local."}
            {mode === "company" && "Pesquisa no historico local e nas ~20 grandes empresas sugeridas. Para outras empresas, consulte pelo CNPJ primeiro."}
            {mode === "partner" && "Pesquisa por nome de socio no historico local. Nao ha API gratuita de busca global por nome de socio."}
            {mode === "document" && "Busca global via Minha Receita: CPF completo (11 dig., a Receita so expoe os 6 digitos centrais por privacidade), CNPJ completo (14 dig.) ou 6 dig. centrais do CPF do socio. Selecionar a UF reduz o tempo de busca e evita timeout."}
          </p>
          {(input || data || error) && (
            <div className="search-actions">
              <button className="btn-sm" onClick={resetSearch} type="button">Nova busca</button>
            </div>
          )}
        </section>

        {error && (
          <div className={"err-box err-" + error.type}>
            <div>{error.msg}</div>
            {error.webSearch && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn-sm" onClick={() => window.open(error.webSearch, "_blank", "noopener,noreferrer")} type="button">
                  Buscar na web
                </button>
                <span style={{ color: "var(--dim)", fontSize: "0.78rem" }}>Encontrou o CNPJ? Cole aqui:</span>
                <input
                  className="query-input mono"
                  style={{ maxWidth: 200, minHeight: "unset", padding: "6px 10px", fontSize: "0.82rem" }}
                  placeholder="00.000.000/0000-00"
                  value={quickCnpj}
                  onChange={(e) => setQuickCnpj(maskCnpj(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && quickCnpj && consultCnpj(quickCnpj)}
                  inputMode="numeric"
                />
                {quickCnpj && (
                  <button className="btn-primary" style={{ minHeight: 34, padding: "0 14px", fontSize: "0.82rem" }} onClick={() => consultCnpj(quickCnpj)} type="button">
                    Consultar
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="panel loading">
            <div className="spinner" />
            <span>Consultando {maskCnpj(rawCnpj)}...</span>
          </div>
        )}

        <div className="grid">
          <div>
            {mode !== "cnpj" && input.trim() && resultCount > 0 && (
              <section className="panel card">
                <div className="section-title">
                  <h2>CNPJs disponiveis</h2>
                  <span className="stat-pill">{resultCount} encontrado(s)</span>
                </div>
                <div className="result-list">
                  {mode === "company" && availableCompanyMatches.suggestions.map((c) => (
                    <KnownCompanyResult key={c.cnpj} company={c} onConsult={consultCnpj} />
                  ))}
                  {(mode === "company" ? availableCompanyMatches.local : combinedMatches).map((r) => (
                    <CompanyResult key={getCompanyCnpj(r.company)} result={r} onOpen={openSavedCompany} />
                  ))}
                </div>
              </section>
            )}

            {data && !loading && (
              <section className="panel card">
                {isDemo && <div className="err-box err-network">Modo demo carregado e salvo no historico local.</div>}
                <div className="res-header">
                  <div>
                    <h2 className="company-title">{getCompanyName(data)}</h2>
                    {getTradeName(data) && <div className="company-sub">{getTradeName(data)}</div>}
                  </div>
                  <div className="stats-row">
                    <SituacaoBadge situacao={est?.situacao_cadastral} />
                    {cnpjRaw && <span className="stat-pill">{maskCnpj(cnpjRaw)}</span>}
                    <span className="stat-pill">{filledCount} campos</span>
                    {data?.fonte && <span className="fonte-badge">{data.fonte}</span>}
                  </div>
                </div>
                <div className="actions">
                  <button className="btn-sm" onClick={resetSearch}>Nova busca</button>
                  <button className={"btn-sm" + (showRaw ? " on" : "")} onClick={() => setShowRaw((v) => !v)}>
                    {showRaw ? "Ocultar JSON" : "Ver JSON bruto"}
                  </button>
                  <button className="btn-sm" onClick={copyJSON}>{copied ? "Copiado" : "Copiar JSON"}</button>
                </div>
                {showRaw && <pre className="raw-pre">{JSON.stringify(data, null, 2)}</pre>}
                <div className="section-title"><h2>Resumo principal</h2></div>
                <div className="sum-grid">
                  <SummaryRow label="Razao Social" value={data?.razao_social} />
                  <SummaryRow label="Nome Fantasia" value={getTradeName(data)} />
                  <SummaryRow label="CNPJ" value={cnpjRaw ? maskCnpj(cnpjRaw) : null} accent />
                  <SummaryRow label="Capital Social" value={data?.capital_social ? formatMoney(data.capital_social) : null} accent />
                  <SummaryRow label="Endereco" value={getAddress(est)} />
                  <SummaryRow label="Cidade / UF" value={cityUF} />
                  <SummaryRow label="CEP" value={est?.cep ? formatCep(est.cep) : null} />
                  <SummaryRow label="CNAE Principal" value={cnaePrincipal} />
                  <SummaryRow label="Telefone" value={getPhone(est)} />
                  <SummaryRow label="E-mail" value={est?.email} />
                  <SummaryRow label="Inscricoes Estaduais" value={inscricoes} />
                  <SummaryRow label="Porte" value={data?.porte?.descricao} />
                  <SummaryRow label="Natureza Juridica" value={data?.natureza_juridica?.descricao} />
                  <SummaryRow label="Inicio Atividade" value={est?.data_inicio_atividade ? formatDate(est.data_inicio_atividade) : null} />
                  <SummaryRow label="Simples Nacional" value={data?.simples?.simples !== undefined ? (data.simples.simples ? "Sim" : "Nao") : null} />
                  <SummaryRow label="MEI" value={data?.simples?.mei !== undefined ? (data.simples.mei ? "Sim" : "Nao") : null} />
                </div>
                <div className="section-title" style={{ marginTop: 22 }}><h2>Todos os dados retornados</h2></div>
                <ObjectDisplay data={data} />
              </section>
            )}
          </div>

          <HistorySidebar companies={savedCompanies} onOpen={openSavedCompany} onClear={clearHistory} />
        </div>

        <div className="footer">cnpj.ws / minhareceita.org / brasilapi.com.br · dados publicos · historico salvo apenas neste navegador</div>
      </main>
    </div>
  );
}
