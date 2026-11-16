
import { apriori } from "./apriori.js";

// Dados fictícios: cada mês representa uma cesta.
const meses = [
  {
    mes: "2026-10",
    categorias: ["Alimentos", "Eletrônicos"]
  },
  {
    mes: "2026-11",
    categorias: ["Alimentos", "Transporte"]
  },
  {
    mes: "2026-12",
    categorias: ["Alimentos", "Eletrônicos"]
  },
  {
    mes: "2027-01",
    categorias: ["Transporte", "Lazer"]
  },
  {
    mes: "2027-02",
    categorias: ["Alimentos", "Eletrônicos"]
  }
];

// Extrai somente as categorias para o Apriori.
const cestas = meses.map((item) => item.categorias);

// Executa o algoritmo com os mesmos parâmetros da API.
const resultado = apriori(cestas, 0.4, 0.6);

// Organiza a saída.
const dadosAnalise = {
  totalMeses: resultado.totalCestas,
  mesesAnalisados: meses,
  categoriasAnalisadas: resultado.categoriasAnalisadas,
  frequentItemsets: resultado.frequentItemsets,
  rules: resultado.rules
};

console.log("\n========== TESTE DO APRIORI ==========\n");

console.log(JSON.stringify(dadosAnalise, null, 2));

console.log("\n========== FIM DO TESTE ==========\n");
