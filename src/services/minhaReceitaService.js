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

export async function fetchMinhaReceitaBySocioDocument(documento) {
  const cleanDocument = onlyDigits(documento);

  if (![6, 11, 14].includes(cleanDocument.length)) {
    throw new MinhaReceitaError(
      "Informe CPF completo, CNPJ completo ou os 6 dígitos centrais do CPF do sócio."
    );
  }

  const response = await fetch(`${MINHA_RECEITA_BASE_URL}/?cnpf=${cleanDocument}`);

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
}