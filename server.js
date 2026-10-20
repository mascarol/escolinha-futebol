const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com o banco SQLite
const db = new sqlite3.Database(path.join(__dirname, 'escolinha.db'), (err) => {
  if (err) {
    console.error('Erro ao conectar ao SQLite:', err.message);
  } else {
    console.log('Conectado ao banco SQLite (escolinha.db).');
  }
});

// Inicialização das tabelas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS alunos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      data_nascimento TEXT NOT NULL,
      turma TEXT,
      posicao TEXT,
      foto_url TEXT,
      observacoes_medicas TEXT,
      responsavel_nome TEXT,
      parentesco TEXT,
      telefone_whatsapp TEXT,
      responsavel_cpf TEXT,
      status_mensalidade TEXT DEFAULT 'PENDENTE'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id INTEGER,
      peso_kg REAL,
      altura_cm REAL,
      imc REAL,
      alongamento_cm REAL,
      observacoes TEXT,
      data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (aluno_id) REFERENCES alunos(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mensalidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id INTEGER,
      mes_referencia TEXT,
      valor REAL,
      status TEXT DEFAULT 'PENDENTE',
      txid TEXT,
      remetente_nome TEXT,
      remetente_cpf TEXT,
      data_pagamento DATETIME,
      FOREIGN KEY (aluno_id) REFERENCES alunos(id)
    )
  `);
});

// Calcula a turma pela idade
function calcularTurmaPorIdade(dataNascimento) {
  if (!dataNascimento) return 'Sub-11';

  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();

  const diferencaMes = hoje.getMonth() - nascimento.getMonth();

  if (
    diferencaMes < 0 ||
    (diferencaMes === 0 && hoje.getDate() < nascimento.getDate())
  ) {
    idade--;
  }

  if (idade <= 7) return 'Sub-7';
  if (idade <= 9) return 'Sub-9';
  if (idade <= 11) return 'Sub-11';
  if (idade <= 13) return 'Sub-13';
  if (idade <= 15) return 'Sub-15';

  return 'Sub-17';
}

// Listar alunos, com busca por nome e filtro por turma
app.get('/api/alunos', (req, res) => {
  const { busca, turma } = req.query;
  let sql = 'SELECT * FROM alunos WHERE 1 = 1';
  const params = [];

  if (busca) {
    sql += ' AND nome LIKE ?';
    params.push(`%${busca}%`);
  }

  if (turma) {
    sql += ' AND turma = ?';
    params.push(turma);
  }

  sql += ' ORDER BY nome ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json(rows);
  });
});

// Buscar ficha de um aluno
app.get('/api/alunos/:id', (req, res) => {
  db.get(
    'SELECT * FROM alunos WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) {
        return res.status(404).json({ error: 'Aluno não encontrado.' });
      }

      res.json(row);
    }
  );
});

// Cadastrar aluno
app.post('/api/alunos', (req, res) => {
  const {
    nome,
    data_nascimento,
    turma,
    posicao,
    foto_url,
    observacoes_medicas,
    responsavel,
  } = req.body;

  if (!nome || !data_nascimento) {
    return res.status(400).json({
      error: 'Nome e Data de Nascimento são obrigatórios.',
    });
  }

  const turmaFinal = turma || calcularTurmaPorIdade(data_nascimento);
  const respNome = responsavel ? responsavel.nome : '';
  const parentesco = responsavel ? responsavel.parentesco : '';
  const telefone = responsavel ? responsavel.telefone_whatsapp : '';
  const respCpf = responsavel ? responsavel.cpf : '';

  const sql = `
    INSERT INTO alunos (
      nome,
      data_nascimento,
      turma,
      posicao,
      foto_url,
      observacoes_medicas,
      responsavel_nome,
      parentesco,
      telefone_whatsapp,
      responsavel_cpf,
      status_mensalidade
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE')
  `;

  db.run(
    sql,
    [
      nome,
      data_nascimento,
      turmaFinal,
      posicao,
      foto_url,
      observacoes_medicas,
      respNome,
      parentesco,
      telefone,
      respCpf,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        id: this.lastID,
        message: 'Aluno cadastrado com sucesso!',
      });
    }
  );
});

// Listar avaliações físicas de um aluno
app.get('/api/alunos/:id/avaliacoes', (req, res) => {
  db.all(
    `SELECT *
     FROM avaliacoes
     WHERE aluno_id = ?
     ORDER BY data_avaliacao DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json(rows);
    }
  );
});

// Cadastrar avaliação física
app.post('/api/alunos/:id/avaliacoes', (req, res) => {
  const aluno_id = req.params.id;
  const { peso_kg, altura_cm, alongamento_cm, observacoes } = req.body;

  if (!peso_kg || !altura_cm) {
    return res.status(400).json({
      error: 'Peso e Altura são obrigatórios.',
    });
  }

  const alturaM = altura_cm / 100;
  const imc = parseFloat((peso_kg / (alturaM * alturaM)).toFixed(2));

  const sql = `
    INSERT INTO avaliacoes (
      aluno_id,
      peso_kg,
      altura_cm,
      imc,
      alongamento_cm,
      observacoes
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [aluno_id, peso_kg, altura_cm, imc, alongamento_cm || 0, observacoes],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        id: this.lastID,
        imc,
        message: 'Avaliação registrada com sucesso!',
      });
    }
  );
});

// Webhook Efí Pay: notificação de pagamento
app.post('/api/webhooks/efi', (req, res) => {
  const pixEventos = req.body.pix;

  if (Array.isArray(pixEventos) && pixEventos.length > 0) {
    pixEventos.forEach((pix) => {
      const txid = pix.txid;
      const remetenteNome = pix.pagador
        ? pix.pagador.nome
        : 'Não informado';
      const remetenteCpf = pix.pagador ? pix.pagador.cpf : '';
      const valor = pix.valor;

      db.run(
        `UPDATE alunos
         SET status_mensalidade = 'PAGO'
         WHERE responsavel_cpf = ?
           AND responsavel_cpf != ''`,
        [remetenteCpf],
        (err) => {
          if (err) {
            console.error(
              'Erro ao atualizar aluno via Webhook:',
              err.message
            );
          }
        }
      );

      db.run(
        `INSERT INTO mensalidades (
          aluno_id,
          mes_referencia,
          valor,
          status,
          txid,
          remetente_nome,
          remetente_cpf,
          data_pagamento
        )
        VALUES (
          (SELECT id FROM alunos WHERE responsavel_cpf = ? LIMIT 1),
          strftime('%m/%Y', 'now'),
          ?,
          'PAGO',
          ?,
          ?,
          ?,
          datetime('now')
        )`,
        [remetenteCpf, valor, txid, remetenteNome, remetenteCpf],
        (err) => {
          if (err) {
            console.error('Erro ao registrar mensalidade:', err.message);
          } else {
            console.log(
              `Pagamento PIX registrado: ${remetenteNome} (R$ ${valor})`
            );
          }
        }
      );
    });
  }

  res.status(200).send('OK');
});

// Baixa manual de pagamento
app.post('/api/alunos/:id/pagamento-manual', (req, res) => {
  const aluno_id = req.params.id;
  const { status, valor } = req.body;
  const novoStatus = status || 'PAGO';

  db.run(
    'UPDATE alunos SET status_mensalidade = ? WHERE id = ?',
    [novoStatus, aluno_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      if (novoStatus === 'PAGO') {
        db.run(
          `INSERT INTO mensalidades (
            aluno_id,
            mes_referencia,
            valor,
            status,
            remetente_nome,
            data_pagamento
          )
          VALUES (
            ?,
            strftime('%m/%Y', 'now'),
            ?,
            'PAGO',
            'Pagamento Manual em Dinheiro',
            datetime('now')
          )`,
          [aluno_id, valor || 0]
        );
      }

      res.json({
        message: `Status de pagamento atualizado para ${novoStatus}!`,
      });
    }
  );
});
// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});