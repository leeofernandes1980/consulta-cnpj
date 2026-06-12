import { formatCpfCnpj, onlyDigits } from "./cnpj";

export function formatCep(value) {
  const digits = onlyDigits(value);

  if (digits.length !== 8) {
    return value || "";
  }

  return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

export function formatDate(value) {
  if (!value || typeof value !== "string") {
    return value || "";
  }

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoDate) {
    return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  }

  return value;
}

export function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return value || "";
  }

  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatBoolean(value) {
  return value ? "Sim" : "Não";
}

export function normalizeKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatValueByKey(key, value) {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }

  if (typeof value === "boolean") {
    return formatBoolean(value);
  }

  const keyLower = String(key || "").toLowerCase();

  if (keyLower.includes("cnpj") || keyLower.includes("cpf")) {
    return formatCpfCnpj(value);
  }

  if (keyLower.includes("cep")) {
    return formatCep(value);
  }

  if (
    keyLower.includes("data") ||
    keyLower.includes("inicio") ||
    keyLower.includes("atualizado") ||
    keyLower.includes("abertura")
  ) {
    return formatDate(value);
  }

  if (
    keyLower.includes("capital") ||
    keyLower.includes("valor") ||
    keyLower.includes("faturamento")
  ) {
    return formatMoney(value);
  }

  if (Array.isArray(value) || typeof value === "object") {
    return value;
  }

  return String(value);
}

export function countFilledFields(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countFilledFields(item), 0);
  }

  if (typeof value === "object") {
    return Object.values(value).reduce(
      (total, item) => total + countFilledFields(item),
      0
    );
  }

  return 1;
}