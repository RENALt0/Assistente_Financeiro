
import { apriori } from "./apriori.js";

const cenarios = [
  {
    nome: "Cenário A — Associação frequente",
    transacoes: [
      ["Alimentação", "Transporte"],
      ["Alimentação", "Transporte"],
      ["Alimentação", "Transporte"],
      ["Alimentação", "Transporte", "Lazer"],
      ["Alimentação"],
    ],
    suporteMinimo: 0.4,
    confiancaMinima: 0.6,
  },
  {
    nome: "Cenário B — Categorias sem associação forte",
    transacoes: [
      ["Alimentação", "Lazer"],
      ["Transporte", "Saúde"],
      ["Alimentação", "Saúde"],
      ["Transporte", "Lazer"],
      ["Alimentação", "Transporte"],
    ],
    suporteMinimo: 0.4,
    confiancaMinima: 0.6,
  },
  {
    nome: "Cenário C — Nenhuma combinação frequente",
    transacoes: [
      ["Alimentação"],
      ["Transporte"],
      ["Lazer"],
      ["Saúde"],
    ],
    suporteMinimo: 0.5,
    confiancaMinima: 0.6,
  },
];

for (const cenario of cenarios) {
  console.log(`\n========== ${cenario.nome} ==========`);

  const resultado = apriori(
    cenario.transacoes,
    cenario.suporteMinimo,
    cenario.confiancaMinima
  );

  console.log("Conjuntos frequentes:");

  console.table(
    resultado.frequentItemsets.map((item) => ({
      categorias: item.items.join(" + "),
      ocorrencias: item.count,
      suporte: `${(item.support * 100).toFixed(0)}%`,
    }))
  );

  console.log("Regras de associação:");

  console.table(
    resultado.rules.map((regra) => ({
      se: regra.antecedente.join(" + "),
      entao: regra.consequente.join(" + "),
      suporte: `${(regra.support * 100).toFixed(0)}%`,
      confianca: `${(regra.confidence * 100).toFixed(0)}%`,
      lift: regra.lift.toFixed(2),
    }))
  );
}
