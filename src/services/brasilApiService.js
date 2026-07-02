const BASE = "https://brasilapi.com.br/api/cnpj/v1";

export class BrasilApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "BrasilApiError";
    this.status = status;
  }
}

export async function fetchBrasilApi(cnpj) {
  const response = await fetch(`${BASE}/${cnpj}`);
  if (!response.ok) {
    if (response.status === 404) throw new BrasilApiError("CNPJ não encontrado na BrasilAPI.", 404);
    if (response.status === 429) throw new BrasilApiError("Limite atingido na BrasilAPI.", 429);
    throw new BrasilApiError(`BrasilAPI: HTTP ${response.status}`, response.status);
  }
  return response.json();
}
