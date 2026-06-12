export const STORAGE_KEYS = {
  empresas: "consulta-cnpj:empresas",
};

export function readLocalStorage(key, fallbackValue = null) {
  try {
    const storedValue = window.localStorage.getItem(key);

    if (!storedValue) {
      return fallbackValue;
    }

    return JSON.parse(storedValue);
  } catch (error) {
    console.error("Erro ao ler localStorage:", error);
    return fallbackValue;
  }
}

export function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Erro ao gravar localStorage:", error);
    return false;
  }
}

export function removeLocalStorage(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("Erro ao remover localStorage:", error);
    return false;
  }
}

export function readCompanyHistory() {
  return readLocalStorage(STORAGE_KEYS.empresas, []);
}

export function saveCompanyHistory(companies) {
  return writeLocalStorage(STORAGE_KEYS.empresas, companies);
}

export function clearCompanyHistory() {
  return removeLocalStorage(STORAGE_KEYS.empresas);
}

export function upsertCompanyInHistory(company) {
  const currentHistory = readCompanyHistory();

  const cnpj =
    company?.cnpj ||
    company?.estabelecimento?.cnpj ||
    company?.raw?.estabelecimento?.cnpj ||
    "";

  if (!cnpj) {
    return currentHistory;
  }

  const normalizedCnpj = String(cnpj).replace(/\D/g, "");

  const companyToSave = {
    ...company,
    cnpj: normalizedCnpj,
    consultedAt: company?.consultedAt || new Date().toISOString(),
  };

  const withoutDuplicated = currentHistory.filter((item) => {
    const itemCnpj =
      item?.cnpj ||
      item?.estabelecimento?.cnpj ||
      item?.raw?.estabelecimento?.cnpj ||
      "";

    return String(itemCnpj).replace(/\D/g, "") !== normalizedCnpj;
  });

  const updatedHistory = [companyToSave, ...withoutDuplicated];

  saveCompanyHistory(updatedHistory);

  return updatedHistory;
}