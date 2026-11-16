# Controle Financeiro API (Projeto Terca Feira)

## Objetivo
Aplicação **full‑stack** para gerenciamento de transações financeiras com **IA integrada** (Gemini). Inclui CRUD, relatórios e filtros avançados.

## Funcionalidades atuais
- **CRUD completo** de transações (criar, listar, atualizar, deletar).
- **Relatórios**: resumo financeiro, gasto por categoria, média mensal, maior/menor gasto, variação mensal.
- **Filtros avançados**: período, categoria, tipo, faixa de valor.
- **IA integrada**: endpoint `/chat` que responde usando **Google Gemini**.
- **Script `iniciar-projeto.bat`** (um clique):
  - Cria `.env` a partir de `.env.example` se não existir.
  - Verifica Docker instalado.
  - Executa `docker compose up --build -d`.
  - Aguarda 5 s e abre o navegador em `http://localhost:3001`.
  - **Não encerra** os containers ao fechar a janela (removido `docker compose down`).
- **Docker Compose** pronto para PostgreSQL + Node.js.
- **Variáveis de ambiente** (copie `.env.example` para `.env` e preencha as chaves de API, se necessário):
  ```env
  GOOGLE_API_KEY=
  GROQ_API_KEY=
  DB_HOST=postgres
  DB_USER=postgres
  DB_PASSWORD=postgres
  DB_NAME=financas
  DB_PORT=5432
  ```

## Tecnologias
- **Node.js** + **Express** (API REST)
- **PostgreSQL** (via `pg` driver)
- **Docker & Docker‑Compose** (containerização)
- **Google Generative AI** (`@google/generative-ai`)

## Instalação
```bash
# 1. Clonar o repositório
git clone https://github.com/RENALt0/ProjetoTercaFeira.git
cd ProjetoTercaFeira

# 2. Criar o arquivo local de configuração (o .env não deve ser enviado ao GitHub)
cp .env.example .env

# 3. (Opcional) Instalar dependências localmente – necessário só se for rodar fora do Docker
npm install

# 4. Iniciar com um clique (recomendado)
#    Crie e execute o script .bat presente na raiz do projeto.
#    Ele criará .env, levantará os containers Docker e abrirá o navegador.
start iniciar-projeto.bat
```

> **Nota:** O script só funciona em **Windows**. Em Linux/macOS use o equivalente `docker compose up --build -d` após criar `.env` manualmente.

### Dados fictícios de demonstração

O `seed.sql` preenche o banco com transações fictícias entre maio e novembro de 2026. As despesas foram distribuídas em categorias recorrentes para que a análise Apriori tenha sete meses para avaliar. O PostgreSQL executa `database.sql` e, em seguida, `seed.sql` somente quando inicializa com um volume de dados vazio.

**Limite da análise:** o Apriori trata cada mês como uma cesta de categorias de despesas. As regras indicam categorias que coocorreram nos meses analisados; não descrevem compras individuais, hábitos de uma pessoa ou relações de causa e efeito. O conjunto permanece com 28 registros (quatro por mês), suficiente para demonstrar essa análise mensal sem ampliar artificialmente a amostra.

Se o volume `postgres_data` já existir, os scripts de inicialização não serão executados novamente. **Não remova o volume com `docker compose down -v` se precisar preservar os dados atuais.** Para iniciar do zero, faça isso somente depois de confirmar que os dados podem ser apagados; em seguida, execute `docker compose down -v` e `docker compose up --build`.

O `.env` contém configurações locais e chaves de API; ele é ignorado pelo Git. Preencha `GOOGLE_API_KEY` e/ou `GROQ_API_KEY` no `.env` para habilitar os provedores de IA.

## Executando a API
- A API fica disponível em `http://localhost:3001`.
- Documentação dos endpoints está no próprio README (seções **Endpoints Disponíveis**).
- **Chat IA**: `POST /chat` com JSON `{ "pergunta": "..." }`.
  - Se `GOOGLE_API_KEY` estiver no `.env`, usa essa chave.

## Estrutura do Projeto
```
.
├─ Frontend/
│  ├─ index.html        # interface principal da aplicação
│  ├─ style.css         # estilização da interface
│  ├─ script.js         # lógica do frontend e integração com a API
│  └─ imagens/          # imagem usada de fundo na interface
│
├─ routes/
│  ├─ transacoes.js     # CRUD e filtros de transações
│  ├─ dashboard.js      # relatórios e análises financeiras
│  └─ chat.js           # integração com IA Gemini
│
├─ utils/
│  └─ validacoes.js     # validações auxiliares
│
├─ db.js                # configuração PostgreSQL
├─ index.js             # servidor principal Express
├─ docker-compose.yaml  # orquestração dos containers
├─ Dockerfile           # configuração do container backend
├─ .env.example         # exemplo de variáveis de ambiente
├─ iniciar-projeto.bat  # inicialização automática do projeto
├─ teste.http           # testes de endpoints
└─ README.md            # documentação do projeto
```

## Testes rápidos
```bash
# Listar transações
curl http://localhost:3000/transacoes

# Criar transação
curl -X POST http://localhost:3000/transacoes \
  -H "Content-Type: application/json" \
  -d '{"descricao":"Teste","categoria":"Misc","valor":42,"tipo":"saida"}'

# Chat com IA (sem .env)
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"pergunta":"Qual é o saldo atual?"}'
```

## Notas importantes
- **Segurança**: a chave de API está codificada no código apenas para fins acadêmicos. Em produção, remova o fallback e use apenas `.env`.
- **Limite gratuito** da Gemini: suficiente para testes e demonstrações, mas pode ser atingido se houver uso intensivo.
- **Parar containers**: execute `docker compose down` manualmente quando quiser encerrar a aplicação.

## Autores

Heytor Vinicios Fonseca Palheta Ferreira 

João Victor Pires de Melo 

Nicolas Barbosa Freitas 

Renato Dorador Faulin 

Victor Lambertini Da Costa 


---

## Licença
ISC
