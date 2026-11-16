
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { apriori } from "./apriori.js";

dotenv.config();

// Verifica se a chave da Groq está disponível.
if (!process.env.GROQ_API_KEY) {
  console.error("Erro: GROQ_API_KEY não encontrada no arquivo .env.");
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Dados fictícios: cada mês representa uma cesta.
const meses = [
  { mes: "2026-10", categorias: ["Alimentos", "Eletrônicos"] },
  { mes: "2026-11", categorias: ["Alimentos", "Transporte"] },
  { mes: "2026-12", categorias: ["Alimentos", "Eletrônicos"] },
  { mes: "2027-01", categorias: ["Transporte", "Lazer"] },
  { mes: "2027-02", categorias: ["Alimentos", "Eletrônicos"] }
];

// Executa o Apriori.
const cestas = meses.map(item => item.categorias);
const resultado = apriori(cestas, 0.4, 0.6);

// Organiza os resultados.
const dadosAnalise = {
  totalMeses: resultado.totalCestas,
  mesesAnalisados: meses,
  categoriasAnalisadas: resultado.categoriasAnalisadas,
  frequentItemsets: resultado.frequentItemsets,
  rules: resultado.rules
};

// Instruções para a IA.
const prompt = `
Você é um assistente especializado em educação financeira
e análise de dados.

Interprete os resultados do algoritmo Apriori apresentados abaixo.

CONTEXTO:
- Cada mês representa uma cesta de dados.
- Cada categoria representa uma categoria de despesa registrada naquele mês.
- O algoritmo identifica categorias que aparecem juntas nos mesmos meses.
- A análise não identifica compras individuais, produtos comprados juntos
  ou sequência de despesas.

SIGNIFICADO DAS MÉTRICAS:
- Suporte: proporção de meses em que uma combinação aparece.
- Confiança: proporção de meses com o antecedente em que também aparece
  o consequente.
- Lift maior que 1: associação positiva.
- Lift igual a 1: ausência de associação acima da frequência individual.
- Lift menor que 1: associação negativa.

REGRAS:
- Utilize exclusivamente os dados fornecidos.
- Não invente informações ou tendências.
- Não confunda associação com causalidade.
- Não afirme que as categorias representam compras realizadas juntas.
- Considere que a amostra contém apenas ${dadosAnalise.totalMeses} meses.
- Explique as limitações de uma amostra pequena.
- Não apresente associações como certezas sobre o comportamento futuro.

ORGANIZE A RESPOSTA EM CINCO SEÇÕES:

1. Resumo da análise.
2. Associações encontradas.
3. Explicação das métricas.
4. Limitações da análise.
5. Conclusão prática.

RESULTADOS DO APRIORI:
${JSON.stringify(dadosAnalise, null, 2)}
`;

async function testarInterpretacao() {
  try {
    console.log("\n========== RESULTADOS DO APRIORI ==========\n");
    console.log(JSON.stringify(dadosAnalise, null, 2));

    console.log("\n========== INTERPRETAÇÃO DA GROQ ==========\n");
    console.log("Consultando a IA...\n");

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const interpretacao =
      completion.choices[0]?.message?.content?.trim();

    if (!interpretacao) {
      throw new Error("A Groq não retornou uma interpretação.");
    }

    console.log(interpretacao);
    console.log("\n========== FIM DO TESTE ==========\n");

  } catch (erro) {
    console.error("Erro ao testar a interpretação:", erro.message);
  }
}

testarInterpretacao();
