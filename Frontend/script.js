const API_URL = "";
let editandoId = null;

function formatarValor(valor) {
  const numero = Number(valor);
  if (Number.isNaN(numero)) return "0,00";
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ADICIONAR OU ATUALIZAR
async function adicionarTransacao() {
  const descricao = document.getElementById("descricao").value;
  const categoria = document.getElementById("categoria").value;
  const valor = document.getElementById("valor").value;
  const tipo = document.getElementById("tipo").value;
  const metodo_pagamento = document.getElementById("metodo_pagamento").value;
  const observacao = document.getElementById("observacao").value;

  const metodo = editandoId ? "PUT" : "POST";
  const url = editandoId
    ? `${API_URL}/transacoes/${editandoId}`
    : `${API_URL}/transacoes`;

  try {
    const response = await fetch(url, {
      method: metodo,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        descricao,
        categoria,
        valor,
        tipo,
        metodo_pagamento,
        observacao
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.erro);
      return;
    }

    alert(editandoId ? "Transação atualizada!" : "Transação adicionada!");

    limparCampos();
    editandoId = null;

    carregarTransacoes();
    carregarResumo();
    carregarGraficoCategorias();

  } catch (error) {
    console.error(error);
    alert("Erro ao conectar com o servidor");
  }
}


// LISTAR TRANSAÇÕES

async function carregarTransacoes() {
  try {
    const response = await fetch(`${API_URL}/transacoes`);

    if (!response.ok) {
      throw new Error("Erro ao carregar transações");
    }

    const transacoes = await response.json();

    const lista = document.getElementById("listaTransacoes");
    lista.innerHTML = "";

    transacoes.forEach(transacao => {
      const linha = document.createElement("tr");

      // Cria as células da tabela
      const celulaDescricao = document.createElement("td");
      const celulaCategoria = document.createElement("td");
      const celulaValor = document.createElement("td");
      const celulaTipo = document.createElement("td");
      const celulaMetodo = document.createElement("td");
      const celulaAcoes = document.createElement("td");

      // Insere os dados como texto, sem interpretar HTML
      celulaDescricao.textContent = transacao.descricao;
      celulaCategoria.textContent = transacao.categoria;
      celulaValor.textContent = `R$ ${formatarValor(transacao.valor)}`;
      celulaTipo.textContent = transacao.tipo;
      celulaMetodo.textContent = transacao.metodo_pagamento || "-";

      // Botão editar
      const botaoEditar = document.createElement("button");
      botaoEditar.textContent = "Editar";
      botaoEditar.addEventListener("click", () => {
        editarTransacao(transacao.id);
      });

      // Botão excluir
      const botaoExcluir = document.createElement("button");
      botaoExcluir.textContent = "Excluir";
      botaoExcluir.addEventListener("click", () => {
        deletarTransacao(transacao.id);
      });

      // Monta a célula de ações
      celulaAcoes.appendChild(botaoEditar);
      celulaAcoes.appendChild(botaoExcluir);

      // Monta a linha
      linha.appendChild(celulaDescricao);
      linha.appendChild(celulaCategoria);
      linha.appendChild(celulaValor);
      linha.appendChild(celulaTipo);
      linha.appendChild(celulaMetodo);
      linha.appendChild(celulaAcoes);

      lista.appendChild(linha);
    });

  } catch (error) {
    console.error("Erro ao carregar transações:", error);
  }
}


// RESUMO
async function carregarResumo() {
  try {
    const response = await fetch(`${API_URL}/resumo`);

    if (!response.ok) {
      throw new Error(`Erro ao carregar resumo: HTTP ${response.status}`);
    }

    const resumo = await response.json();

    const saldoEl = document.getElementById("saldo");

    saldoEl.textContent = `Saldo: R$ ${formatarValor(resumo.saldo)}`;

    saldoEl.classList.remove("positivo", "negativo");

    if (resumo.saldo < 0) {
      saldoEl.classList.add("negativo");
    } else {
      saldoEl.classList.add("positivo");
    }

    document.getElementById("entradas").textContent =
      `Entradas: R$ ${formatarValor(resumo.entradas)}`;

    document.getElementById("saidas").textContent =
      `Saídas: R$ ${formatarValor(resumo.saidas)}`;

  } catch (error) {
    console.error("Erro ao carregar resumo:", error);
  }
}


// LIMPAR FORM
function limparCampos() {
  document.getElementById("descricao").value = "";
  document.getElementById("categoria").value = "";
  document.getElementById("valor").value = "";
  document.getElementById("observacao").value = "";

  editandoId = null;
}


// DELETAR
async function deletarTransacao(id) {
  const confirmar = confirm("Tem certeza que deseja deletar?");
  if (!confirmar) return;

  try {
    const response = await fetch(`${API_URL}/transacoes/${id}`, {
      method: "DELETE"
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.erro);
      return;
    }

    alert("Transação deletada!");

    carregarTransacoes();
    carregarResumo();
    carregarGraficoCategorias();
  } catch (error) {
    console.error(error);
    alert("Erro ao deletar");
  }
}

// EDITAR (CARREGA NO FORM)
async function editarTransacao(id) {
  try {
    const response = await fetch(`${API_URL}/transacoes`);
    const transacoes = await response.json();

    const t = transacoes.find(tr => tr.id === id);

    document.getElementById("descricao").value = t.descricao;
    document.getElementById("categoria").value = t.categoria;
    document.getElementById("valor").value = t.valor;
    document.getElementById("tipo").value = t.tipo;
    document.getElementById("metodo_pagamento").value = t.metodo_pagamento;
    document.getElementById("observacao").value = t.observacao;

    editandoId = id;

  } catch (error) {
    console.error(error);
  }
}

// CHAT SIMPLES COM IA

function formatarRespostaIA(texto) {
  // Normaliza o Markdown recebido da IA
  const linhas = texto
    .replace(/\r\n/g, "\n")
    .replace(/\\\|/g, "|")
    .replace(/\\-/g, "-")
    .replace(/\\\./g, ".")
    .replace(/\\\n/g, "\n")
    .replace(/\\+$/gm, "")
    .split("\n")
    .map(linha => linha.trim());

  // Proteção contra HTML e scripts
  const escaparHTML = texto =>
    texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // Negrito e itálico
  const formatInline = texto =>
    escaparHTML(texto)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Verifica se uma linha é o separador de uma tabela
  const separadorTabela = linha => {
    const celulas = linha
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|");

    return celulas.every(celula =>
      /^:?-{3,}:?$/.test(celula.trim())
    );
  };

  // Divide as células de uma tabela
  const separarCelulas = linha =>
    linha
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map(celula => celula.trim());

  const resultado = [];
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i];

    if (!linha) {
      i++;
      continue;
    }

    // Títulos
    const titulo = linha.match(/^(#{1,3})\s+(.+)$/);

    if (titulo) {
      const nivel = titulo[1].length;

      resultado.push(
        `<h${nivel}>${formatInline(titulo[2])}</h${nivel}>`
      );

      i++;
      continue;
    }

    // Tabelas
    if (
      linha.includes("|") &&
      i + 1 < linhas.length &&
      separadorTabela(linhas[i + 1])
    ) {
      const cabecalhos = separarCelulas(linha);
      const quantidadeColunas = cabecalhos.length;

      let tabela = "<table><thead><tr>";

      cabecalhos.forEach(celula => {
        tabela += `<th>${formatInline(celula)}</th>`;
      });

      tabela += "</tr></thead><tbody>";

      i += 2;

      while (i < linhas.length && linhas[i].includes("|")) {
        const celulas = separarCelulas(linhas[i]);

        tabela += "<tr>";

        for (let coluna = 0; coluna < quantidadeColunas; coluna++) {
          const valor = celulas[coluna] || "";
          tabela += `<td>${formatInline(valor)}</td>`;
        }

        tabela += "</tr>";
        i++;
      }

      tabela += "</tbody></table>";
      resultado.push(tabela);
      continue;
    }

    // Listas não ordenadas
    if (linha.startsWith("- ") || linha.startsWith("* ")) {
      let lista = "<ul>";

      while (
        i < linhas.length &&
        (linhas[i].startsWith("- ") || linhas[i].startsWith("* "))
      ) {
        lista += `<li>${formatInline(linhas[i].slice(2))}</li>`;
        i++;
      }

      lista += "</ul>";
      resultado.push(lista);
      continue;
    }

    // Listas numeradas
    if (/^\d+\.\s/.test(linha)) {
      let lista = "<ol>";

      while (i < linhas.length && /^\d+\.\s/.test(linhas[i])) {
        const item = linhas[i].replace(/^\d+\.\s/, "");
        lista += `<li>${formatInline(item)}</li>`;
        i++;
      }

      lista += "</ol>";
      resultado.push(lista);
      continue;
    }

    // Parágrafos
    let paragrafo = [formatInline(linha)];
    i++;

    while (
      i < linhas.length &&
      linhas[i] &&
      !/^#{1,3}\s/.test(linhas[i]) &&
      !linhas[i].includes("|") &&
      !linhas[i].startsWith("- ") &&
      !linhas[i].startsWith("* ") &&
      !/^\d+\.\s/.test(linhas[i])
    ) {
      paragrafo.push(formatInline(linhas[i]));
      i++;
    }

    resultado.push(`<p>${paragrafo.join("<br>")}</p>`);
  }

  return resultado.join("");
}


function adicionarMensagem(texto, remetente) {
  const chatWindow = document.getElementById("chatWindow");
  const mensagem = document.createElement("div");
  mensagem.className = `chat-message ${remetente}`;
  mensagem.innerHTML = remetente === "bot" ? formatarRespostaIA(texto) : texto.replace(/\n/g, "<br>");
  chatWindow.appendChild(mensagem);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}


async function responderPergunta(pergunta) {
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        pergunta
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API do chatbot: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.resposta || typeof data.resposta !== "string") {
      throw new Error("A resposta da IA está vazia ou em formato inválido");
    }

    return data.resposta;

  } catch (error) {
    console.error("Erro ao consultar a IA:", error);

    return "Não foi possível obter uma resposta da IA. Tente novamente.";
  }
}


async function enviarPergunta() {
  const input = document.getElementById("chatInput");
  const texto = input.value.trim();
  if (!texto) return;

  adicionarMensagem(texto, "user");
  input.value = "";

  const resposta = await responderPergunta(texto);

  adicionarMensagem(resposta, "bot");
}

let graficoCategorias = null;


async function carregarGraficoCategorias() {
  try {
    const response = await fetch(`${API_URL}/gasto-categoria`);

    if (!response.ok) {
      throw new Error(`Erro ao carregar categorias: HTTP ${response.status}`);
    }

    const dados = await response.json();

    if (!dados.categorias || !Array.isArray(dados.categorias)) {
      throw new Error("Formato de dados de categorias inválido");
    }

    const categorias = dados.categorias.map(item => item.categoria);
    const valores = dados.categorias.map(item => Number(item.total));

    const ctx = document
      .getElementById("graficoCategorias")
      .getContext("2d");

    // Evita criar gráfico duplicado
    if (graficoCategorias) {
      graficoCategorias.destroy();
    }

    graficoCategorias = new Chart(ctx, {
      type: "doughnut",

      data: {
        labels: categorias,

        datasets: [{
          label: "Gastos",
          data: valores,

          backgroundColor: [
            "#9036f7",
            "#e6a94f",
            "#50dddd",
            "#45c465",
            "#ca39ab",
            "#f12a2a",
            "#170da8"
          ],

          borderColor: "#ffffffbd",
          borderWidth: 3
        }]
      },

      options: {
        responsive: true,

        plugins: {
          legend: {
            labels: {
              color: "#33223f"
            }
          }
        }
      }
    });

  } catch (error) {
    console.error("Erro ao carregar gráfico de categorias:", error);
  }
}


// GLOBAL (HTML)
window.adicionarTransacao = adicionarTransacao;
window.deletarTransacao = deletarTransacao;
window.editarTransacao = editarTransacao;
window.enviarPergunta = enviarPergunta;


// ==========================================
// ANÁLISE APRIORI
// ==========================================


async function analisarApriori() {
  const botao = document.querySelector(".apriori-section button");

  const status = document.getElementById("aprioriStatus");
  const resultadoEl = document.getElementById("aprioriResultado");

  if (!botao || !status || !resultadoEl) {
    console.error("Elementos da análise Apriori não encontrados.");
    return;
  }

  botao.disabled = true;
  botao.textContent = "Analisando...";
  status.textContent = "Calculando padrões e consultando a IA...";
  resultadoEl.hidden = true;

  try {
    const response = await fetch(
      `${API_URL}/analise/apriori/interpretar`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.erro || "Erro ao realizar análise.");
    }

    // Caso não existam despesas.
    if (data.mensagem) {
      status.textContent = data.mensagem;
      return;
    }

    const analise = data.analise;

    if (
      !analise ||
      !Array.isArray(analise.categoriasAnalisadas) ||
      !Array.isArray(analise.rules)
    ) {
      throw new Error("Os dados recebidos da análise Apriori são inválidos.");
    }

    // Quantidade de meses.
    document.getElementById("aprioriTotalMeses").textContent =
      `Meses analisados: ${data.totalMeses}`;

    // Categorias.
    document.getElementById("aprioriCategorias").textContent =
      analise.categoriasAnalisadas.join(", ");

    // Regras de associação.
    const tabela = document.getElementById("aprioriRegras");
    tabela.innerHTML = "";

    if (analise.rules.length === 0) {
      const linha = document.createElement("tr");
      const celula = document.createElement("td");

      celula.colSpan = 5;
      celula.textContent = "Nenhuma regra de associação encontrada.";

      linha.appendChild(celula);
      tabela.appendChild(linha);

    } else {
      analise.rules.forEach(regra => {
        const linha = document.createElement("tr");

        const valores = [
          regra.antecedente.join(", "),
          regra.consequente.join(", "),
          `${(regra.support * 100).toFixed(1)}%`,
          `${(regra.confidence * 100).toFixed(1)}%`,
          Number(regra.lift).toFixed(2)
        ];

        valores.forEach(valor => {
          const celula = document.createElement("td");
          celula.textContent = valor;
          linha.appendChild(celula);
        });

        tabela.appendChild(linha);
      });
    }

    // Interpretação da IA.
    const interpretacao = document.getElementById("aprioriInterpretacao");

    interpretacao.innerHTML = formatarRespostaIA(
      data.interpretacao || "Interpretação indisponível."
    );

    // Exibe o resultado.
    resultadoEl.hidden = false;

    status.textContent = data.iaDisponivel
      ? "Análise concluída com interpretação da IA."
      : "Análise matemática concluída, mas a IA está indisponível.";

  } catch (error) {
    console.error("Erro na análise Apriori:", error);
    status.textContent = error.message;

  } finally {
    botao.disabled = false;
    botao.textContent = "Analisar despesas";
  }
}

// Disponibiliza a função para o HTML.
window.analisarApriori = analisarApriori;


// INIT
window.addEventListener("DOMContentLoaded", () => {
  carregarTransacoes();
  carregarResumo();
  carregarGraficoCategorias();
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        enviarPergunta();
      }
    });
  }
});