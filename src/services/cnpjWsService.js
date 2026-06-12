import { unmaskCnpj } from "../utils/cnpj";

const CNPJ_WS_BASE_URL = "https://publica.cnpj.ws/cnpj";

export class CnpjWsError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "CnpjWsError";
    this.status = status;
  }
}

export async function fetchCnpjWs(cnpj) {
  const cleanCnpj = unmaskCnpj(cnpj);

  if (cleanCnpj.length !== 14) {
    throw new CnpjWsError("CNPJ inválido para consulta na CNPJ.ws.");
  }

  const response = await fetch(`${CNPJ_WS_BASE_URL}/${cleanCnpj}`);

  if (!response.ok) {
    if (response.status === 400) {
      throw new CnpjWsError("CNPJ inválido ou mal formatado.", response.status);
    }

    if (response.status === 404) {
      throw new CnpjWsError("CNPJ não encontrado na CNPJ.ws.", response.status);
    }

    if (response.status === 429) {
      throw new CnpjWsError(
        "Limite de consultas atingido na CNPJ.ws. Tentando fonte alternativa.",
        response.status
      );
    }

    throw new CnpjWsError(
      `Erro ao consultar CNPJ.ws. Código HTTP: ${response.status}`,
      response.status
    );
  }

  return response.json();
}