import { formatCpfCnpj, onlyDigits } from "./cnpj";

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .trim();
}

export function formatCep(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 8) return value || "";
  return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

export function formatDate(value) {
  if (!value || typeof value !== "string") return value || "";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value || "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatBoolean(value) {
  return value ? "Sim" : "Nao";
}

export function normalizeKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatValueByKey(key, value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return formatBoolean(value);
  const lk = String(key || "").toLowerCase();
  if (lk.includes("cnpj") || lk.includes("cpf")) return formatCpfCnpj(String(value));
  if (lk.includes("cep")) return formatCep(String(value));
  if (lk.includes("data") || lk.includes("inicio") || lk.includes("atualizado") || lk.includes("abertura")) return formatDate(String(value));
  if (lk.includes("capital") || lk.includes("valor") || lk.includes("faturamento")) return formatMoney(value);
  if (Array.isArray(value) || typeof value === "object") return value;
  return String(value);
}

export function countFilledFields(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (Array.isArray(value)) return value.reduce((t, i) => t + countFilledFields(i), 0);
  if (typeof value === "object") return Object.values(value).reduce((t, i) => t + countFilledFields(i), 0);
  return 1;
}
