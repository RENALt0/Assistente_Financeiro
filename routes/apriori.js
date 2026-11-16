
import express from "express";
import pool from "../db.js";
import { apriori } from "../ml/apriori.js";

const router = express.Router();

router.get("/apriori", async (req, res) => {
  try {
    // 1. Busca as despesas agrupadas por mês e ano.
    const resultado = await pool.query(`
      SELECT
        DATE_TRUNC('month', data) AS mes,
        ARRAY_AGG(DISTINCT categoria ORDER BY categoria) AS categorias
      FROM transacoes
      WHERE tipo = 'saida'
      GROUP BY DATE_TRUNC('month', data)
      ORDER BY mes;
    `);

    // 2. Verifica se existem dados suficientes.
    if (resultado.rows.length === 0) {
      return res.json({
        mensagem: "Ainda não existem despesas para analisar.",
        totalMeses: 0,
        mesesAnalisados: [],
        frequentItemsets: [],
        rules: [],
      });
    }

    // 3. Organiza os meses e suas categorias.
    const mesesAnalisados = resultado.rows.map((linha) => ({
      mes: linha.mes,
      categorias: linha.categorias,
    }));

    // 4. Extrai apenas as categorias para o Apriori.
    const cestas = mesesAnalisados.map(
      (item) => item.categorias
    );

    // 5. Executa o algoritmo.
    const resultadoApriori = apriori(cestas, 0.4, 0.6);

    // 6. Retorna os resultados.
    res.json({
      totalMeses: resultadoApriori.totalCestas,
      mesesAnalisados,
      categoriasAnalisadas: resultadoApriori.categoriasAnalisadas,
      frequentItemsets: resultadoApriori.frequentItemsets,
      rules: resultadoApriori.rules,
    });

  } catch (error) {
    console.error("Erro na análise Apriori:", error);

    res.status(500).json({
      erro: "Erro ao realizar análise de associações.",
    });
  }
});

export default router;
