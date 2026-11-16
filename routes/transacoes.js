
import express from 'express';
import pool from '../db.js';
import { validarTransacao } from '../utils/validacoes.js';

const router = express.Router();

// Valida se o ID é um inteiro positivo.
function validarId(id) {
  return /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
}

// Valida se uma data está no formato YYYY-MM-DD
// e representa uma data real.
function validarData(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return false;
  }

  const [ano, mes, dia] = data.split('-').map(Number);

  const dataObj = new Date(Date.UTC(ano, mes - 1, dia));

  return (
    dataObj.getUTCFullYear() === ano &&
    dataObj.getUTCMonth() === mes - 1 &&
    dataObj.getUTCDate() === dia
  );
}

// Valida campos de texto opcionais.
function validarTextoOpcional(valor) {
  return valor === undefined || valor === null || typeof valor === 'string';
}

// GET /transacoes
router.get('/transacoes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transacoes ORDER BY data DESC'
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar transações:', error);

    res.status(500).json({
      erro: 'Erro ao buscar transações'
    });
  }
});

// POST /transacoes
router.post('/transacoes', async (req, res) => {
  const {
    descricao,
    valor,
    tipo,
    categoria,
    metodo_pagamento,
    observacao
  } = req.body;

  try {
    const erroValidacao = validarTransacao(descricao, valor, tipo);

    if (erroValidacao) {
      return res.status(400).json({ erro: erroValidacao });
    }

    if (typeof categoria !== 'string' || categoria.trim() === '') {
      return res.status(400).json({
        erro: 'Categoria é obrigatória e deve ser um texto válido'
      });
    }

    if (
      !validarTextoOpcional(metodo_pagamento) ||
      !validarTextoOpcional(observacao)
    ) {
      return res.status(400).json({
        erro: 'Método de pagamento e observação devem ser textos'
      });
    }

    const valorNumerico = Number(valor);

    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return res.status(400).json({
        erro: 'O valor deve ser um número positivo válido'
      });
    }

    const result = await pool.query(
      `INSERT INTO transacoes (
        descricao,
        valor,
        tipo,
        categoria,
        metodo_pagamento,
        observacao
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        descricao.trim(),
        valorNumerico,
        tipo,
        categoria.trim(),
        metodo_pagamento ?? null,
        observacao ?? null
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Erro ao salvar transação:', error);

    res.status(500).json({
      erro: 'Erro ao salvar transação'
    });
  }
});

// DELETE /transacoes/:id
router.delete('/transacoes/:id', async (req, res) => {
  const { id } = req.params;

  if (!validarId(id)) {
    return res.status(400).json({
      erro: 'ID inválido. Informe um número inteiro positivo.'
    });
  }

  try {
    const result = await pool.query(
      'DELETE FROM transacoes WHERE id = $1 RETURNING *',
      [Number(id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        erro: 'Transação não encontrada'
      });
    }

    res.json({
      mensagem: 'Transação deletada com sucesso',
      transacao: result.rows[0]
    });

  } catch (error) {
    console.error('Erro ao deletar transação:', error);

    res.status(500).json({
      erro: 'Erro ao deletar transação'
    });
  }
});

// PUT /transacoes/:id
router.put('/transacoes/:id', async (req, res) => {
  const { id } = req.params;

  if (!validarId(id)) {
    return res.status(400).json({
      erro: 'ID inválido. Informe um número inteiro positivo.'
    });
  }

  const {
    descricao,
    valor,
    tipo,
    categoria,
    metodo_pagamento,
    observacao
  } = req.body;

  try {
    const erroValidacao = validarTransacao(descricao, valor, tipo);

    if (erroValidacao) {
      return res.status(400).json({ erro: erroValidacao });
    }

    if (typeof categoria !== 'string' || categoria.trim() === '') {
      return res.status(400).json({
        erro: 'Categoria é obrigatória e deve ser um texto válido'
      });
    }

    if (
      !validarTextoOpcional(metodo_pagamento) ||
      !validarTextoOpcional(observacao)
    ) {
      return res.status(400).json({
        erro: 'Método de pagamento e observação devem ser textos'
      });
    }

    const valorNumerico = Number(valor);

    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return res.status(400).json({
        erro: 'O valor deve ser um número positivo válido'
      });
    }

    const result = await pool.query(
      `UPDATE transacoes
       SET descricao = $1,
           valor = $2,
           tipo = $3,
           categoria = $4,
           metodo_pagamento = $5,
           observacao = $6
       WHERE id = $7
       RETURNING *`,
      [
        descricao.trim(),
        valorNumerico,
        tipo,
        categoria.trim(),
        metodo_pagamento ?? null,
        observacao ?? null,
        Number(id)
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        erro: 'Transação não encontrada'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Erro ao atualizar transação:', error);

    res.status(500).json({
      erro: 'Erro ao atualizar transação'
    });
  }
});

// GET /transacoes/periodo
router.get('/transacoes/periodo', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;

    if (!validarData(dataInicio) || !validarData(dataFim)) {
      return res.status(400).json({
        erro: 'Informe datas válidas no formato YYYY-MM-DD'
      });
    }

    if (dataInicio > dataFim) {
      return res.status(400).json({
        erro: 'A data inicial não pode ser posterior à data final'
      });
    }

    const resultado = await pool.query(
      `SELECT * FROM transacoes
       WHERE data >= $1::date
       AND data < ($2::date + INTERVAL '1 day')
       ORDER BY data DESC`,
      [dataInicio, dataFim]
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error('Erro ao buscar transações por período:', error);

    res.status(500).json({
      erro: 'Erro ao buscar transações por período'
    });
  }
});

// GET /transacoes/categoria
router.get('/transacoes/categoria', async (req, res) => {
  try {
    const { categoria } = req.query;

    if (typeof categoria !== 'string' || categoria.trim() === '') {
      return res.status(400).json({
        erro: 'Categoria é obrigatória'
      });
    }

    const resultado = await pool.query(
      `SELECT * FROM transacoes
       WHERE categoria ILIKE $1
       ORDER BY data DESC`,
      [`%${categoria.trim()}%`]
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error('Erro ao buscar por categoria:', error);

    res.status(500).json({
      erro: 'Erro ao buscar por categoria'
    });
  }
});

// GET /transacoes/tipo
router.get('/transacoes/tipo', async (req, res) => {
  try {
    const { tipo } = req.query;

    if (tipo !== 'entrada' && tipo !== 'saida') {
      return res.status(400).json({
        erro: "Tipo deve ser 'entrada' ou 'saida'"
      });
    }

    const resultado = await pool.query(
      `SELECT * FROM transacoes
       WHERE tipo = $1
       ORDER BY data DESC`,
      [tipo]
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error('Erro ao buscar por tipo:', error);

    res.status(500).json({
      erro: 'Erro ao buscar por tipo'
    });
  }
});

// GET /transacoes/valor
router.get('/transacoes/valor', async (req, res) => {
  try {
    const { min, max } = req.query;

    if (
      min === undefined ||
      max === undefined ||
      min.trim() === '' ||
      max.trim() === ''
    ) {
      return res.status(400).json({
        erro: 'min e max são obrigatórios'
      });
    }

    const valorMinimo = Number(min);
    const valorMaximo = Number(max);

    if (
      !Number.isFinite(valorMinimo) ||
      !Number.isFinite(valorMaximo) ||
      valorMinimo < 0 ||
      valorMaximo < 0
    ) {
      return res.status(400).json({
        erro: 'min e max devem ser números válidos e não negativos'
      });
    }

    if (valorMinimo > valorMaximo) {
      return res.status(400).json({
        erro: 'O valor mínimo não pode ser maior que o máximo'
      });
    }

    const resultado = await pool.query(
      `SELECT * FROM transacoes
       WHERE valor BETWEEN $1 AND $2
       ORDER BY valor DESC`,
      [valorMinimo, valorMaximo]
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error('Erro ao buscar por valor:', error);

    res.status(500).json({
      erro: 'Erro ao buscar por valor'
    });
  }
});

export default router;
