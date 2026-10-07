const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// Conexão com o banco de dados SQLite
const dbPath = path.resolve(__dirname, "escolinha.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Erro ao conectar ao banco:", err.message);
  else console.log("Conectado ao banco de dados SQLite.");
});

// Funções auxiliares com Promises para suporte a async/await
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// 📍 INSERIR AQUI A FUNÇÃO DE CÁLCULO DA TURMA 📍
function calcularTurmaPorData(dataNascimento) {
  if (!dataNascimento) return "Não informada";
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();

  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }

  if (idade <= 7) return "Sub-7";
  if (idade <= 9) return "Sub-9";
  if (idade <= 11) return "Sub-11";
  if (idade <= 13) return "Sub-13";
  if (idade <= 15) return "Sub-15";
  return "Sub-17";
}

// Criar tabelas se não existirem
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS alunos(
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
    CREATE TABLE IF NOT EXISTS responsaveis(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        parentesco TEXT,
        telefone_whatsapp TEXT NOT NULL,
        cpf TEXT,
        FOREIGN KEY(aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
    )
    `);

  db.run(`
    CREATE TABLE IF NOT EXISTS avaliacoes(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        peso_kg REAL NOT NULL,
        altura_cm REAL NOT NULL,
        imc REAL NOT NULL,
        alongamento_cm REAL,
        observacoes TEXT,
        data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
    )
    `);

  db.run(`
    CREATE TABLE IF NOT EXISTS metricas_customizadas(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        avaliacao_id INTEGER NOT NULL,
        nome_metrica TEXT NOT NULL,
        valor TEXT NOT NULL,
        FOREIGN KEY(avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE
    )
    `);
});

// ======================================================
// 1. ROTA DE LOGIN UNIFICADO (Campo Único)
// ======================================================
app.post("/api/login", async (req, res) => {
  try {
    const { credencial, senha } = req.body;
    const entradaLimpa = String(credencial ?? senha ?? "").trim();

    if (!entradaLimpa) {
      return res
        .status(400)
        .json({ error: "Por favor, digite a senha do treinador." });
    }

    if (entradaLimpa === "1234") {
      return res.json({ sucesso: true, tipo: "professor", nome: "Treinador" });
    }

    return res.status(401).json({
      error: "Acesso restrito ao treinador.",
    });
  } catch (error) {
    res.status(500).json({ error: "Erro no servidor: " + error.message });
  }
});

// ======================================================
// 2. ROTAS DE ALUNOS E RESPONSÁVEIS
// ======================================================

// GET /api/alunos - Listar todos os alunos (com busca e filtro de turma)
app.get("/api/alunos", async (req, res) => {
  try {
    const { busca, turma } = req.query;
    let sql = `
      SELECT a.*, r.nome as responsavel_nome, r.telefone_whatsapp, r.parentesco, r.cpf as responsavel_cpf
      FROM alunos a 
      LEFT JOIN responsaveis r ON a.id = r.aluno_id
      WHERE 1 = 1
    `;
    const params = [];

    if (busca) {
      sql += ` AND a.nome LIKE ? `;
      params.push(`% ${busca}% `);
    }

    if (turma) {
      sql += ` AND a.turma = ? `;
      params.push(turma);
    }

    sql += ` ORDER BY a.nome ASC`;

    const alunos = await dbAll(sql, params);
    res.json(alunos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar alunos: " + error.message });
  }
});

// GET /api/alunos/:id - Detalhes de um Aluno
app.get("/api/alunos/:id", async (req, res) => {
  try {
    const sql = `
      SELECT a.*, r.nome as responsavel_nome, r.telefone_whatsapp, r.parentesco, r.cpf as responsavel_cpf
      FROM alunos a
      LEFT JOIN responsaveis r ON a.id = r.aluno_id
      WHERE a.id = ?
    `;
    const aluno = await dbGet(sql, [req.params.id]);
    if (!aluno) return res.status(404).json({ error: "Aluno não encontrado." });
    res.json(aluno);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erro ao obter dados do aluno: " + error.message });
  }
});

// POST /api/alunos - Cadastrar Aluno e Responsável
app.post("/api/alunos", async (req, res) => {
  try {
    const {
      nome,
      data_nascimento,
      posicao,
      turma,
      foto_url,
      observacoes_medicas,
      responsavel,
    } = req.body;

    if (
      !nome ||
      !data_nascimento ||
      !responsavel ||
      !responsavel.nome ||
      !responsavel.telefone_whatsapp
    ) {
      return res.status(400).json({
        error: "Campos obrigatórios do aluno e responsável não preenchidos.",
      });
    }

    const alunoResult = await dbRun(
      `INSERT INTO alunos(nome, data_nascimento, posicao, turma, foto_url, observacoes_medicas) VALUES(?, ?, ?, ?, ?, ?)`,
      [
        nome,
        data_nascimento,
        posicao || "",
        turma || "",
        foto_url || "",
        observacoes_medicas || "",
      ],
    );

    res.status(201).json({
      id: alunoResult.lastID,
      message: "Aluno e responsável cadastrados com sucesso!",
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erro ao cadastrar aluno: " + error.message });
  }
});

// ======================================================
// 3. ROTAS DE AVALIAÇÕES FÍSICAS
// ======================================================

// POST /api/alunos/:id/avaliacoes - Salvar Avaliação Física
app.post("/api/alunos/:id/avaliacoes", async (req, res) => {
  try {
    const alunoId = req.params.id;
    const {
      peso_kg,
      altura_cm,
      alongamento_cm,
      observacoes,
      metricas_customizadas,
    } = req.body;

    if (!peso_kg || !altura_cm) {
      return res.status(400).json({ error: "Peso e altura são obrigatórios." });
    }

    const alturaM = altura_cm / 100;
    const imc = parseFloat((peso_kg / (alturaM * alturaM)).toFixed(2));

    const avalResult = await dbRun(
      `INSERT INTO avaliacoes(aluno_id, peso_kg, altura_cm, imc, alongamento_cm, observacoes) VALUES(?, ?, ?, ?, ?, ?)`,
      [
        alunoId,
        peso_kg,
        altura_cm,
        imc,
        alongamento_cm || 0,
        observacoes || "",
      ],
    );

    const avaliacaoId = avalResult.lastID;

    if (metricas_customizadas && metricas_customizadas.length > 0) {
      for (const m of metricas_customizadas) {
        await dbRun(
          `INSERT INTO metricas_customizadas(avaliacao_id, nome_metrica, valor) VALUES(?, ?, ?)`,
          [avaliacaoId, m.nome_metrica, m.valor],
        );
      }
    }

    res.status(201).json({
      id: avaliacaoId,
      imc,
      message: "Avaliação física salva com sucesso!",
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erro ao salvar avaliação: " + error.message });
  }
});

// GET /api/alunos/:id/avaliacoes - Listar Histórico de Avaliações
app.get("/api/alunos/:id/avaliacoes", async (req, res) => {
  try {
    const alunoId = req.params.id;
    const avaliacoes = await dbAll(
      `SELECT * FROM avaliacoes WHERE aluno_id = ? ORDER BY data_avaliacao DESC`,
      [alunoId],
    );

    for (const aval of avaliacoes) {
      const metricas = await dbAll(
        `SELECT nome_metrica, valor FROM metricas_customizadas WHERE avaliacao_id = ? `,
        [aval.id],
      );
      aval.metricas_customizadas = metricas || [];
    }

    res.json(avaliacoes);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erro ao buscar avaliações: " + error.message });
  }
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`Servidor Fantasminha FC rodando na porta ${PORT} `);
});
