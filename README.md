# ⚽ Sistema de Gestão e Avaliação Física - Escolinha de Futebol

API REST desenvolvida para gerenciamento de alunos, responsáveis e acompanhamento de evolução física em escolinhas de futebol. O projeto foi projetado com foco em praticidade e arquitetura PWA (Progressive Web App), permitindo acesso simplificado tanto em dispositivos móveis quanto em computadores, sem a necessidade de instalação via lojas de aplicativos.

---

## 🎯 Objetivo do Projeto

Oferecer uma solução simples e intuitiva para escolinhas de futebol que precisam organizar seus cadastros e ter um controle histórico da evolução física dos seus alunos. A interface e os endpoints foram pensados para garantir rapidez no cadastro e fácil acesso às informações em campo ou no escritório.

---

## 🚀 Funcionalidades

- **Gestão de Alunos:** Cadastro completo com nome, data de nascimento, foto, posição em campo, categoria/turma e observações médicas.
- **Controle de Responsáveis:** Vinculação de responsáveis ao aluno com armazenamento de contato para rápida comunicação via WhatsApp.
- **Histórico de Avaliações Físicas:** Registro contínuo de métricas como peso, altura, cálculo automático de IMC e nível de flexibilidade/alongamento.
- **Métricas Customizáveis:** Estrutura flexível no banco de dados para inclusão de novos testes físicos (ex: velocidade, salto vertical, frequência cardíaca) sem alterar a estrutura do sistema.

---

## 🛠️ Tecnologias Utilizadas

- **Linguagem / Ambiente:** Node.js
- **Framework:** Express.js
- **Banco de Dados:** PostgreSQL / SQLite
- **ORM / Query Builder:** Prisma (ou Knex.js / Sequelize)
- **Documentação / Testes de API:** Postman / Insomnia

---

## 🗄️ Estrutura do Banco de Dados

O banco de dados foi modelado de forma relacional para manter a integridade entre alunos, responsáveis e seus históricos físicos:

- **Alunos** (1) ─── (N) **Responsáveis**
- **Alunos** (1) ─── (N) **Avaliações Físicas**
- **Avaliações Físicas** (1) ─── (N) **Métricas Customizáveis**

---

## 📌 Rotas da API (Endpoints)

### Alunos e Responsáveis
- `POST /api/alunos` — Cadastra um novo aluno com dados do responsável
- `GET /api/alunos` — Lista todos os alunos (suporta filtro por nome/turma)
- `GET /api/alunos/:id` — Retorna os detalhes de um aluno específico
- `PUT /api/alunos/:id` — Atualiza os dados de um aluno ou responsável
- `DELETE /api/alunos/:id` — Remove o registro do aluno

### Avaliações Físicas
- `POST /api/alunos/:id/avaliacoes` — Registra uma nova avaliação física para o aluno
- `GET /api/alunos/:id/avaliacoes` — Retorna o histórico de avaliações do aluno
- `DELETE /api/avaliacoes/:id` — Remove um registro de avaliação

---

