import { useCallback, useEffect, useMemo, useState } from "react";
import { consultarCnpj as consultarCnpjService, buscarEmpresasPorDocumentoSocio } from "./services/consultaService";

const STORAGE_KEY = "consulta-cnpj:empresas";

const MOCK_DATA = {
  cnpj: "00000000000191",
  razao_social: "BANCO DO BRASIL SA",
  nome_fantasia: "BANCO DO BRASIL",
  capital_social: "120000000000.00",
  porte: { id: "05", descricao: "DEMAIS" },
  natureza_juridica: { id: "2038", descricao: "Sociedade Anonima Aberta" },
  qualificacao_do_responsavel: { id: 10, descricao: "Diretor" },
  socios: [
    {
      cpf_cnpj_socio: "***806118**",
      nome: "LUIZ HENRIQUE DE FREITAS",
      tipo: "Pessoa Fisica",
      data_entrada: "2023-01-10",
      faixa_etaria: "51 a 60 anos",
      qualificacao_socio: { id: 10, descricao: "Diretor" },
    },
    {
      cpf_cnpj_socio: "00.000.000/0001-91",
      nome: "BB ADMINISTRADORA DE CARTOES LTDA",
      tipo: "Pessoa Juridica",
      data_entrada: "2021-06-17",
      qualificacao_socio: { id: 22, descricao: "Socio" },
    },
  ],
  estabelecimento: {
    cnpj: "00000000000191",
    atividade_principal: {
      subclasse: "6422100",
      descricao: "Bancos multiplos, com carteira comercial",
    },
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
    inscricoes_estaduais: [
      {
        inscricao_estadual: "0731702000197",
        ativo: true,
        estado: { id: 53, sigla: "DF", nome: "Distrito Federal" },
      },
    ],
  },
  simples: { simples: false, mei: false },
};

const SEARCH_MODES = [
  { id: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { id: "company", label: "Empresa", placeholder: "Razao social ou nome fantasia" },
  { id: "partner", label: "Socio", placeholder: "Nome do socio" },
  { id: "document", label: "CPF/CNPJ socio", placeholder: "CPF/CNPJ parcial ou mascarado" },
];

const KNOWN_COMPANIES = [
  {
    cnpj: "08343492000120",
    name: "MRV ENGENHARIA E PARTICIPACOES SA",
    aliases: ["MRV", "MRV ENGENHARIA", "MRV ENGENHARIA E PARTICIPACOES S.A", "MRVE3"],
    note: "Matriz em Belo Horizonte / MG",
  },
  {
    cnpj: "00000000000191",
    name: "BANCO DO BRASIL SA",
    aliases: ["BANCO DO BRASIL", "BB"],
    note: "Matriz em Brasilia / DF",
  },
  {
    cnpj: "33000167000101",
    name: "PETROLEO BRASILEIRO SA PETROBRAS",
    aliases: ["PETROBRAS", "PETROLEO BRASILEIRO"],
    note: "Matriz no Rio de Janeiro / RJ",
  },
  {
    cnpj: "33592510000154",
    name: "VALE SA",
    aliases: ["VALE", "VALE S.A"],
    note: "Matriz no Rio de Janeiro / RJ",
  },
  {
    cnpj: "47960950000121",
    name: "MAGAZINE LUIZA SA",
    aliases: ["MAGAZINE LUIZA", "MAGALU", "MGLU3"],
    note: "Matriz em Franca / SP",
  },
  {
    cnpj: "60872504000123",
    name: "ITAU UNIBANCO HOLDING SA",
    aliases: ["ITAU", "ITAU UNIBANCO", "ITUB4"],
    note: "Matriz em Sao Paulo / SP",
  },
  {
    cnpj: "60746948000112",
    name: "BANCO BRADESCO SA",
    aliases: ["BRADESCO", "BBDC4"],
    note: "Matriz em Osasco / SP",
  },
];

const fmt = {
  cnpj: (v) => {
    const d = onlyDigits(v).slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  },
  cpf: (v) => {
    const d = onlyDigits(v).slice(0, 11);
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  },
  cep: (v) => onlyDigits(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2"),
  date: (v) => {
    if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return v;
    const [y, m, d] = v.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  },
  currency: (v) => {
    const n = Number.parseFloat(v);
    if (Number.isNaN(n)) return v;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  },
  bool: (v) => (v === true || v === "true" ? "Sim" : "Nao"),
};

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj)) return false;

  const calcDigit = (length) => {
    let sum = 0;
    let weight = length - 7;

    for (let index = 0; index < length; index += 1) {
      sum += Number(cnpj[index]) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }

    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return calcDigit(12) === Number(cnpj[12]) && calcDigit(13) === Number(cnpj[13]);
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function humanize(key) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCompanyCnpj(company) {
  return onlyDigits(company?.estabelecimento?.cnpj || company?.cnpj || company?.cnpj_raiz);
}

function getCompanyName(company) {
  return company?.razao_social || company?.nome_fantasia || company?.estabelecimento?.nome_fantasia || "Empresa sem nome";
}

function getTradeName(company) {
  const names = [company?.nome_fantasia, company?.estabelecimento?.nome_fantasia].filter(Boolean);
  return names.find((name) => name !== company?.razao_social) || null;
}

function getAddress(est) {
  if (!est) return null;
  return [est.tipo_logradouro, est.logradouro, est.numero, est.complemento, est.bairro].filter(Boolean).join(", ");
}

function getPhone(est) {
  if (!est) return null;
  return [est.ddd1, est.telefone1].filter(Boolean).join(" ");
}


function countFields(obj) {
  if (!obj || typeof obj !== "object") return 0;
  return Object.entries(obj).reduce((total, [key, value]) => {
    if (key.startsWith("_")) return total;
    if (value === null || value === undefined || value === "") return total;
    if (Array.isArray(value)) return total + value.reduce((sum, item) => sum + countFields(item), 0);
    if (typeof value === "object") return total + countFields(value);
    return total + 1;
  }, 0);
}

function smartFormat(key, value) {
  if (typeof value === "boolean") return fmt.bool(value);
  if (typeof value !== "string" && typeof value !== "number") return null;

  const text = String(value);
  const digits = onlyDigits(text);
  const lk = key.toLowerCase();

  if (lk.includes("cnpj") && digits.length === 14) return fmt.cnpj(digits);
  if (lk.includes("cpf") && digits.length === 11) return fmt.cpf(digits);
  if (lk.includes("cep") && digits.length === 8) return fmt.cep(digits);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return fmt.date(text);
  if ((lk.includes("capital") || lk.includes("valor")) && !Number.isNaN(Number.parseFloat(text))) {
    return fmt.currency(text);
  }
  return text;
}

function upsertCompany(list, company) {
  const cnpj = getCompanyCnpj(company);
  if (!cnpj) return list;
  const savedAt = new Date().toISOString();
  const next = { ...company, _savedAt: savedAt };
  return [next, ...list.filter((item) => getCompanyCnpj(item) !== cnpj)].slice(0, 60);
}

function findMatches(companies, mode, query) {
  const textQuery = normalizeText(query);
  const digitQuery = onlyDigits(query);
  if (!textQuery && !digitQuery) return [];

  return companies
    .map((company) => {
      const socios = Array.isArray(company?.socios) ? company.socios : [];
      const companyHaystack = normalizeText(
        [company?.razao_social, company?.nome_fantasia, company?.estabelecimento?.nome_fantasia].filter(Boolean).join(" ")
      );
      const partnerMatches = socios.filter((socio) => normalizeText(socio?.nome).includes(textQuery));
      const documentMatches = socios.filter((socio) => {
        const doc = String(socio?.cpf_cnpj_socio ?? "");
        const docText = normalizeText(doc);
        const docDigits = onlyDigits(doc);
        return (digitQuery && docDigits.includes(digitQuery)) || (textQuery && docText.includes(textQuery));
      });

      let matched = false;
      let reason = "";

      if (mode === "company") {
        matched = companyHaystack.includes(textQuery);
        reason = "Empresa";
      }
      if (mode === "partner") {
        matched = partnerMatches.length > 0;
        reason = `${partnerMatches.length} socio(s) encontrado(s)`;
      }
      if (mode === "document") {
        matched = documentMatches.length > 0;
        reason = `${documentMatches.length} documento(s) encontrado(s)`;
      }
      if (mode === "cnpj") {
        const cnpj = getCompanyCnpj(company);
        matched = Boolean(digitQuery && cnpj.includes(digitQuery));
        reason = "CNPJ salvo";
      }

      return { company, reason, partnerMatches, documentMatches, matched };
    })
    .filter((result) => result.matched);
}

function findKnownCompanies(query) {
  const textQuery = normalizeText(query);
  const digitQuery = onlyDigits(query);
  if (!textQuery && !digitQuery) return [];
  if (textQuery && textQuery.length < 2 && !digitQuery) return [];

  return KNOWN_COMPANIES.map((company) => {
    const fields = [company.name, ...company.aliases].map(normalizeText);
    const startsWith = fields.some((field) => field.startsWith(textQuery));
    const includes = fields.some((field) => field.includes(textQuery));
    const documentMatch = digitQuery && company.cnpj.includes(digitQuery);

    return { ...company, _score: startsWith ? 2 : includes || documentMatch ? 1 : 0 };
  })
    .filter((company) => company._score > 0)
    .sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));
}

function SummaryRow({ label, value, accent }) {
  if (!value) return null;
  return (
    <div className="summary-row">
      <span className="summary-label">{label}</span>
      <span className={"summary-value" + (accent ? " accent" : "")}>{value}</span>
    </div>
  );
}

function SituacaoBadge({ situacao }) {
  if (!situacao) return null;
  const desc = situacao.descricao || situacao;
  const isAtiva = normalizeText(desc).includes("ativa");
  return (
    <span className={"sit-badge " + (isAtiva ? "sit-ativa" : "sit-inativa")}>
      <span className={"dot " + (isAtiva ? "dot-green" : "dot-red")} />
      {desc}
    </span>
  );
}

function ValueDisplay({ keyName, value }) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="empty">Lista vazia</span>;
    if (value.every((item) => typeof item !== "object")) {
      return (
        <div className="badge-row">
          {value.map((item, index) => (
            <span key={index} className="badge">
              {smartFormat(keyName, item)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="nested-list">
        {value.map((item, index) => (
          <div key={index} className="nested-card">
            <span className="nested-index">#{index + 1}</span>
            <ObjectDisplay data={item} />
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
  return <span className="field-value">{smartFormat(keyName, value)}</span>;
}

function ObjectDisplay({ data }) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data).filter(
    ([key, value]) => !key.startsWith("_") && value !== null && value !== undefined && value !== ""
  );
  if (entries.length === 0) return <span className="empty">Sem dados</span>;
  return (
    <dl className="obj-grid">
      {entries.map(([key, value]) => (
        <div key={key} className={typeof value === "object" || Array.isArray(value) ? "span-full" : ""}>
          <dt className="field-label">{humanize(key)}</dt>
          <dd>
            <ValueDisplay keyName={key} value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CompanyResult({ result, onOpen }) {
  const company = result.company;
  const est = company.estabelecimento;
  const cnpj = getCompanyCnpj(company);
  const cityUF = [est?.cidade?.nome, est?.estado?.sigla].filter(Boolean).join(" / ");
  const matchedPartners = [...result.partnerMatches, ...result.documentMatches].filter(
    (partner, index, list) => list.findIndex((item) => item?.nome === partner?.nome && item?.cpf_cnpj_socio === partner?.cpf_cnpj_socio) === index
  );

  return (
    <article className="result-card">
      <div>
        <div className="result-kicker">{result.reason}</div>
        <h3>{getCompanyName(company)}</h3>
        {getTradeName(company) && <p>{getTradeName(company)}</p>}
        <div className="mini-row">
          {cnpj && <span>{fmt.cnpj(cnpj)}</span>}
          {cityUF && <span>{cityUF}</span>}
          {company.socios?.length > 0 && <span>{company.socios.length} socio(s)</span>}
        </div>
        {matchedPartners.length > 0 && (
          <div className="match-list">
            {matchedPartners.slice(0, 3).map((partner, index) => (
              <span key={`${partner.nome}-${index}`}>
                {partner.nome} {partner.cpf_cnpj_socio ? `(${partner.cpf_cnpj_socio})` : ""}
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

function KnownCompanyResult({ company, onConsult }) {
  return (
    <article className="result-card suggested">
      <div>
        <div className="result-kicker">Sugestao por nome</div>
        <h3>{company.name}</h3>
        <p>{company.note}</p>
        <div className="mini-row">
          <span>{fmt.cnpj(company.cnpj)}</span>
          {company.aliases.slice(0, 3).map((alias) => (
            <span key={alias}>{alias}</span>
          ))}
        </div>
      </div>
      <button className="btn-secondary" onClick={() => onConsult(company.cnpj)}>
        Consultar
      </button>
    </article>
  );
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
  const [remoteMatches, setRemoteMatches] = useState([]);
  const [savedCompanies, setSavedCompanies] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCompanies));
  }, [savedCompanies]);

  const activeMode = SEARCH_MODES.find((item) => item.id === mode) || SEARCH_MODES[0];
  const rawCnpj = onlyDigits(input);
  const localMatches = useMemo(() => findMatches(savedCompanies, mode, input), [savedCompanies, mode, input]);
  const knownMatches = useMemo(() => (mode === "company" ? findKnownCompanies(input) : []), [input, mode]);
  const availableCompanyMatches = useMemo(() => {
    const localCnpjs = new Set(localMatches.map((result) => getCompanyCnpj(result.company)));
    const suggestions = knownMatches.filter((company) => !localCnpjs.has(company.cnpj));
    return { local: localMatches, suggestions };
  }, [knownMatches, localMatches]);
  const availableCompanyCount = availableCompanyMatches.local.length + availableCompanyMatches.suggestions.length;
  const combinedMatches = useMemo(() => {
    const seen = new Set();
    return [...remoteMatches, ...localMatches].filter((result) => {
      const cnpj = getCompanyCnpj(result.company);
      if (!cnpj || seen.has(cnpj)) return false;
      seen.add(cnpj);
      return true;
    });
  }, [localMatches, remoteMatches]);
  const resultCount = mode === "company" ? availableCompanyCount : combinedMatches.length;

  const saveCompany = useCallback((company) => {
    setSavedCompanies((current) => upsertCompany(current, company));
  }, []);

  const handleInput = (event) => {
    const value = event.target.value;
    setError(null);
    setShowRaw(false);
    setRemoteMatches([]);
    if (data) setData(null);
    setIsDemo(false);

    if (mode === "cnpj") {
      setInput(fmt.cnpj(value));
      return;
    }
    if (mode === "document") {
      const clean = value.replace(/[^\d*./-]/g, "").slice(0, 18);
      setInput(clean);
      return;
    }
    setInput(value);
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setInput("");
    setError(null);
    setRemoteMatches([]);
  };

  const resetSearch = () => {
    setInput("");
    setError(null);
    setData(null);
    setIsDemo(false);
    setShowRaw(false);
    setCopied(false);
    setRemoteMatches([]);
  };

  const loadDemo = () => {
    setError(null);
    setData(MOCK_DATA);
    setIsDemo(true);
    setShowRaw(false);
    setInput(fmt.cnpj(MOCK_DATA.cnpj));
    setMode("cnpj");
    saveCompany(MOCK_DATA);
  };

  const openSavedCompany = (company) => {
    setError(null);
    setData(company);
    setIsDemo(false);
    setShowRaw(false);
    setMode("cnpj");
    setInput(fmt.cnpj(getCompanyCnpj(company)));
    saveCompany(company);
  };

  const consultCnpj = useCallback(
    async (cnpj) => {
      const cleanCnpj = onlyDigits(cnpj);

      setError(null);
      setData(null);
      setIsDemo(false);
      setShowRaw(false);
      setMode("cnpj");
      setInput(fmt.cnpj(cleanCnpj));

      if (cleanCnpj.length !== 14) {
        setError({ type: "invalid", msg: "CNPJ invalido. Digite os 14 digitos." });
        return;
      }
      if (!isValidCnpj(cleanCnpj)) {
        setError({
          type: "invalid",
          msg: `CNPJ ${fmt.cnpj(cleanCnpj)} invalido: os digitos verificadores nao conferem. Confira o numero e tente novamente.`,
        });
        return;
      }

      const cached = savedCompanies.find((company) => getCompanyCnpj(company) === cleanCnpj);
      if (cached) setData(cached);

      setLoading(true);
      try {
        const json = await consultarCnpjService(cleanCnpj);
        setData(json);
        saveCompany(json);
      } catch (e) {
        const msg = e?.message || "";
        const details = e?.details || [];
        const hasNotFound = details.every?.((d) => d.status === 404) || e?.details?.status === 404;
        const hasRateLimit = details.some?.((d) => d.status === 429) || e?.details?.status === 429;

        if (hasNotFound) {
          setError({ type: "notfound", msg: "CNPJ nao encontrado nas APIs gratuitas consultadas." });
          return;
        }
        if (hasRateLimit) {
          setError({ type: "ratelimit", msg: "A API gratuita atingiu limite temporario. Aguarde alguns segundos e tente novamente." });
          return;
        }
        setError({
          type: "network",
          msg: msg.includes("Failed to fetch")
            ? "Falha de rede ou bloqueio de CORS nas APIs gratuitas. O app ainda pesquisa no historico local."
            : msg || "Falha ao consultar o CNPJ. Verifique a conexao e tente novamente.",
        });
      } finally {
        setLoading(false);
      }
    },
    [saveCompany, savedCompanies]
  );

  const clearHistory = () => {
    setSavedCompanies([]);
    setData(null);
    setShowRaw(false);
    setError(null);
    setRemoteMatches([]);
  };

  const searchPartnerDocument = useCallback(async () => {
    setLoading(true);
    setRemoteMatches([]);
    try {
      const companies = await buscarEmpresasPorDocumentoSocio(onlyDigits(input));
      const results = companies.map((company) => ({
        company,
        reason: "Minha Receita global",
        partnerMatches: company.socios || [],
        documentMatches: company.socios || [],
        matched: true,
      }));

      setRemoteMatches(results);
      if (results.length === 0) {
        setError({
          type: "notfound",
          msg: "Nenhuma empresa encontrada na busca global por documento de socio. Tente CPF completo, CNPJ completo ou os 6 digitos centrais do CPF.",
        });
      }
    } catch (e) {
      setError({
        type: "network",
        msg: e?.message || "Falha na busca global gratuita da Minha Receita. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }, [input]);

  const consultar = useCallback(async () => {
    setError(null);
    setShowRaw(false);

    if (mode !== "cnpj") {
      setData(null);
      if (!input.trim()) {
        setError({ type: "empty", msg: "Digite um termo para pesquisar nos dados salvos localmente." });
      } else if (mode === "document") {
        await searchPartnerDocument();
      } else if (mode === "company" && availableCompanyCount > 0) {
        setError(null);
      } else if (localMatches.length === 0 && knownMatches.length === 0) {
        setError({
          type: "notfound",
          msg: "Nada encontrado no historico local. APIs gratuitas documentadas nao oferecem busca global por razao social ou nome de socio; para isso e necessario um indice proprio ou API comercial.",
        });
      }
      return;
    }

    if (rawCnpj.length === 0) {
      setError({ type: "empty", msg: "Digite um CNPJ para consultar." });
      return;
    }

    await consultCnpj(rawCnpj);
  }, [availableCompanyCount, consultCnpj, input, knownMatches, localMatches.length, mode, rawCnpj, searchPartnerDocument]);

  const copyJSON = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const est = data?.estabelecimento;
  const cnpjRaw = data ? getCompanyCnpj(data) : rawCnpj;
  const cityUF = est ? [est.cidade?.nome, est.estado?.sigla].filter(Boolean).join(" / ") : null;
  const cnaePrincipal = est?.atividade_principal
    ? `${est.atividade_principal.subclasse} - ${est.atividade_principal.descricao}`
    : null;
  const inscricoes = est?.inscricoes_estaduais?.length
    ? est.inscricoes_estaduais.map((ie) => `${ie.inscricao_estadual} (${ie.estado?.sigla || ""})`).join(", ")
    : null;
  const filledCount = data ? countFields(data) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
        :root{--bg:#0d1117;--surface:#151b23;--surface2:#1c2430;--surface3:#0f1620;--border:#2a3544;--accent:#35d2a6;--accent2:#4aa3ff;--danger:#f87171;--warn:#fbbf24;--text:#edf4fb;--muted:#9aa8bb;--dim:#687789;--r:8px}
        body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif}
        button,input{font:inherit}
        .wrap{min-height:100vh;background:linear-gradient(180deg,rgba(53,210,166,.08),transparent 260px),var(--bg)}
        .container{max-width:1120px;margin:0 auto;padding:32px 18px 48px}
        .topbar{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:28px}
        .kicker{display:inline-flex;align-items:center;border:1px solid rgba(53,210,166,.35);color:var(--accent);background:rgba(53,210,166,.09);border-radius:999px;padding:4px 10px;font:600 12px/1 JetBrains Mono,monospace;text-transform:uppercase}
        h1{font-size:clamp(2rem,5vw,4rem);line-height:1;margin:.85rem 0 .7rem;letter-spacing:0;font-weight:800}
        .lead{max-width:720px;color:var(--muted);font-size:1rem;line-height:1.6;margin:0}
        .history-pill{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:10px 12px;color:var(--muted);white-space:nowrap;font-size:.85rem}
        .panel{background:rgba(21,27,35,.96);border:1px solid var(--border);border-radius:var(--r);box-shadow:0 20px 70px rgba(0,0,0,.28)}
        .search-panel{padding:18px;margin-bottom:18px}
        .mode-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
        .mode-btn{border:1px solid var(--border);background:var(--surface3);color:var(--muted);border-radius:var(--r);padding:8px 12px;cursor:pointer;font-size:.9rem}
        .mode-btn.active{border-color:rgba(53,210,166,.55);background:rgba(53,210,166,.12);color:var(--accent)}
        .input-row{display:grid;grid-template-columns:1fr auto auto;gap:10px}
        .query-input{width:100%;background:var(--surface3);border:1.5px solid var(--border);border-radius:var(--r);color:var(--text);padding:14px 15px;outline:none}
        .query-input.mono{font-family:JetBrains Mono,monospace;letter-spacing:.02em}
        .query-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(53,210,166,.11)}
        .btn-primary,.btn-secondary,.btn-ghost{border-radius:var(--r);padding:0 16px;min-height:48px;cursor:pointer;font-weight:700}
        .btn-primary{border:0;background:var(--accent);color:#06110e}
        .btn-primary:disabled{opacity:.55;cursor:not-allowed}
        .btn-secondary{border:1px solid rgba(74,163,255,.45);background:rgba(74,163,255,.1);color:#b9dcff}
        .btn-ghost{border:1px dashed var(--border);background:transparent;color:var(--muted)}
        .btn-sm{border:1px solid var(--border);background:var(--surface3);color:var(--muted);border-radius:var(--r);padding:8px 10px;cursor:pointer}
        .btn-sm.on{color:#b9dcff;border-color:rgba(74,163,255,.45);background:rgba(74,163,255,.1)}
        .note{margin:12px 0 0;color:var(--dim);font-size:.82rem;line-height:1.45}
        .grid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;align-items:start}
        .card{padding:18px;margin-bottom:18px}
        .err-box{border-radius:var(--r);padding:13px 14px;margin-bottom:18px;font-size:.9rem;line-height:1.45}
        .err-empty,.err-invalid{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);color:#fecaca}
        .err-notfound{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.26);color:#fde68a}
        .err-ratelimit{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.26);color:#fde68a}
        .err-network,.err-generic{background:rgba(154,168,187,.08);border:1px solid rgba(154,168,187,.24);color:#cbd5e1}
        .loading{display:flex;gap:12px;align-items:center;color:var(--muted);padding:18px}
        .spinner{width:24px;height:24px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .section-title{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}
        .section-title h2{font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0}
        .result-list{display:flex;flex-direction:column;gap:10px}
        .result-card{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;background:var(--surface3);border:1px solid var(--border);border-radius:var(--r);padding:14px}
        .result-card.suggested{border-color:rgba(53,210,166,.42);background:rgba(53,210,166,.06)}
        .result-kicker{color:var(--accent);font-size:.73rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
        .result-card h3{font-size:1rem;margin:0 0 2px}
        .result-card p{margin:0;color:var(--muted);font-size:.88rem}
        .mini-row,.match-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
        .mini-row span,.match-list span,.stat-pill{border:1px solid var(--border);background:var(--surface2);border-radius:999px;color:var(--muted);padding:3px 8px;font-size:.75rem}
        .match-list span{color:#d9e7f7}
        .res-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}
        .company-title{font-size:clamp(1.35rem,3vw,2rem);line-height:1.12;font-weight:800;margin:0}
        .company-sub{color:var(--muted);margin-top:5px}
        .stats-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        .sit-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px;font-size:.72rem;font-weight:800;text-transform:uppercase;white-space:nowrap}
        .sit-ativa{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.28);color:#86efac}
        .sit-inativa{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.28);color:#fca5a5}
        .dot{width:7px;height:7px;border-radius:50%}.dot-green{background:#22c55e}.dot-red{background:#ef4444}
        .actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
        .search-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
        .sum-grid,.obj-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
        .summary-row{background:var(--surface3);border:1px solid var(--border);border-radius:var(--r);padding:11px 12px}
        .summary-label,.field-label{display:block;color:var(--dim);font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px}
        .summary-value,.field-value{color:var(--text);font-size:.9rem;word-break:break-word}
        .summary-value.accent{font-family:JetBrains Mono,monospace;color:var(--accent)}
        .span-full{grid-column:1/-1}
        .nested-list{display:flex;flex-direction:column;gap:10px}
        .nested-card{position:relative;background:var(--surface3);border:1px solid var(--border);border-radius:var(--r);padding:13px;margin-top:4px}
        .nested-object{margin-top:0}
        .nested-index{position:absolute;top:-9px;left:10px;background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:0 6px;font:600 .65rem JetBrains Mono,monospace;color:var(--muted)}
        .badge-row{display:flex;flex-wrap:wrap;gap:5px}
        .badge{background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:2px 7px;color:var(--muted);font-size:.78rem}
        .empty{color:var(--dim);font-style:italic;font-size:.82rem}
        .raw-pre{background:#071019;border:1px solid var(--border);border-radius:var(--r);padding:14px;overflow:auto;max-height:460px;color:#9ddcff;font:12px/1.65 JetBrains Mono,monospace}
        .side-list{display:flex;flex-direction:column;gap:8px}
        .side-item{border:1px solid var(--border);background:var(--surface3);border-radius:var(--r);padding:10px;text-align:left;color:var(--text);cursor:pointer}
        .side-item strong{display:block;font-size:.84rem;margin-bottom:3px}.side-item span{color:var(--muted);font-size:.76rem}
        .empty-state{color:var(--dim);font-size:.9rem;line-height:1.5}
        .footer{color:var(--dim);font:12px JetBrains Mono,monospace;text-align:center;margin-top:24px}
        @media(max-width:820px){.topbar,.res-header{flex-direction:column}.history-pill{white-space:normal}.grid{grid-template-columns:1fr}.input-row{grid-template-columns:1fr}.btn-primary,.btn-secondary,.btn-ghost{width:100%;padding:13px}.stats-row{justify-content:flex-start}}
      `}</style>

      <div className="wrap">
        <main className="container">
          <header className="topbar">
            <div>
              <span className="kicker">Receita Federal / CNPJ.ws</span>
              <h1>Consulta CNPJ</h1>
              <p className="lead">
                Consulte por CNPJ na API publica e pesquise localmente por empresa, socio ou documento de socio nos CNPJs que voce ja carregou.
              </p>
            </div>
            <div className="history-pill">{savedCompanies.length} empresa(s) no historico local</div>
          </header>

          <section className="panel search-panel">
            <div className="mode-row" role="tablist" aria-label="Tipo de busca">
              {SEARCH_MODES.map((item) => (
                <button
                  key={item.id}
                  className={"mode-btn " + (mode === item.id ? "active" : "")}
                  onClick={() => changeMode(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="input-row">
              <input
                className={"query-input " + (mode === "cnpj" || mode === "document" ? "mono" : "")}
                value={input}
                onChange={handleInput}
                onKeyDown={(event) => event.key === "Enter" && consultar()}
                placeholder={activeMode.placeholder}
                inputMode={mode === "company" || mode === "partner" ? "text" : "numeric"}
                aria-label={activeMode.label}
              />
              <button className="btn-primary" onClick={consultar} disabled={loading}>
                {loading ? "Consultando..." : mode === "cnpj" ? "Consultar" : "Pesquisar"}
              </button>
              <button className="btn-ghost" onClick={loadDemo} type="button">
                Demo
              </button>
            </div>
            <p className="note">
              CNPJ consulta CNPJ.ws e usa Minha Receita como fallback gratuito. CPF/CNPJ socio faz busca global gratuita pela Minha Receita.
              Busca global por razao social/nome de socio exige indice proprio ou API comercial; aqui ela pesquisa historico local e sugestoes.
            </p>
            {(input || data || error) && (
              <div className="search-actions">
                <button className="btn-sm" onClick={resetSearch} type="button">
                  Nova busca
                </button>
              </div>
            )}
          </section>

          {error && <div className={"err-box err-" + error.type}>{error.msg}</div>}

          {loading && (
            <div className="panel loading">
              <div className="spinner" />
              <span>Consultando {fmt.cnpj(rawCnpj)}...</span>
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
                    {mode === "company" &&
                      availableCompanyMatches.suggestions.map((company) => (
                        <KnownCompanyResult key={company.cnpj} company={company} onConsult={consultCnpj} />
                      ))}
                    {(mode === "company" ? availableCompanyMatches.local : combinedMatches).map((result) => (
                      <CompanyResult key={getCompanyCnpj(result.company)} result={result} onOpen={openSavedCompany} />
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
                      {cnpjRaw && <span className="stat-pill">{fmt.cnpj(cnpjRaw)}</span>}
                      <span className="stat-pill">{filledCount} campos</span>
                    </div>
                  </div>

                  <div className="actions">
                    <button className="btn-sm" onClick={resetSearch}>
                      Nova busca
                    </button>
                    <button className={"btn-sm " + (showRaw ? "on" : "")} onClick={() => setShowRaw((value) => !value)}>
                      {showRaw ? "Ocultar JSON" : "Ver JSON bruto"}
                    </button>
                    <button className="btn-sm" onClick={copyJSON}>
                      {copied ? "Copiado" : "Copiar JSON"}
                    </button>
                  </div>

                  {showRaw && <pre className="raw-pre">{JSON.stringify(data, null, 2)}</pre>}

                  <div className="section-title">
                    <h2>Resumo principal</h2>
                  </div>
                  <div className="sum-grid">
                    <SummaryRow label="Razao Social" value={data?.razao_social} />
                    <SummaryRow label="Nome Fantasia" value={getTradeName(data)} />
                    <SummaryRow label="CNPJ" value={cnpjRaw ? fmt.cnpj(cnpjRaw) : null} accent />
                    <SummaryRow label="Capital Social" value={data?.capital_social ? fmt.currency(data.capital_social) : null} accent />
                    <SummaryRow label="Endereco" value={getAddress(est)} />
                    <SummaryRow label="Cidade / UF" value={cityUF} />
                    <SummaryRow label="CEP" value={est?.cep ? fmt.cep(est.cep) : null} />
                    <SummaryRow label="CNAE Principal" value={cnaePrincipal} />
                    <SummaryRow label="Telefone" value={getPhone(est)} />
                    <SummaryRow label="E-mail" value={est?.email} />
                    <SummaryRow label="Inscricoes Estaduais" value={inscricoes} />
                    <SummaryRow label="Porte" value={data?.porte?.descricao} />
                    <SummaryRow label="Natureza Juridica" value={data?.natureza_juridica?.descricao} />
                    <SummaryRow label="Inicio Atividade" value={est?.data_inicio_atividade ? fmt.date(est.data_inicio_atividade) : null} />
                    <SummaryRow label="Simples Nacional" value={data?.simples?.simples !== undefined ? fmt.bool(data.simples.simples) : null} />
                    <SummaryRow label="MEI" value={data?.simples?.mei !== undefined ? fmt.bool(data.simples.mei) : null} />
                    <SummaryRow label="Fonte API" value={data?._source} accent />
                  </div>

                  <div className="section-title" style={{ marginTop: 22 }}>
                    <h2>Todos os dados retornados</h2>
                  </div>
                  <ObjectDisplay data={data} />
                </section>
              )}
            </div>

            <aside className="panel card">
              <div className="section-title">
                <h2>Historico local</h2>
                {savedCompanies.length > 0 && (
                  <button className="btn-sm" onClick={clearHistory} type="button">
                    Limpar
                  </button>
                )}
              </div>
              {savedCompanies.length === 0 ? (
                <p className="empty-state">
                  Consulte um CNPJ ou carregue a demo. Depois disso, a busca por socio, CPF/CNPJ de socio e nome de empresa passa a funcionar localmente.
                </p>
              ) : (
                <div className="side-list">
                  {savedCompanies.slice(0, 10).map((company) => (
                    <button key={getCompanyCnpj(company)} className="side-item" onClick={() => openSavedCompany(company)} type="button">
                      <strong>{getCompanyName(company)}</strong>
                      <span>
                        {fmt.cnpj(getCompanyCnpj(company))} {company.socios?.length ? `- ${company.socios.length} socio(s)` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </aside>
          </div>

          <div className="footer">cnpj.ws/api - dados publicos - historico salvo apenas neste navegador</div>
        </main>
      </div>
    </>
  );
}
