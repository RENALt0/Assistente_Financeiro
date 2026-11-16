
// FUNÇÃO AUXILIAR: VALIDAR DADOS DE TRANSAÇÃO
// Evita repetir validações no POST e PUT

export function validarTransacao(descricao, valor, tipo) {

  // Verifica se a descrição é um texto válido
  if (
    typeof descricao !== "string" ||
    descricao.trim() === ""
  ) {
    return "Descrição é obrigatória e deve ser um texto";
  }

  // Verifica se o valor foi informado
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return "Valor é obrigatório";
  }

  // Converte o valor para número
  const valorNumerico = Number(valor);

  // Verifica se é um número válido e finito
  if (!Number.isFinite(valorNumerico)) {
    return "Valor inválido";
  }

  // Exige valor maior que zero
  if (valorNumerico <= 0) {
    return "Valor deve ser maior que zero";
  }

  // Verifica o tipo da transação
  if (
    typeof tipo !== "string" ||
    !["entrada", "saida"].includes(tipo)
  ) {
    return "Tipo deve ser 'entrada' ou 'saida'";
  }

  return null;
}
