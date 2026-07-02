import { onlyDigits, unmaskCnpj } from "../utils/cnpj";

const MINHA_RECEITA_BASE_URL = "https://minhareceita.org";

export class MinhaReceitaError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "MinhaReceitaError";
    this.status = status;
  }
}

export async function fetchMinhaReceitaByCnpj(cnpj) {
  const cleanCnpj = unmaskCnpj(cnpj);

  if (cleanCnpj.length !== 14) {
    throw new MinhaReceitaError("CNPJ inválido para consulta na Minha Receita.");
  }

  const response = await fetch(`${MINHA_RECEITA_BASE_URL}/${cleanCnpj}`);

  if (!response.ok) {
    if (response.status === 400) {
      throw new MinhaReceitaError("CNPJ inválido ou mal formatado.", response.status);
    }

    if (response.status === 404) {
      throw new MinhaReceitaError("CNPJ não encontrado na Minha Receita.", response.status);
    }

    if (response.status === 429) {
      throw new MinhaReceitaError(
        "Limite de consultas atingido na Minha Receita.",
        response.status
      );
    }

    throw new MinhaReceitaError(
      `Erro ao consultar Minha Receita. Código HTTP: ${response.status}`,
      response.status
    );
  }

  return response.json();
}

// A Receita Federal publica o CPF do socio mascarado (so os 6 digitos
// centrais ficam visiveis, ex: ***456789**). A busca por CPF so encontra
// resultado se enviarmos o documento nesse mesmo formato mascarado.
function maskSocioCpf(cleanDocument) {
  if (cleanDocument.length === 14) return cleanDocument;
  const middleSix = cleanDocument.length === 11 ? cleanDocument.slice(3, 9) : cleanDocument;
  return `***${middleSix}**`;
}

export async function fetchMinhaReceitaBySocioDocument(documento, uf) {
  const cleanDocument = onlyDigits(documento);

  if (![6, 11, 14].includes(cleanDocument.length)) {
    throw new MinhaReceitaError(
      "Informe CPF completo, CNPJ completo ou os 6 dígitos centrais do CPF do sócio."
    );
  }

  const params = new URLSearchParams({ cnpf: maskSocioCpf(cleanDocument), limit: "20" });
  if (uf) params.set("uf", uf.toUpperCase());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(
      `${MINHA_RECEITA_BASE_URL}/?${params.toString()}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new MinhaReceitaError(
          "Nenhuma empresa encontrada para o documento informado.",
          response.status
        );
      }
      if (response.status === 429) {
        throw new MinhaReceitaError(
          "Limite de consultas atingido na Minha Receita.",
          response.status
        );
      }
      throw new MinhaReceitaError(
        `Erro ao buscar sócio na Minha Receita. Código HTTP: ${response.status}`,
        response.status
      );
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      const e = new MinhaReceitaError(
        uf
          ? "Busca por documento de sócio expirou (timeout) mesmo filtrando por UF. Tente novamente em instantes."
          : "Busca por documento de sócio expirou (timeout). Selecione a UF do sócio para reduzir o escopo da busca.",
        null
      );
      e.isUnavailable = true;
      throw e;
    }
    throw error;
  }
}