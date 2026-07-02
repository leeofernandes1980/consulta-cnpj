import { maskCnpj } from "./cnpj";
import { flattenForCsv, getCompanyCnpj } from "./company";

export const STORAGE_KEY = "consulta-cnpj:empresas";
const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const EXPIRED_MS = 30 * 24 * 60 * 60 * 1000;

export function getEntryAgeMs(entry) {
  const ts = entry?.consultedAt || entry?._savedAt;
  if (!ts) return 0;
  return Date.now() - new Date(ts).getTime();
}

export function isStaleEntry(entry) {
  return getEntryAgeMs(entry) > STALE_MS;
}

export function isExpiredEntry(entry) {
  return getEntryAgeMs(entry) > EXPIRED_MS;
}

export function readHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((e) => !isExpiredEntry(e)) : [];
  } catch {
    return [];
  }
}

export function writeHistory(companies) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
  } catch {}
}

export function upsertCompany(list, company) {
  const cnpj = getCompanyCnpj(company);
  if (!cnpj) return list;
  const entry = { ...company, consultedAt: new Date().toISOString() };
  return [entry, ...list.filter((c) => getCompanyCnpj(c) !== cnpj)].slice(0, 60);
}

export function exportJson(companies) {
  const blob = new Blob([JSON.stringify(companies, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cnpjs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(companies) {
  const headers = ["CNPJ", "Razao Social", "Nome Fantasia", "Situacao", "Cidade", "UF", "CNAE", "Telefone", "Email", "Consultado Em"];
  const rows = companies.map((c) => {
    const f = flattenForCsv(c);
    return [f.cnpj, f.razao_social, f.nome_fantasia, f.situacao, f.cidade, f.uf, f.cnae, f.telefone, f.email, f.consultedAt]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cnpjs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
