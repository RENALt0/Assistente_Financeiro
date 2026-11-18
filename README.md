# Assistente Financeiro

Aplicação web para registrar transações pessoais, acompanhar o orçamento e analisar padrões mensais de despesas. O projeto oferece uma API REST em Node.js/Express, um frontend servido pela própria API e um banco PostgreSQL.

## Funcionalidades

- Cadastro, consulta, edição e remoção de transações financeiras.
- Resumo financeiro, gastos por categoria, médias e indicadores do dashboard.
- Filtros de transações por período, categoria, tipo e valor.
- Chatbot que responde a perguntas sobre os dados financeiros registrados.
- Análise de associações de categorias de despesas usando o algoritmo Apriori.
- Interpretação textual dos resultados do Apriori por IA, quando um provedor está configurado.
- Dados fictícios de demonstração carregados na primeira inicialização do banco.

### Como funciona o Apriori

Cada mês é tratado como uma cesta contendo as categorias distintas em que houve despesas naquele mês. O algoritmo usa suporte mínimo de `0.4` e confiança mínima de `0.6`; os resultados incluem conjuntos frequentes e regras com suporte, confiança e lift. A análise também identifica os meses em que as categorias ocorreram.

As regras representam coocorrência mensal, não compras feitas juntas nem relações de causa e efeito. O cálculo matemático não depende de um serviço de IA. Para reduzir o tamanho das chamadas aos provedores, a interpretação envia um subconjunto compacto dos dados calculados; a resposta da API continua incluindo os resultados completos da análise.

### Provedores de IA

O chatbot e a interpretação do Apriori tentam usar a **Groq** primeiro e o **Gemini** como alternativa. Configure pelo menos uma das chaves para habilitar respostas de IA. Sem provedores disponíveis, o chatbot retorna indisponibilidade; a análise Apriori ainda pode apresentar seus resultados matemáticos.

## Tecnologias e requisitos

- Node.js 18 ou superior para executar a API fora do Docker.
- Docker Desktop com Docker Compose para a instalação recomendada.
- PostgreSQL 16.
- Express, `pg`, `groq-sdk` e `@google/generative-ai`.
- Frontend em HTML, CSS e JavaScript; o gráfico usa Chart.js via CDN.

## Instalação recomendada: Docker

1. Clone o repositório:

   ```bash
   git clone https://github.com/RENALt0/Assistente_Financeiro.git
   cd Assistente_Financeiro
   ```

2. Crie o arquivo local de configuração. No PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   O script `iniciar-projeto.bat` também cria o `.env` automaticamente se ele ainda não existir.

3. Abra o `.env` e preencha `GROQ_API_KEY` e/ou `GOOGLE_API_KEY` para habilitar a IA. As chaves são opcionais para cadastrar transações e executar o cálculo matemático do Apriori.

4. Com o Docker Desktop aberto, inicie o projeto:

   ```powershell
   .\iniciar-projeto.bat
   ```

   Ou use o Docker Compose diretamente:

   ```bash
   docker compose up --build -d
   ```

5. Acesse <http://localhost:3001>.

Para parar os serviços sem apagar o banco:

```bash
docker compose down
```

O PostgreSQL persiste os dados no volume `postgres_data`. Os arquivos `database.sql` e `seed.sql` são executados automaticamente apenas quando o PostgreSQL inicializa um volume vazio. **Não use `docker compose down -v` se quiser preservar os dados**, pois esse comando remove o volume.

### Executar a API fora do Docker

É possível executar o Node.js localmente e manter o PostgreSQL no Docker:

1. Inicie somente o banco:

   ```bash
   docker compose up -d postgres
   ```

2. No `.env`, ajuste a conexão da API local para `DB_HOST=localhost` e `DB_PORT=5433`. A porta `5433` do computador é mapeada para a porta `5432` do container. Use as credenciais e o nome do banco configurados no Compose.

3. Instale as dependências e inicie a API:

   ```bash
   npm install
   npm start
   ```

4. Acesse <http://localhost:3000>.

## Configuração do ambiente

O arquivo `.env.example` contém os nomes das variáveis esperadas. O `.env` é local e não deve ser enviado ao GitHub.

| Variável | Uso |
| --- | --- |
| `GOOGLE_API_KEY` | Chave do Gemini; também usada pelo endpoint `GET /models`. |
| `GROQ_API_KEY` | Chave da Groq. |
| `DB_HOST` | `postgres` no backend do Docker; `localhost` ao executar a API diretamente no computador. |
| `DB_USER` | Usuário do PostgreSQL. |
| `DB_PASSWORD` | Senha do PostgreSQL. |
| `DB_NAME` | Nome do banco de dados. |
| `DB_PORT` | `5432` dentro do Docker; `5433` para a API local conectando ao banco do Compose. |
| `PORT` | Porta da API; o valor do exemplo é `3000`. No Docker, essa porta é publicada em `3001` no computador. |

O Compose usa as credenciais de demonstração `postgres`/`postgres` para o banco local. Não reutilize essas credenciais em um ambiente de produção.

## Endpoints principais

A API e a interface ficam disponíveis na mesma origem. Com Docker, use `http://localhost:3001`; executando o Node.js diretamente, use `http://localhost:3000` (ou a porta definida em `PORT`).

| Método | Caminho | Descrição |
| --- | --- | --- |
| `GET` | `/transacoes` | Lista transações. |
| `POST` | `/transacoes` | Cadastra uma transação. |
| `PUT` | `/transacoes/:id` | Atualiza uma transação. |
| `DELETE` | `/transacoes/:id` | Remove uma transação. |
| `GET` | `/transacoes/periodo` | Consulta transações por período. |
| `GET` | `/transacoes/categoria` | Filtra transações por categoria. |
| `GET` | `/transacoes/tipo` | Filtra transações por tipo. |
| `GET` | `/transacoes/valor` | Filtra transações por valor. |
| `GET` | `/resumo` | Retorna entradas, saídas e saldo. |
| `GET` | `/gasto-categoria` | Retorna despesas agrupadas por categoria. |
| `GET` | `/media-mensal` | Retorna a média mensal de despesas. |
| `GET` | `/maior-gasto` | Retorna a maior despesa individual. |
| `GET` | `/menor-gasto` | Retorna a menor despesa individual. |
| `GET` | `/insights` | Retorna indicadores financeiros. |
| `GET` | `/dashboard` | Retorna dados agregados do dashboard. |
| `GET` | `/apriori` | Calcula conjuntos frequentes e regras de associação. |
| `POST` | `/analise/apriori/interpretar` | Retorna a análise Apriori e sua interpretação textual. |
| `POST` | `/chat` | Envia uma pergunta contextualizada sobre as finanças. |
| `GET` | `/models` | Lista modelos Gemini disponíveis para a chave configurada. |

Exemplo de corpo para o chatbot:

```json
{
  "pergunta": "Quanto gastei neste mês?"
}
```

## Dados de demonstração

O `seed.sql` inclui 28 transações fictícias distribuídas por sete meses, com quatro registros por mês, para demonstrar a análise Apriori. O seed só é carregado na criação inicial do volume; iniciar os containers novamente não reaplica os dados.

## Solução de problemas de IA

- **Erro 413 da Groq:** a requisição excedeu o limite de tamanho aceito. A interpretação Apriori envia um conjunto reduzido de dados, mas o tamanho ainda depende das categorias e regras geradas.
- **Erro 401 do Gemini:** verifique se `GOOGLE_API_KEY` está preenchida com uma chave válida e autorizada para a API Gemini.
- **Chat indisponível:** confirme que pelo menos uma chave (`GROQ_API_KEY` ou `GOOGLE_API_KEY`) está configurada e confira os logs do backend.

Uma falha na Groq pode levar à tentativa de uso do Gemini como alternativa; portanto, erros dos dois provedores podem aparecer para a mesma solicitação.

## Estrutura do projeto

```text
.
├── Frontend/                 # Interface web
├── ml/
│   └── apriori.js            # Implementação do algoritmo Apriori
├── routes/
│   ├── transacoes.js         # CRUD e filtros de transações
│   ├── dashboard.js          # Resumos e indicadores
│   ├── apriori.js            # Endpoint da análise matemática
│   └── chat.js               # Chat e interpretação com IA
├── utils/
│   └── validacoes.js         # Validações auxiliares
├── database.sql              # Estrutura do banco
├── seed.sql                  # Dados fictícios de demonstração
├── db.js                      # Conexão PostgreSQL
├── index.js                   # Inicialização do servidor Express
├── docker-compose.yaml        # Backend e PostgreSQL
├── Dockerfile                 # Imagem da API
├── .env.example               # Modelo de configuração local
└── iniciar-projeto.bat        # Inicialização no Windows
```

## Autores

- Heytor Vinicios Fonseca Palheta Ferreira
- João Victor Pires de Melo
- Nicolas Barbosa Freitas
- Renato Dorador Faulin
- Victor Lambertini Da Costa

## Licença

ISC
