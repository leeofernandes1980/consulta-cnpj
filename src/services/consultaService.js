import { isValidCnpj, onlyDigits, unmaskCnpj } from "../utils/cnpj";
import {
  normalizeCnpjWs,
  normalizeMinhaReceitaToCnpjWsFormat,
  normalizeBrasilApiToCnpjWsFormat,
} from "../utils/normalizers";
import { fetchCnpjWs } from "./cnpjWsService";
import { fetchMinhaReceitaByCnpj, fetchMinhaReceitaBySocioDocument } from "./minhaReceitaService";
import { fetchBrasilApi } from "./brasilApiService";

export class ConsultaError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "ConsultaError";
    this.details = details;
  }
}

export async function consultarCnpj(cnpj) {
  const cleanCnpj = unmaskCnpj(cnpj);

  if (!isValidCnpj(cleanCnpj)) {
    throw new ConsultaError("Informe um CNPJ valido com 14 digitos.");
  }

  const errors = [];

  try {
    const data = await fetchCnpjWs(cleanCnpj);
    return normalizeCnpjWs(data);
  } catch (e) {
    errors.push({ source: "cnpj_ws", message: e.message, status: e.status || null });
  }

  try {
    const data = await fetchMinhaReceitaByCnpj(cleanCnpj);
    return normalizeMinhaReceitaToCnpjWsFormat(data);
  } catch (e) {
    errors.push({ source: "minha_receita", message: e.message, status: e.status || null });
  }

  try {
    const data = await fetchBrasilApi(cleanCnpj);
    return normalizeBrasilApiToCnpjWsFormat(data);
  } catch (e) {
    errors.push({ source: "brasil_api", message: e.message, status: e.status || null });
  }

  const hasRateLimit = errors.some((e) => e.status === 429);
  const hasNotFound = errors.every((e) => e.status === 404);

  if (hasRateLimit) {
    throw new ConsultaError(
      "As fontes gratuitas limitaram temporariamente as consultas. Aguarde alguns instantes e tente novamente.",
      errors
    );
  }
  if (hasNotFound) {
    throw new ConsultaError("CNPJ nao encontrado nas fontes gratuitas consultadas.", errors);
  }
  throw new ConsultaError(
    "Nao foi possivel consultar o CNPJ nas fontes gratuitas disponiveis.",
    errors
  );
}

export async function buscarEmpresasPorDocumentoSocio(documento, uf) {
  const cleanDocument = onlyDigits(documento);

  if (![6, 11, 14].includes(cleanDocument.length)) {
    throw new ConsultaError(
      "Informe CPF completo, CNPJ completo ou os 6 digitos centrais do CPF do socio."
    );
  }

  try {
    const payload = await fetchMinhaReceitaBySocioDocument(cleanDocument, uf);
    const companies = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    return companies.map(normalizeMinhaReceitaToCnpjWsFormat);
  } catch (error) {
    throw new ConsultaError(error.message, {
      source: "minha_receita",
      status: error.status || null,
      isUnavailable: error.isUnavailable || false,
    });
  }
}
