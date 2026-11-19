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

${JSON.stringify(dadosFinanceiros, null, 2)}

REGRAS IMPORTANTES:

1. Os valores apresentados são resultados reais das consultas ao banco de dados.
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
        console.error("\n===== ERRO COMPLETO GROQ - APRIORI =====");
        console.error("Status:", erroGroq.status);
        console.error("Mensagem:", erroGroq.message);
        console.error("Resposta:", erroGroq.error);
        console.error("Detalhes:", erroGroq.response?.data);
        console.error("Nome:", erroGroq.name);
        console.error("========================================\n");
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
      totalMeses: dadosAnalise.totalMeses,
      parametrosApriori: dadosAnalise.parametrosApriori,
      mesesAnalisados: dadosAnalise.mesesAnalisados.map(({ mes }) => mes),
      categoriasAnalisadas: dadosAnalise.categoriasAnalisadas,
      frequenciaCategorias: dadosAnalise.frequenciaCategorias,
      frequentItemsets: dadosAnalise.frequentItemsets.map(
        ({ items, count, support }) => ({ items, count, support })
      ),
      rules: dadosAnalise.rules.map(
        ({
          antecedente,
          consequente,
          support,
          confidence,
          lift,
          ocorrencias
        }) => ({
          antecedente,
          consequente,
          support,
          confidence,
          lift,
          ocorrencias: {
            antecedente: ocorrencias.antecedente,
            consequente: ocorrencias.consequente,
            conjunto: ocorrencias.conjunto,
            totalMeses: ocorrencias.totalMeses
          }
        })
      )
    };

    // =========================================
    // 8. PREPARA O PROMPT
    // =========================================

    const prompt = `
Você é um assistente especializado em análise financeira e mineração de dados.
Interprete os resultados do Apriori de forma clara, didática e contextualizada,
em português brasileiro.

CONTEXTO

- As despesas são agrupadas por mês; cada mês é uma cesta de categorias.
- Uma associação indica categorias que aparecem nos mesmos meses.
- O Apriori não identifica compras individuais nem sequência de despesas.
- Utilize exclusivamente os dados fornecidos. Não invente categorias,
  valores, métricas, ocorrências, motivos ou tendências.
- Ao explicar os resultados, não altere nem omita dados relevantes das
  associações selecionadas. Não recalcule métricas ou contagens fornecidas.
- Associação não comprova causalidade nem garante padrões futuros.

ESTRUTURA DOS DADOS

- Utilize dadosParaIA.totalMeses, dadosParaIA.parametrosApriori,
  dadosParaIA.categoriasAnalisadas, dadosParaIA.frequenciaCategorias,
  dadosParaIA.frequentItemsets e dadosParaIA.rules.
- parametrosApriori contém suporteMinimo, confiancaMinima
  e ocorrenciasMinimas. Use os valores fornecidos; não os substitua
  por exemplos nem recalcule ocorrenciasMinimas.
- frequenciaCategorias descreve cada categoria individualmente
  por categoria, ocorrencias, totalMeses e meses.
- frequentItemsets contém items, count e support.
- Cada regra contém antecedente, consequente, support, confidence,
  lift e ocorrencias.
- Informe somente conjuntos frequentes e regras presentes nos dados.
  Combinações ausentes não estão detalhadas; não afirme se nunca ocorreram
  ou se apenas não atingiram os critérios configurados.

CONTAGENS DAS REGRAS

- ocorrencias.antecedente conta os meses que contêm todos os itens
  do antecedente.
- ocorrencias.consequente conta os meses que contêm todos os itens
  do consequente, independentemente do antecedente.
- ocorrencias.conjunto conta os meses em que antecedente e consequente
  aparecem juntos.
- ocorrencias.totalMeses é o total de meses analisados.
- Use essas contagens para contextualizar as associações selecionadas,
  sem recalcular suporte, confiança ou lift.
- Não confunda a ocorrência do consequente isoladamente com sua ocorrência
  junto ao antecedente.

DATAS

- O payload não contém listas de meses de ocorrência para cada regra.
- Não identifique nem deduza os meses em que uma regra ocorreu em conjunto.
- mesesAnalisados lista o período analisado; frequenciaCategorias.meses
  registra meses de categorias individuais. Não use essas datas para inferir
  meses de coocorrência de regras.

INTERPRETAÇÃO DAS MÉTRICAS

- Suporte: proporção dos meses analisados em que o conjunto da regra aparece.
  Use o support fornecido; ocorrencias.conjunto e ocorrencias.totalMeses
  contextualizam a contagem correspondente.
- Confiança: proporção dos meses com o antecedente em que também aparece
  o consequente. Use o confidence fornecido; ocorrencias.antecedente
  e ocorrencias.conjunto contextualizam as contagens.
- Lift: use o valor fornecido. Ele mede uma associação estatística em relação
  às frequências individuais, não uma relação de causa e efeito. Maior que 1
  indica associação positiva; igual a 1 indica ocorrência conjunta compatível
  com o esperado pelas frequências individuais; menor que 1 indica associação
  negativa.
- Lift igual a 1 não representa associação positiva.
- Não classifique uma associação como forte ou estatisticamente significativa
  sem evidências adicionais.
- Não confunda a frequência individual em frequenciaCategorias com
  a ocorrência conjunta da regra.

LIMITAÇÕES E CONCLUSÕES FINANCEIRAS

- Destaque limitações de amostras pequenas; se houver apenas um mês,
  não apresente os resultados como padrões consistentes.
- Diferencie observações históricas de previsões. Não afirme que os padrões
  continuarão acontecendo.
- Os dados do Apriori não incluem valores gastos. Não invente montantes
  nem recomende aumentar, reduzir ou reservar valores com base somente
  nas frequências.
- Não invente causas ou motivos para as associações.
- Apresente uma conclusão útil para o controle financeiro pessoal,
  limitada ao que os resultados permitem observar.

DADOS CALCULADOS PELO SISTEMA:

${JSON.stringify(dadosParaIA)}

ORGANIZE A RESPOSTA EM CINCO SEÇÕES:

1. RESUMO: total de meses, categorias analisadas e frequências individuais
   relevantes.
2. PRINCIPAIS ASSOCIAÇÕES: selecione e explique em texto conciso apenas as
   associações mais relevantes presentes nos dados, destacando os padrões.
   Não reproduza a tabela completa nem liste todas as regras. Para as
   associações selecionadas, use fielmente as métricas e contagens relevantes,
   sem citar meses específicos de ocorrência.
3. MÉTRICAS: interpretação de suporte, confiança e lift com os valores
   fornecidos.
4. LIMITAÇÕES: tamanho da amostra, variedade das categorias e efeito
   dos parâmetros configurados.
5. CONCLUSÃO PRÁTICA: observações úteis, sem causalidade, previsões
   ou recomendações não sustentadas pelos dados.
`;

    // =========================================
    // 9. TENTA GERAR A INTERPRETAÇÃO PELA GROQ
    // =========================================

    let interpretacao = "";
    let iaDisponivel = false;
    let respostaInterrompidaPorLimite = false;

    if (groq) {
      try {
        const completion = await groq.chat.completions.create({
          model: "openai/gpt-oss-20b",
          max_completion_tokens: 65536,

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

        const escolha = completion.choices?.[0];

        if (escolha?.finish_reason === "length") {
          respostaInterrompidaPorLimite = true;
          console.warn(
            "Resposta da Groq interrompida pelo limite de tokens. Tokens gerados:",
            completion.usage?.completion_tokens
          );
        } else if (escolha?.finish_reason === "stop") {
          interpretacao = escolha.message?.content?.trim() || "";

          if (interpretacao) {
            iaDisponivel = true;
            console.log(
              "Interpretação do Apriori gerada pela Groq. finish_reason:",
              escolha.finish_reason,
              "Tokens gerados:",
              completion.usage?.completion_tokens
            );
          }
        } else {
          console.warn(
            "Groq não confirmou o encerramento natural da interpretação. finish_reason:",
            escolha?.finish_reason
          );
        }

      } catch (erroGroq) {
        console.error(
          "Groq falhou na interpretação do Apriori:",
          erroGroq.status || erroGroq.message
        );
      }
    }

    // =========================================
    // 10. GEMINI COMO ALTERNATIVA
    // =========================================

    if (!interpretacao && genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: {
            maxOutputTokens: 65536
          }
        });

        const result = await model.generateContent(prompt);
        const finishReason =
          result.response.candidates?.[0]?.finishReason;

        if (finishReason === "MAX_TOKENS") {
          respostaInterrompidaPorLimite = true;
          console.warn(
            "Resposta do Gemini interrompida pelo limite de tokens."
          );
        } else if (finishReason === "STOP") {
          interpretacao = result.response.text().trim();

          if (interpretacao) {
            iaDisponivel = true;
            console.log("Interpretação do Apriori gerada pelo Gemini.");
          }
        } else {
          console.warn(
            "Gemini não confirmou o encerramento natural da interpretação. finishReason:",
            finishReason
          );
        }

      } catch (erroGemini) {
        console.error(
          "Gemini falhou na interpretação do Apriori:",
          erroGemini.status || erroGemini.message
        );
      }
    }

    // =========================================
    // 11. RESPOSTA ALTERNATIVA
    // =========================================

    if (!interpretacao) {
      interpretacao = respostaInterrompidaPorLimite
        ? "A análise matemática do Apriori foi realizada com sucesso, " +
          "mas a interpretação da IA foi interrompida pelo limite de tokens. " +
          "O conteúdo parcial foi descartado; os resultados calculados continuam disponíveis."
        : "A análise matemática do Apriori foi realizada com sucesso, " +
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