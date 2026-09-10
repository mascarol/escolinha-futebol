const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Conexão com o banco SQLite
const dbPath = path.resolve(__dirname, 'escolinha.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao conectar ao banco:', err.message);
  else console.log('Conectado ao banco de dados SQLite.');
});

// Criar tabelas se não existirem
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS alunos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      data_nascimento TEXT NOT NULL,
      posicao TEXT,
      turma TEXT,
      foto_url TEXT,
      observacoes_medicas TEXT,
      data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS responsaveis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      parentesco TEXT,
      telefone_whatsapp TEXT NOT NULL,
      cpf TEXT,
      FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id INTEGER NOT NULL,
      peso_kg REAL NOT NULL,
      altura_cm REAL NOT NULL,
      imc REAL NOT NULL,
      alongamento_cm REAL,
      observacoes TEXT,
      data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS metricas_customizadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avaliacao_id INTEGER NOT NULL,
      nome_metrica TEXT NOT NULL,
      valor TEXT NOT NULL,
      FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE
    )
  `);
});

// --- ROTA DE LOGIN / PORTARIA ---
app.post('/api/login', (req, res) => {
  const { tipo, senha, cpf } = req.body;

  if (tipo === 'professor') {
    // Senha padrão do treinador: 1234 (pode alterar aqui)
    if (senha === '1234') {
      return res.json({ sucesso: true, tipo: 'professor', nome: 'Treinador' });
    } else {
      return res.status(401).json({ erro: 'Senha do treinador incorreta!' });
    }
  }

  if (tipo === 'responsavel') {
    const cpfLimpo = (cpf || '').replace(/\D/g, '');
    if (!cpfLimpo) {
      return res.status(400).json({ erro: 'Informe o CPF do responsável.' });
    }

    // Busca o aluno associado ao CPF informado
    const query = `
      SELECT r.aluno_id, r.nome as resp_nome, a.nome as aluno_nome 
      FROM responsaveis r 
      JOIN alunos a ON a.id = r.aluno_id 
      WHERE REPLACE(REPLACE(REPLACE(r.cpf, '.', ''), '-', ''), ' ', '') = ?
      OR REPLACE(REPLACE(REPLACE(r.telefone_whatsapp, '.', ''), '-', ''), ' ', '') = ?
    `;

    db.get(query, [cpfLimpo, cpfLimpo], (err, row) => {
      if (err) return res.status(500).json({ erro: err.message });
      if (!row) {
        return res.status(404).json({ erro: 'Nenhum atleta encontrado para este CPF/Telefone.' });
      }
      res.json({ sucesso: true, tipo: 'responsavel', alunoId: row.aluno_id, nome: row.resp_nome });
    });
    return;
  }

  res.status(400).json({ erro: 'Tipo de acesso inválido.' });
});

// --- ROTAS DA API ---

// Listar alunos (com filtro de busca e turma)
app.get('/api/alunos', (req, res) => {
  const { busca, turma } = req.query;
  let sql = `
    SELECT a.*, r.nome as responsavel_nome, r.telefone_whatsapp, r.parentesco, r.cpf as responsavel_cpf
    FROM alunos a
    LEFT JOIN responsaveis r ON a.id = r.aluno_id
    WHERE 1=1
  `;
  const params = [];

  if (busca) {
    sql += ` AND a.nome LIKE ?`;
    params.push(`%${busca}%`);
  }

  if (turma) {
    sql += ` AND a.turma = ?`;
    params.push(turma);
  }

  sql += ` ORDER BY a.nome ASC`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

// Obter dados de um único aluno
app.get('/api/alunos/:id', (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT a.*, r.nome as responsavel_nome, r.telefone_whatsapp, r.parentesco, r.cpf as responsavel_cpf
    FROM alunos a
    LEFT JOIN responsaveis r ON a.id = r.aluno_id
    WHERE a.id = ?
  `;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!row) return res.status(404).json({ erro: 'Aluno não encontrado.' });
    res.json(row);
  });
});

// Cadastrar novo aluno
app.post('/api/alunos', (req, res) => {
  const { nome, data_nascimento, posicao, turma, foto_url, observacoes_medicas, responsavel } = req.body;

  if (!nome || !data_nascimento || !responsavel || !responsavel.nome || !responsavel.telefone_whatsapp) {
    return res.status(400).json({ erro: 'Preencha os campos obrigatórios.' });
  }

  const sqlAluno = `
    INSERT INTO alunos (nome, data_nascimento, posicao, turma, foto_url, observacoes_medicas)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(sqlAluno, [nome, data_nascimento, posicao, turma, foto_url, observacoes_medicas], function (err) {
    if (err) return res.status(500).json({ erro: err.message });

    const alunoId = this.lastID;
    const sqlResp = `
      INSERT INTO responsaveis (aluno_id, nome, parentesco, telefone_whatsapp, cpf)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(sqlResp, [alunoId, responsavel.nome, responsavel.parentesco, responsavel.telefone_whatsapp, responsavel.cpf], (errResp) => {
      if (errResp) return res.status(500).json({ erro: errResp.message });
      res.json({ id: alunoId, message: 'Aluno cadastrado com sucesso!' });
    });
  });
});

// Salvar Avaliação Física
app.post('/api/alunos/:id/avaliacoes', (req, res) => {
  const alunoId = req.params.id;
  const { peso_kg, altura_cm, alongamento_cm, observacoes, metricas_customizadas } = req.body;

  if (!peso_kg || !altura_cm) {
    return res.status(400).json({ erro: 'Peso e altura são obrigatórios.' });
  }

  const alturaM = altura_cm / 100;
  const imc = parseFloat((peso_kg / (alturaM * alturaM)).toFixed(2));

  const sqlAval = `
    INSERT INTO avaliacoes (aluno_id, peso_kg, altura_cm, imc, alongamento_cm, observacoes)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(sqlAval, [alunoId, peso_kg, altura_cm, imc, alongamento_cm, observacoes], function (err) {
    if (err) return res.status(500).json({ erro: err.message });

    const avaliacaoId = this.lastID;

    if (metricas_customizadas && metricas_customizadas.length > 0) {
      const stmt = db.prepare(`INSERT INTO metricas_customizadas (avaliacao_id, nome_metrica, valor) VALUES (?, ?, ?)`);
      metricas_customizadas.forEach(m => stmt.run(avaliacaoId, m.nome_metrica, m.valor));
      stmt.finalize();
    }

    res.json({ id: avaliacaoId, imc, message: 'Avaliação física salva com sucesso!' });
  });
});

// Listar histórico de avaliações de um aluno
app.get('/api/alunos/:id/avaliacoes', (req, res) => {
  const alunoId = req.params.id;

  const sql = `SELECT * FROM avaliacoes WHERE aluno_id = ? ORDER BY data_avaliacao DESC`;

  db.all(sql, [alunoId], (err, avaliacoes) => {
    if (err) return res.status(500).json({ erro: err.message });

    if (avaliacoes.length === 0) return res.json([]);

    let concluidas = 0;
    avaliacoes.forEach(aval => {
      db.all(`SELECT nome_metrica, valor FROM metricas_customizadas WHERE avaliacao_id = ?`, [aval.id], (errM, metricas) => {
        aval.metricas_customizadas = metricas || [];
        concluidas++;
        if (concluidas === avaliacoes.length) {
          res.json(avaliacoes);
        }
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor Fantasminha FC rodando na porta ${PORT}`);
});