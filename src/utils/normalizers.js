import { onlyDigits } from "./cnpj";

function getFirstValue(...values) {
  return values.find(
    (value) => value !== null && value !== undefined && value !== ""
  ) || "";
}

function normalizePhone(value) {
  const digits = onlyDigits(value);

  if (!digits) {
    return {
      ddd: "",
      numero: "",
    };
  }

  if (digits.length >= 10) {
    return {
      ddd: digits.slice(0, 2),
      numero: digits.slice(2),
    };
  }

  return {
    ddd: "",
    numero: digits,
  };
}

function normalizeMinhaReceitaPartners(partners) {
  if (!Array.isArray(partners)) {
    return [];
  }

  return partners.map((socio) => ({
    nome: getFirstValue(socio.nome_socio, socio.nome),
    tipo: getFirstValue(socio.identificador_socio, socio.tipo),
    faixa_etaria: getFirstValue(socio.faixa_etaria),
    documento: getFirstValue(
      socio.cnpj_cpf_do_socio,
      socio.cnpj_cpf_socio,
      socio.documento
    ),
    data_entrada: getFirstValue(
      socio.data_entrada_sociedade,
      socio.data_entrada
    ),
    qualificacao_socio: {
      id: getFirstValue(
        socio.codigo_qualificacao_socio,
        socio.qualificacao_socio_id
      ),
      descricao: getFirstValue(
        socio.qualificacao_socio,
        socio.qualificacao
      ),
    },
    pais: {
      id: getFirstValue(socio.codigo_pais, socio.pais_id),
      nome: getFirstValue(socio.pais),
    },
    representante_legal: {
      nome: getFirstValue(socio.nome_representante_legal),
      documento: getFirstValue(socio.cpf_representante_legal),
      qualificacao: getFirstValue(socio.qualificacao_representante_legal),
    },
    raw: socio,
  }));
}

function normalizeMinhaReceitaSecondaryActivities(activities) {
  if (!Array.isArray(activities)) {
    return [];
  }

  return activities.map((atividade) => ({
    id: getFirstValue(atividade.codigo, atividade.id),
    descricao: getFirstValue(atividade.descricao),
    raw: atividade,
  }));
}

export function normalizeMinhaReceitaToCnpjWsFormat(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  const cnpj = onlyDigits(data.cnpj);
  const phone1 = normalizePhone(data.ddd_telefone_1);
  const phone2 = normalizePhone(data.ddd_telefone_2);

  return {
    fonte: "minha_receita",
    cnpj_raiz: cnpj.slice(0, 8),
    razao_social: getFirstValue(data.razao_social, data.nome),
    capital_social: getFirstValue(data.capital_social),
    responsavel_federativo: getFirstValue(data.responsavel_federativo),
    atualizado_em: getFirstValue(data.atualizado_em),

    porte: {
      id: getFirstValue(data.porte_id),
      descricao: getFirstValue(data.porte),
    },

    natureza_juridica: {
      id: getFirstValue(
        data.codigo_natureza_juridica,
        data.natureza_juridica_id
      ),
      descricao: getFirstValue(data.natureza_juridica),
    },

    qualificacao_do_responsavel: {
      id: getFirstValue(data.qualificacao_do_responsavel_id),
      descricao: getFirstValue(data.qualificacao_do_responsavel),
    },

    socios: normalizeMinhaReceitaPartners(data.qsa),

    estabelecimento: {
      cnpj,
      cnpj_raiz: cnpj.slice(0, 8),
      cnpj_ordem: cnpj.slice(8, 12),
      cnpj_digito_verificador: cnpj.slice(12, 14),
      tipo: getFirstValue(data.descricao_identificador_matriz_filial),
      nome_fantasia: getFirstValue(data.nome_fantasia),
      situacao_cadastral: getFirstValue(
        data.descricao_situacao_cadastral,
        data.situacao
      ),
      data_situacao_cadastral: getFirstValue(data.data_situacao_cadastral),
      data_inicio_atividade: getFirstValue(
        data.data_inicio_atividade,
        data.abertura
      ),
      tipo_logradouro: getFirstValue(data.descricao_tipo_de_logradouro),
      logradouro: getFirstValue(data.logradouro),
      numero: getFirstValue(data.numero),
      complemento: getFirstValue(data.complemento),
      bairro: getFirstValue(data.bairro),
      cep: getFirstValue(data.cep),

      ddd1: phone1.ddd,
      telefone1: phone1.numero,
      ddd2: phone2.ddd,
      telefone2: phone2.numero,

      email: getFirstValue(data.email),

      cidade: {
        id: getFirstValue(data.codigo_municipio),
        nome: getFirstValue(data.municipio),
      },

      estado: {
        sigla: getFirstValue(data.uf),
      },

      pais: {
        nome: "Brasil",
      },

      atividade_principal: {
        id: getFirstValue(data.cnae_fiscal),
        descricao: getFirstValue(data.cnae_fiscal_descricao),
      },

      atividades_secundarias: normalizeMinhaReceitaSecondaryActivities(
        data.cnaes_secundarios
      ),

      inscricoes_estaduais: [],
    },

    raw: data,
  };
}

export function normalizeCnpjWs(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  return {
    ...data,
    fonte: "cnpj_ws",
    raw: data,
  };
}

export function getCompanyCnpj(company) {
  return onlyDigits(
    company?.cnpj ||
      company?.estabelecimento?.cnpj ||
      company?.raw?.cnpj ||
      company?.raw?.estabelecimento?.cnpj ||
      ""
  );
}

export function getCompanyMainName(company) {
  return getFirstValue(
    company?.razao_social,
    company?.razaoSocial,
    company?.nome,
    company?.raw?.razao_social,
    company?.raw?.nome
  );
}

export function getCompanyFantasyName(company) {
  return getFirstValue(
    company?.estabelecimento?.nome_fantasia,
    company?.nome_fantasia,
    company?.raw?.nome_fantasia,
    company?.raw?.estabelecimento?.nome_fantasia
  );
}

export function getCompanyStatus(company) {
  return getFirstValue(
    company?.estabelecimento?.situacao_cadastral,
    company?.situacao,
    company?.raw?.situacao,
    company?.raw?.descricao_situacao_cadastral
  );
}

export function getCompanyCityUf(company) {
  const city = getFirstValue(
    company?.estabelecimento?.cidade?.nome,
    company?.municipio,
    company?.raw?.municipio
  );

  const uf = getFirstValue(
    company?.estabelecimento?.estado?.sigla,
    company?.uf,
    company?.raw?.uf
  );

  return [city, uf].filter(Boolean).join("/");
}

export function buildCompanyAddress(company) {
  const estabelecimento = company?.estabelecimento || {};
  const raw = company?.raw || {};

  return [
    getFirstValue(estabelecimento.tipo_logradouro, raw.descricao_tipo_de_logradouro),
    getFirstValue(estabelecimento.logradouro, raw.logradouro),
    getFirstValue(estabelecimento.numero, raw.numero),
    getFirstValue(estabelecimento.complemento, raw.complemento),
    getFirstValue(estabelecimento.bairro, raw.bairro),
    getFirstValue(estabelecimento.cep, raw.cep),
  ]
    .filter(Boolean)
    .join(", ");
}

export function getMainActivity(company) {
  const activity =
    company?.estabelecimento?.atividade_principal ||
    company?.atividade_principal ||
    {};

  const raw = company?.raw || {};

  const code = getFirstValue(activity.id, activity.codigo, raw.cnae_fiscal);
  const description = getFirstValue(
    activity.descricao,
    raw.cnae_fiscal_descricao
  );

  return [code, description].filter(Boolean).join(" - ");
}

export function getCompanyPartners(company) {
  if (Array.isArray(company?.socios)) {
    return company.socios;
  }

  if (Array.isArray(company?.qsa)) {
    return company.qsa;
  }

  if (Array.isArray(company?.raw?.qsa)) {
    return normalizeMinhaReceitaPartners(company.raw.qsa);
  }

  return [];
}

export function getStateRegistrations(company) {
  if (Array.isArray(company?.estabelecimento?.inscricoes_estaduais)) {
    return company.estabelecimento.inscricoes_estaduais;
  }

  return [];
}