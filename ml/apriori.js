
/**
 * Algoritmo Apriori para encontrar combinações frequentes
 * de categorias de despesas e gerar regras de associação.
 */

// Transforma uma combinação em uma chave consistente.
function criarChave(itens) {
  return [...itens].sort().join("|||");
}

// Verifica se uma combinação está contida em uma cesta.
function contemTodos(cesta, itens) {
  return itens.every((item) => cesta.has(item));
}

// Gera todas as combinações de tamanho k.
function gerarCandidatos(itemsets, k) {
  const candidatos = new Map();

  for (let i = 0; i < itemsets.length; i++) {
    for (let j = i + 1; j < itemsets.length; j++) {
      const uniao = [
        ...new Set([...itemsets[i].items, ...itemsets[j].items]),
      ].sort();

      if (uniao.length !== k) continue;

      // O Apriori exige que todos os subconjuntos
      // de tamanho k - 1 também sejam frequentes.
      const subconjuntosFrequentes = uniao.every((_, indice) => {
        const subconjunto = uniao.filter((_, i) => i !== indice);
        return itemsets.some(
          (itemset) =>
            criarChave(itemset.items) === criarChave(subconjunto)
        );
      });

      if (subconjuntosFrequentes) {
        candidatos.set(criarChave(uniao), uniao);
      }
    }
  }

  return [...candidatos.values()];
}

// Calcula quantas cestas contêm cada combinação.
function calcularSuporte(cestas, candidatos) {
  return candidatos.map((itens) => {
    const quantidade = cestas.filter((cesta) =>
      contemTodos(cesta, itens)
    ).length;

    return {
      items: itens,
      count: quantidade,
      support: quantidade / cestas.length,
    };
  });
}

// Gera todos os subconjuntos não vazios de uma combinação.
function gerarSubconjuntos(itens) {
  let resultado = [[]];

  for (const item of itens) {
    const novos = resultado.map((grupo) => [...grupo, item]);
    resultado = [...resultado, ...novos];
  }

  return resultado.filter(
    (grupo) => grupo.length > 0 && grupo.length < itens.length
  );
}

export function apriori(
  transacoes,
  minSupport = 0.4,
  minConfidence = 0.6
) {
  if (!Array.isArray(transacoes) || transacoes.length === 0) {
    throw new Error("Informe pelo menos uma cesta de categorias.");
  }

  if (
    minSupport <= 0 ||
    minSupport > 1 ||
    minConfidence < 0 ||
    minConfidence > 1
  ) {
    throw new Error("Os limites de suporte e confiança são inválidos.");
  }

  // Cada cesta deve ser uma lista de categorias.
  const cestas = transacoes.map((cesta) => {
    if (!Array.isArray(cesta)) {
      throw new Error("Cada cesta precisa ser uma lista de categorias.");
    }

    return new Set(
      cesta
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
    );
  });

  const categorias = [
    ...new Set(cestas.flatMap((cesta) => [...cesta])),
  ].sort();

  const frequentes = [];
  let atuais = calcularSuporte(
    cestas,
    categorias.map((categoria) => [categoria])
  ).filter((itemset) => itemset.support >= minSupport);

  frequentes.push(...atuais);

  // Encontra combinações cada vez maiores.
  let tamanho = 2;

  while (atuais.length > 0) {
    const candidatos = gerarCandidatos(atuais, tamanho);

    if (candidatos.length === 0) break;

    atuais = calcularSuporte(cestas, candidatos).filter(
      (itemset) => itemset.support >= minSupport
    );

    frequentes.push(...atuais);
    tamanho++;
  }

  // Mapa de suporte para consultar os valores das regras.
  const suportePorChave = new Map(
    frequentes.map((itemset) => [
      criarChave(itemset.items),
      itemset.support,
    ])
  );

  const regras = [];

  for (const itemset of frequentes.filter(
    (item) => item.items.length >= 2
  )) {
    for (const antecedente of gerarSubconjuntos(itemset.items)) {
      const consequente = itemset.items.filter(
        (item) => !antecedente.includes(item)
      );

      const suporteAntecedente = suportePorChave.get(
        criarChave(antecedente)
      );
      const suporteConsequente = suportePorChave.get(
        criarChave(consequente)
      );

      if (!suporteAntecedente || !suporteConsequente) continue;

      const confianca = itemset.support / suporteAntecedente;
      const lift = confianca / suporteConsequente;

      if (confianca >= minConfidence) {
        regras.push({
          antecedente,
          consequente,
          support: itemset.support,
          confidence: confianca,
          lift,
        });
      }
    }
  }

  return {
    totalCestas: cestas.length,
    categoriasAnalisadas: categorias,
    frequentItemsets: frequentes.sort(
      (a, b) =>
        b.items.length - a.items.length ||
        b.support - a.support
    ),
    rules: regras.sort(
      (a, b) => b.lift - a.lift
    ),
  };
}
