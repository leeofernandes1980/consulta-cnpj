export function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function maskCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function unmaskCnpj(value) {
  return onlyDigits(value).slice(0, 14);
}

export function isValidCnpj(value) {
  const cnpj = onlyDigits(value);

  if (cnpj.length !== 14) return false;

  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calculateDigit = (base) => {
    let weight = base.length - 7;
    let sum = 0;

    for (let index = 0; index < base.length; index += 1) {
      sum += Number(base[index]) * weight;
      weight -= 1;

      if (weight < 2) {
        weight = 9;
      }
    }

    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(cnpj.slice(0, 12));
  const secondDigit = calculateDigit(cnpj.slice(0, 12) + firstDigit);

  return cnpj === cnpj.slice(0, 12) + String(firstDigit) + String(secondDigit);
}

export function formatCpfCnpj(value) {
  const digits = onlyDigits(value);

  if (digits.length === 14) {
    return maskCnpj(digits);
  }

  if (digits.length === 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return value || "";
}