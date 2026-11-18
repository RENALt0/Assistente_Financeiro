import express from 'express';
import pool from '../db.js';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { apriori } from "../ml/apriori.js";
import Groq from "groq-sdk";

dotenv.config();

const router = express.Router();

const apiKey = process.env.GOOGLE_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

let genAI = null;
let groq = null;

// Inicialização do Gemini
if (!apiKey) {
  console.warn("Chave GOOGLE_API_KEY não configurada.");
} else {
  genAI = new GoogleGenerativeAI(apiKey);
  console.log("Google Generative AI inicializado com sucesso.");
}

// Inicialização da Groq
if (!groqApiKey) {
  console.warn("Chave GROQ_API_KEY não configurada.");
} else {
  groq = new Groq({
    apiKey: groqApiKey
  });
  console.log("Groq inicializada com sucesso.");
}

// ENDPOINT: CHAT IA

router.post("/chat", async (req, res) => {
  try {
    const { pergunta } = req.body;

    if (typeof pergunta !== "string" || !pergunta.trim()) {
      return res.status(400).json({
        erro: "Informe uma pergunta válida."
      });
    }

    if (!genAI && !groq) {
      return res.status(503).json({
        erro: "Nenhum serviço de IA está disponível no momento."
      });
    }

    // =========================================
    // IDENTIFICAÇÃO DO PERÍODO NA PERGUNTA
    // =========================================

    const perguntaNormalizada = pergunta
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const meses = {
      janeiro: 1,
      fevereiro: 2,
      marco: 3,
      abril: 4,
      maio: 5,
      junho: 6,
      julho: 7,
      agosto: 8,
      setembro: 9,
      outubro: 10,
      novembro: 11,
      dezembro: 12
    };

    const regexMes = new RegExp(
      "\\b(" + Object.keys(meses).join("|") + ")\\b"
    );

    const mesEncontrado = perguntaNormalizada.match(regexMes);
    const anoEncontrado = perguntaNormalizada.match(/\b(20\d{2})\b/);

    let mes = mesEncontrado
      ? meses[mesEncontrado[1]]
      : null;

    let ano = anoEncontrado
      ? Number(anoEncontrado[1])
      : null;

    let periodo = "Histórico completo de transações";
    let inicio = null;
    let fim = null;

    // =========================================
    // DEFINE O INTERVALO DA CONSULTA
    // =========================================

    if (mes && !ano) {
      // Se o usuário informou apenas o mês,
      // procura o ano mais recente com registros nele.

      const anoResult = await pool.query(
        `SELECT MAX(EXTRACT(YEAR FROM data))::int AS ano
         FROM transacoes
         WHERE EXTRACT(MONTH FROM data) = $1`,
        [mes]
      );

      ano = anoResult.rows[0].ano;

      if (!ano) {
        return res.json({
          resposta: `Não encontrei transações registradas em ${mesEncontrado[1]} no histórico do sistema.`
        });
      }
    }

    if (mes && ano) {
      // Consulta mensal.

      const proximoMes = mes === 12 ? 1 : mes + 1;
      const proximoAno = mes === 12 ? ano + 1 : ano;

      inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      fim = `${proximoAno}-${String(proximoMes).padStart(2, "0")}-01`;

      periodo = `Mês de ${mesEncontrado[1]}/${ano}`;

    } else if (!mes && ano) {
      // Consulta anual, caso o usuário informe somente o ano.

      inicio = `${ano}-01-01`;
      fim = `${ano + 1}-01-01`;

      periodo = `Ano de ${ano}`;
    }

    // =========================================
    // PREPARA O FILTRO SQL
    // =========================================

    const filtroPeriodo = inicio
      ? "AND data >= $1 AND data < $2"
      : "";

    const parametros = inicio ? [inicio, fim] : [];

    // =========================================
    // CONSULTAS AO BANCO DE DADOS
    // =========================================

    const [
      entradasResult,
      saidasResult,
      categoriasResult,
      maiorDespesaResult,
      quantidadeResult
    ] = await Promise.all([

      // Total de entradas.
      pool.query(
        `SELECT COALESCE(SUM(valor), 0) AS total
         FROM transacoes
         WHERE tipo = 'entrada'
         ${filtroPeriodo}`,
        parametros
      ),

      // Total de saídas.
      pool.query(
        `SELECT COALESCE(SUM(valor), 0) AS total
         FROM transacoes
         WHERE tipo = 'saida'
         ${filtroPeriodo}`,
        parametros
      ),

      // Gastos agrupados por categoria.
      pool.query(
        `SELECT
           COALESCE(NULLIF(TRIM(categoria), ''), 'Sem categoria') AS categoria,
           SUM(valor) AS total,
           COUNT(*)::int AS quantidade
         FROM transacoes
         WHERE tipo = 'saida'
         ${filtroPeriodo}
         GROUP BY COALESCE(NULLIF(TRIM(categoria), ''), 'Sem categoria')
         ORDER BY total DESC`,
        parametros
      ),

      // Maior despesa individual.
      pool.query(
        `SELECT
           descricao,
           COALESCE(NULLIF(TRIM(categoria), ''), 'Sem categoria') AS categoria,
           valor,
           data
         FROM transacoes
         WHERE tipo = 'saida'
         ${filtroPeriodo}
         ORDER BY valor DESC, data DESC
         LIMIT 1`,
        parametros
      ),

      // Quantidade de despesas.
      pool.query(
        `SELECT COUNT(*)::int AS quantidade
         FROM transacoes
         WHERE tipo = 'saida'
         ${filtroPeriodo}`,
        parametros
      )
    ]);

    // =========================================
    // ORGANIZA OS RESULTADOS
    // =========================================

    const entradas = Number(entradasResult.rows[0].total);
    const saidas = Number(saidasResult.rows[0].total);

    const saldo = entradas - saidas;

    const percentualGasto = entradas > 0
      ? Number(((saidas / entradas) * 100).toFixed(1))
      : null;

    const categorias = categoriasResult.rows.map((linha) => ({
      categoria: linha.categoria,
      total: Number(linha.total),
      quantidade: Number(linha.quantidade)
    }));

    const maiorDespesaLinha = maiorDespesaResult.rows[0];

    const maiorDespesa = maiorDespesaLinha
      ? {
          descricao: maiorDespesaLinha.descricao,
          categoria: maiorDespesaLinha.categoria,
          valor: Number(maiorDespesaLinha.valor),
          data: maiorDespesaLinha.data
        }
      : null;

    const dadosFinanceiros = {
      periodo,

      entradasTotais: entradas,
      saidasTotais: saidas,
      saldo,

      quantidadeDespesas: quantidadeResult.rows[0].quantidade,

      percentualDasEntradasComprometidoComDespesas: percentualGasto,

      categoriaComMaiorGasto: categorias[0] || null,

      gastosPorCategoria: categorias,

      maiorDespesaIndividual: maiorDespesa
    };

    // =========================================
    // CONTEXTO E REGRAS PARA A IA
    // =========================================

    const contexto = `
Você é um assistente financeiro brasileiro integrado a um sistema de controle financeiro pessoal.

Responda em português brasileiro, de forma clara, amigável e objetiva.

DADOS FINANCEIROS DO SISTEMA:

${JSON.stringify(dadosFinanceiros)}

REGRAS IMPORTANTES:

1. Os valores apresentados correspondem aos registros retornados pelas consultas ao banco de dados.
2. Utilize esses dados quando a pergunta envolver as finanças registradas pelo usuário.
3. Nunca invente valores, saldos, percentuais, despesas ou categorias.
4. Se uma informação não estiver disponível, informe isso claramente.
5. O período consultado é: ${periodo}.
6. Quando o período for mensal ou anual, utilize somente os dados daquele intervalo. Não apresente totais históricos como se fossem daquele período.
7. Quando o período for histórico completo, deixe claro que os valores representam todo o histórico registrado.
8. O saldo é calculado pela diferença entre entradas e saídas do período consultado.
9. O percentual representa a proporção das entradas comprometida com as despesas. Se não houver entradas, esse percentual não pode ser calculado.
10. A categoria com maior gasto é aquela com maior soma acumulada no período.
11. A maior despesa individual é uma única transação, não necessariamente a categoria com maior gasto.
12. Não confunda associação entre categorias com relação de causa e efeito.
13. Ao dar dicas financeiras, diferencie recomendações gerais dos dados reais do usuário.
14. Não invente metas, objetivos ou preferências pessoais.
15. Não apresente exemplos hipotéticos como se fossem dados reais.
16. Se não houver despesas no período, informe isso claramente.
17. Quando o usuário perguntar sobre receitas e despesas de um período,
apresente também o saldo correspondente, mesmo que ele não tenha sido
solicitado explicitamente.

FORMATAÇÃO:

- Utilize Markdown simples.
- Utilize listas quando ajudarem na organização.
- Formate valores monetários em reais (R$).
- Evite respostas excessivamente longas.
`;

    const prompt = `
${contexto}

PERGUNTA DO USUÁRIO:

${pergunta}
`;

    let resposta = "";

    // =========================================
    // PRIMEIRO: GROQ
    // =========================================

    if (groq) {
      try {
        const completion = await groq.chat.completions.create({
          model: "openai/gpt-oss-20b",
          messages: [
            {
              role: "system",
              content: contexto
            },
            {
              role: "user",
              content: pergunta
            }
          ]
        });

        resposta =
          completion.choices[0]?.message?.content?.trim() || "";

        if (resposta) {
          console.log("Resposta gerada pela Groq.");
        }

      } catch (erroGroq) {
        console.error(
          "Groq falhou:",
          erroGroq.status || erroGroq.message
        );
      }
    }

    // =========================================
    // SEGUNDO: GEMINI
    // =========================================

    if (!resposta && genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash"
        });

        const result = await model.generateContent(prompt);

        resposta = result.response.text();

        if (resposta) {
          console.log("Resposta gerada pelo Gemini.");
        }

      } catch (erroGemini) {
        console.error(
          "Gemini falhou:",
          erroGemini.status || erroGemini.message
        );
      }
    }

    // =========================================
    // VERIFICA RESPOSTA
    // =========================================

    if (!resposta) {
      return res.status(503).json({
        erro: "Os serviços de IA estão temporariamente indisponíveis."
      });
    }

    return res.json({ resposta });

  } catch (error) {
    console.error("Erro no chat:", error);

    return res.status(500).json({
      erro: "Não foi possível processar a pergunta."
    });
  }
});


// ENDPOINT: INTERPRETAÇÃO DOS RESULTADOS DO APRIORI

router.post("/analise/apriori/interpretar", async (req, res) => {
  try {
    // =========================================
    // 1. BUSCA AS DESPESAS AGRUPADAS POR MÊS
    // =========================================

    const resultado = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', data), 'YYYY-MM') AS mes,
        ARRAY_AGG(DISTINCT categoria ORDER BY categoria) AS categorias
      FROM transacoes
      WHERE tipo = 'saida'
      GROUP BY DATE_TRUNC('month', data)
      ORDER BY DATE_TRUNC('month', data);
    `);

    if (resultado.rows.length === 0) {
      return res.json({
        mensagem: "Não existem despesas para analisar.",
        interpretacao:
          "Cadastre despesas para que seja possível identificar padrões."
      });
    }

    // =========================================
    // 2. PREPARA AS CESTAS
    // =========================================

    const cestas = resultado.rows.map(
      linha => linha.categorias
    );

    // =========================================
    // 3. CONFIGURA OS PARÂMETROS DO APRIORI
    // =========================================

    const suporteMinimo = 0.4;
    const confiancaMinima = 0.6;

    const totalMeses = cestas.length;

    const ocorrenciasMinimas = Math.ceil(
      suporteMinimo * totalMeses
    );

    // =========================================
    // 4. EXECUTA O ALGORITMO APRIORI
    // =========================================

    const analise = apriori(
      cestas,
      suporteMinimo,
      confiancaMinima
    );

    // =========================================
    // 5. CALCULA A FREQUÊNCIA INDIVIDUAL
    // DAS CATEGORIAS
    // =========================================

    const frequenciaCategorias = analise.categoriasAnalisadas.map(
      categoria => {
        const meses = resultado.rows
          .filter(linha =>
            linha.categorias.includes(categoria)
          )
          .map(linha => linha.mes);

        return {
          categoria,
          ocorrencias: meses.length,
          totalMeses,
          meses
        };
      }
    );

    // =========================================
    // 6. IDENTIFICA OS MESES DAS ASSOCIAÇÕES
    // =========================================

    const regrasDetalhadas = analise.rules.map(regra => {
      const itensCombinados = [
        ...regra.antecedente,
        ...regra.consequente
      ];

      // Meses em que o antecedente apareceu.
      const mesesAntecedente = resultado.rows
        .filter(linha =>
          regra.antecedente.every(item =>
            linha.categorias.includes(item)
          )
        )
        .map(linha => linha.mes);

      // Meses em que o consequente apareceu.
      const mesesConsequente = resultado.rows
        .filter(linha =>
          regra.consequente.every(item =>
            linha.categorias.includes(item)
          )
        )
        .map(linha => linha.mes);

      // Meses em que antecedente e consequente
      // apareceram juntos.
      const mesesConjunto = resultado.rows
        .filter(linha =>
          itensCombinados.every(item =>
            linha.categorias.includes(item)
          )
        )
        .map(linha => linha.mes);

      return {
        ...regra,

        ocorrencias: {
          antecedente: mesesAntecedente.length,
          consequente: mesesConsequente.length,
          conjunto: mesesConjunto.length,
          totalMeses,

          mesesAntecedente,
          mesesConsequente,
          mesesConjunto
        }
      };
    });

    // =========================================
    // 7. ORGANIZA OS DADOS PARA A IA
    // =========================================

    const dadosAnalise = {
      totalMeses,

      parametrosApriori: {
        suporteMinimo,
        confiancaMinima,
        ocorrenciasMinimas
      },

      mesesAnalisados: resultado.rows,

      categoriasAnalisadas: analise.categoriasAnalisadas,

      frequenciaCategorias,

      frequentItemsets: analise.frequentItemsets,

      rules: regrasDetalhadas
    };

    const dadosParaIA = {
      totalMeses,
      parametrosApriori: dadosAnalise.parametrosApriori,
      categoriasAnalisadas: dadosAnalise.categoriasAnalisadas,
      frequenciaCategorias,
      regras: regrasDetalhadas
    };

    // =========================================
    // 8. PREPARA O PROMPT
    // =========================================

    const prompt = `

Você é um assistente especializado em análise financeira
e mineração de dados.

Sua tarefa é interpretar os resultados calculados pelo
algoritmo Apriori, explicando-os de maneira clara e didática.

CONTEXTO DO SISTEMA:

- O sistema registra despesas financeiras.
- As despesas são agrupadas por mês.
- Cada mês representa uma cesta de dados.
- Cada categoria registrada naquele mês representa um item da cesta.
- O Apriori identifica categorias que aparecem juntas nos mesmos meses.
- O algoritmo não analisa compras individuais, produtos comprados juntos
  ou a sequência das despesas.

REGRAS GERAIS:

- Utilize exclusivamente os dados fornecidos.
- Não invente categorias, valores, associações ou ocorrências.
- Não realize novos cálculos das métricas.
- Não confunda associação com causalidade.
- Não diga que o usuário comprou produtos juntos.
- Utilize expressões como "categorias que aparecem no mesmo mês"
  e "coocorrência mensal".
- Responda em português brasileiro.
- Seja claro, didático e objetivo.
- Não apresente hipóteses como conclusões dos dados.
- Não invente motivos para explicar a ocorrência conjunta.
- Não faça afirmações sobre datas de pagamento, dias de consumo
  ou motivos dos gastos.

PARÂMETROS DO ALGORITMO:

- Utilize os valores de dados.parametrosApriori.
- O suporte mínimo e a confiança mínima foram configurados pelo sistema.
- A quantidade mínima de ocorrências também foi calculada pelo sistema.
- Não substitua esses valores por exemplos fixos.
- Não recalcule a quantidade mínima de ocorrências.
- Diferencie combinações que não atingiram o suporte mínimo
  de combinações que nunca ocorreram.

PRECISÃO MATEMÁTICA:

- Os valores numéricos fornecidos pelo sistema são oficiais.
- Nunca recalcule ou estime quantidades de meses.
- Não substitua as quantidades fornecidas por outras frações.
- Para explicar a confiança, utilize:
  ocorrencias.antecedente e ocorrencias.conjunto.
- Para explicar o suporte, utilize:
  ocorrencias.conjunto e ocorrencias.totalMeses.
- Para explicar a frequência individual de uma categoria,
  utilize dados.frequenciaCategorias.
- Não confunda a frequência individual de uma categoria
  com a frequência da combinação entre categorias.
- Não invente informações quando algum campo estiver ausente.
- Utilize os valores de suporte, confiança e lift fornecidos
  diretamente em cada regra.

MESES DE OCORRÊNCIA:

- Os meses foram identificados diretamente pelo sistema.
- Utilize ocorrencias.mesesConjunto para informar quando
  as categorias de uma regra apareceram juntas.
- Nunca deduza, estime ou altere os meses informados.
- Não confunda os meses do antecedente com os meses
  da combinação completa.
- Se uma lista estiver vazia, informe que não houve ocorrência.
- Apresente os meses no formato mês/ano, em português brasileiro.

INTERPRETAÇÃO DAS MÉTRICAS:

- Suporte: proporção de meses em que a combinação de categorias aparece.
- Confiança: proporção dos meses que contêm o antecedente
  em que também aparece o consequente.
- Lift maior que 1: associação positiva em relação
  à frequência individual das categorias.
- Lift igual a 1: ocorrência conjunta compatível com
  o esperado considerando as frequências individuais.
- Lift menor que 1: associação negativa.
- Não classifique uma associação como forte ou estatisticamente
  significativa sem evidências adicionais.

CUIDADOS NA ANÁLISE:

- Suporte igual a 1 significa que a combinação apareceu
  em todos os meses analisados.
- Confiança igual a 1 significa que, em todos os meses
  com o antecedente, o consequente também apareceu.
- Confiança inferior a 1 não permite afirmar que o consequente
  apareceu em todos os meses do antecedente.
- Lift igual a 1 não indica associação positiva.
- Quando houver poucos meses, destaque a limitação da amostra.
- Se houver apenas um mês, não apresente os resultados
  como padrões consistentes.
- Não confunda quantidade de categorias com quantidade de meses.
- Não apresente recomendações comerciais, como promoções cruzadas.

RECOMENDAÇÕES FINANCEIRAS:

- Diferencie observações históricas de previsões futuras.
- Uma associação não comprova causalidade nem garante
  que o padrão continuará acontecendo.
- Não recomende aumentar, reduzir ou reservar valores
  com base apenas na frequência de ocorrência.
- Só faça recomendações envolvendo valores financeiros
  quando os dados apresentarem informações suficientes
  sobre os valores gastos.
- Frequência de ocorrência não significa proporcionalidade
  entre os valores gastos.
- Não invente motivos para explicar as associações.
- Quando os dados forem insuficientes para uma recomendação,
  explique o que pode e o que não pode ser concluído.
- Utilize expressões como "nos meses analisados",
  "na amostra observada" e "os dados indicam".
- Evite afirmações absolutas sobre o futuro.

DADOS CALCULADOS PELO SISTEMA:

${JSON.stringify(dadosParaIA)}

ORGANIZAÇÃO DA RESPOSTA:

1. RESUMO DA ANÁLISE

Informe:
- Quantos meses foram analisados.
- Quais categorias apareceram.
- A frequência individual das categorias, quando relevante.

2. PRINCIPAIS ASSOCIAÇÕES

- Apresente as regras encontradas, se existirem.
- Explique que representam categorias presentes nos mesmos meses.
- Informe os meses de ocorrência conjunta.
- Não confunda a ocorrência individual com a ocorrência conjunta.

3. INTERPRETAÇÃO DAS MÉTRICAS

Explique suporte, confiança e lift utilizando os valores fornecidos.

4. LIMITAÇÕES DOS DADOS

Destaque:
- A quantidade de meses analisados.
- A variedade das categorias.
- O efeito do suporte mínimo configurado.
- As limitações de interpretar padrões com amostras pequenas.

5. CONCLUSÃO PRÁTICA

Apresente uma conclusão útil para o controle financeiro pessoal.
Limite-se ao que pode ser observado nos dados.
Não transforme associações em previsões de gastos
nem produza recomendações sem evidências suficientes.

`;

    // =========================================
    // 9. TENTA GERAR A INTERPRETAÇÃO PELA GROQ
    // =========================================

    let interpretacao = "";
    let iaDisponivel = false;

    if (groq) {
      try {
        const completion = await groq.chat.completions.create({
          model: "openai/gpt-oss-20b",

          messages: [
            {
              role: "system",
              content:
                "Você interpreta análises financeiras e resultados Apriori. " +
                "Siga rigorosamente as instruções e os dados fornecidos."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        });

        interpretacao =
          completion.choices[0]?.message?.content?.trim() || "";

        if (interpretacao) {
          iaDisponivel = true;
          console.log("Interpretação do Apriori gerada pela Groq.");
        }

      } catch (erroGroq) {
        console.error("Groq falhou na interpretação do Apriori:", {
          status: erroGroq.status,
          message: erroGroq.message,
          details: erroGroq.error?.message
        });
      }
    }

    // =========================================
    // 10. GEMINI COMO ALTERNATIVA
    // =========================================

    if (!interpretacao && genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash"
        });

        const result = await model.generateContent(prompt);

        interpretacao = result.response.text().trim();

        if (interpretacao) {
          iaDisponivel = true;
          console.log("Interpretação do Apriori gerada pelo Gemini.");
        }

      } catch (erroGemini) {
        console.error("Gemini falhou na interpretação do Apriori:", {
          status: erroGemini.status,
          message: erroGemini.message,
          details: erroGemini.error?.message
        });
      }
    }

    // =========================================
    // 11. RESPOSTA ALTERNATIVA
    // =========================================

    if (!interpretacao) {
      interpretacao =
        "A análise matemática do Apriori foi realizada com sucesso, " +
        "mas os serviços de IA generativa estão temporariamente indisponíveis. " +
        "Os resultados calculados continuam disponíveis.";
    }

    // =========================================
    // 12. RETORNA OS RESULTADOS
    // =========================================

    return res.json({
      totalMeses: analise.totalCestas,
      analise: dadosAnalise,
      iaDisponivel,
      interpretacao
    });

  } catch (error) {
    console.error("Erro na interpretação do Apriori:", error);

    return res.status(500).json({
      erro: "Não foi possível interpretar os resultados do Apriori."
    });
  }
});

// ENDPOINT: MODELS
router.get('/models', async (req, res) => {

  if (!apiKey) {
    return res.status(400).json({
      erro: 'A chave de API GOOGLE_API_KEY não está configurada.'
    });
  }

  try {

    const baseUrl =
      'https://generativelanguage.googleapis.com';

    const url =
      `${baseUrl}/v1/models`;

    const fetchRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      }
    });

    const json = await fetchRes.json();

    return res.json(json);

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      erro: 'Não foi possível listar modelos'
    });
  }
});



export default router;