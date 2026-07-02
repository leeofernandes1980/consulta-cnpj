import { onlyDigits, maskCnpj } from "./cnpj";

export function getCompanyCnpj(company) {
  return onlyDigits(
    company?.estabelecimento?.cnpj || company?.cnpj || company?.cnpj_raiz || ""
  );
}

export function getCompanyName(company) {
  return company?.razao_social || company?.nome_fantasia || company?.estabelecimento?.nome_fantasia || "Empresa sem nome";
}

export function getTradeName(company) {
  const candidates = [company?.nome_fantasia, company?.estabelecimento?.nome_fantasia].filter(Boolean);
  return candidates.find((n) => n !== company?.razao_social) || null;
}

export function getAddress(est) {
  if (!est) return null;
  return [est.tipo_logradouro, est.logradouro, est.numero, est.complemento, est.bairro]
    .filter(Boolean)
    .join(", ");
}

export function getPhone(est) {
  if (!est) return null;
  return [est.ddd1, est.telefone1].filter(Boolean).join(" ");
}

export function getSituacaoDesc(company) {
  const sit = company?.estabelecimento?.situacao_cadastral;
  if (!sit) return "";
  return typeof sit === "object" ? sit.descricao || "" : String(sit);
}

export function getUf(company) {
  return company?.estabelecimento?.estado?.sigla || "";
}

export function flattenForCsv(company) {
  const est = company?.estabelecimento || {};
  const sit = getSituacaoDesc(company);
  return {
    cnpj: maskCnpj(getCompanyCnpj(company)),
    razao_social: company?.razao_social || "",
    nome_fantasia: est?.nome_fantasia || company?.nome_fantasia || "",
    situacao: sit,
    cidade: est?.cidade?.nome || "",
    uf: est?.estado?.sigla || "",
    cnae: [est?.atividade_principal?.subclasse, est?.atividade_principal?.descricao].filter(Boolean).join(" - "),
    telefone: getPhone(est) || "",
    email: est?.email || "",
    consultedAt: company?.consultedAt ? company.consultedAt.slice(0, 10) : "",
  };
}
