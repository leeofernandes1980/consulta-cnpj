import { isValidCnpj, onlyDigits, unmaskCnpj } from "../utils/cnpj";
import {
  normalizeCnpjWs,
  normalizeMinhaReceitaToCnpjWsFormat,
} from "../utils/normalizers";
import { fetchCnpjWs } from "./cnpjWsService";
import {
  fetchMinhaReceitaByCnpj,
  fetchMinhaReceitaBySocioDocument,
} from "./minhaReceitaService";

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
    throw new ConsultaError("Informe um CNPJ válido com 14 dígitos.");
  }

  const errors = [];

  try {
    const cnpjWsData = await fetchCnpjWs(cleanCnpj);
    return normalizeCnpjWs(cnpjWsData);
  } catch (error) {
    errors.push({
      source: "cnpj_ws",
      message: error.message,
      status: error.status || null,
    });
  }

  try {
    const minhaReceitaData = await fetchMinhaReceitaByCnpj(cleanCnpj);
    return normalizeMinhaReceitaToCnpjWsFormat(minhaReceitaData);
  } catch (error) {
    errors.push({
      source: "minha_receita",
      message: error.message,
      status: error.status || null,
    });
  }

  const hasRateLimit = errors.some((error) => error.status === 429);
  const hasNotFound = errors.every((error) => error.status === 404);

  if (hasRateLimit) {
    throw new ConsultaError(
      "As fontes gratuitas limitaram temporariamente as consultas. Aguarde alguns instantes e tente novamente.",
      errors
    );
  }

  if (hasNotFound) {
    throw new ConsultaError(
      "CNPJ não encontrado nas fontes gratuitas consultadas.",
      errors
    );
  }

  throw new ConsultaError(
    "Não foi possível consultar o CNPJ nas fontes gratuitas disponíveis.",
    errors
  );
}

export async function buscarEmpresasPorDocumentoSocio(documento) {
  const cleanDocument = onlyDigits(documento);

  if (![6, 11, 14].includes(cleanDocument.length)) {
    throw new ConsultaError(
      "Informe CPF completo, CNPJ completo ou os 6 dígitos centrais do CPF do sócio."
    );
  }

  try {
    const payload = await fetchMinhaReceitaBySocioDocument(cleanDocument);
    const companies = Array.isArray(payload?.data) ? payload.data : [];
    return companies.map(normalizeMinhaReceitaToCnpjWsFormat);
  } catch (error) {
    throw new ConsultaError(error.message, {
      source: "minha_receita",
      status: error.status || null,
    });
  }
}