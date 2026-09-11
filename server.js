const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexão e Inicialização do Banco de Dados SQLite
const db = new sqlite3.Database(path.join(__dirname, 'escolinha.db'), (err) => {
    if (err) console.error('Erro ao conectar ao banco de dados:', err);
    else console.log('Conectado ao banco de dados SQLite.');
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// Criar Tabelas
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
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
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
    CREATE TABLE IF NOT EXISTS avaliacoes_fisicas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id INTEGER NOT NULL,
      data_avaliacao TEXT NOT NULL,
      peso_kg REAL NOT NULL,
      altura_cm REAL NOT NULL,
      imc REAL NOT NULL,
      alongamento_cm REAL,
      observacoes TEXT,
      FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS metricas_customizadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avaliacao_id INTEGER NOT NULL,
      nome_metrica TEXT NOT NULL,
      valor TEXT NOT NULL,
      FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes_fisicas(id) ON DELETE CASCADE
    )
  `);
});

// ROTAS DE ALUNOS E RESPONSÁVEIS

// POST /api/alunos - Cadastrar Aluno e Responsável
app.post('/api/alunos', async (req, res) => {
    try {
        const { nome, data_nascimento, posicao, turma, foto_url, observacoes_medicas, responsavel } = req.body;

        if (!nome || !data_nascimento || !responsavel || !responsavel.nome || !responsavel.telefone_whatsapp) {
            return res.status(400).json({ error: 'Campos obrigatórios do aluno e responsável não preenchidos.' });
        }

        const alunoResult = await dbRun(
            `INSERT INTO alunos (nome, data_nascimento, posicao, turma, foto_url, observacoes_medicas) VALUES (?, ?, ?, ?, ?, ?)`,
            [nome, data_nascimento, posicao || '', turma || '', foto_url || '', observacoes_medicas || '']
        );

        const alunoId = alunoResult.lastID;

        await dbRun(
            `INSERT INTO responsaveis (aluno_id, nome, parentesco, telefone_whatsapp, cpf) VALUES (?, ?, ?, ?, ?)`,
            [alunoId, responsavel.nome, responsavel.parentesco || '', responsavel.telefone_whatsapp, responsavel.cpf || '']
        );

        res.status(201).json({ id: alunoId, message: 'Aluno e responsável cadastrados com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao cadastrar aluno: ' + error.message });
    }
});

// GET /api/alunos - Listar todos os alunos (com busca por nome ou turma)
app.get('/api/alunos', async (req, res) => {
    try {
        const { busca, turma } = req.query;
        let sql = `
      SELECT a.*, r.nome as responsavel_nome, r.telefone_whatsapp, r.parentesco 
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

        const alunos = await dbAll(sql, params);
        res.json(alunos);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar alunos: ' + error.message });
    }
});

// GET /api/alunos/:id - Detalhes do Aluno + Responsável
app.get('/api/alunos/:id', async (req, res) => {
    try {
        const aluno = await dbGet(`SELECT * FROM alunos WHERE id = ?`, [req.params.id]);
        if (!aluno) return res.status(404).json({ error: 'Aluno não encontrado.' });

        const responsavel = await dbGet(`SELECT * FROM responsaveis WHERE aluno_id = ?`, [req.params.id]);
        const avaliacoes = await dbAll(`SELECT * FROM avaliacoes_fisicas WHERE aluno_id = ? ORDER BY data_avaliacao DESC`, [req.params.id]);

        res.json({ ...aluno, responsavel, avaliacoes });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao obter dados do aluno: ' + error.message });
    }
});

// PUT /api/alunos/:id - Atualizar dados do Aluno e Responsável
app.put('/api/alunos/:id', async (req, res) => {
    try {
        const { nome, data_nascimento, posicao, turma, foto_url, observacoes_medicas, responsavel } = req.body;
        const alunoId = req.params.id;

        await dbRun(
            `UPDATE alunos SET nome = ?, data_nascimento = ?, posicao = ?, turma = ?, foto_url = ?, observacoes_medicas = ? WHERE id = ?`,
            [nome, data_nascimento, posicao, turma, foto_url, observacoes_medicas, alunoId]
        );

        if (responsavel) {
            await dbRun(
                `UPDATE responsaveis SET nome = ?, parentesco = ?, telefone_whatsapp = ?, cpf = ? WHERE aluno_id = ?`,
                [responsavel.nome, responsavel.parentesco, responsavel.telefone_whatsapp, responsavel.cpf, alunoId]
            );
        }

        res.json({ message: 'Dados atualizados com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar aluno: ' + error.message });
    }
});

// DELETE /api/alunos/:id - Excluir Aluno
app.delete('/api/alunos/:id', async (req, res) => {
    try {
        await dbRun(`DELETE FROM alunos WHERE id = ?`, [req.params.id]);
        res.json({ message: 'Aluno removido com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir aluno: ' + error.message });
    }
});

// ROTAS DE AVALIAÇÕES FÍSICAS

// POST /api/alunos/:id/avaliacoes - Criar Avaliação Física com cálculo automático de IMC
app.post('/api/alunos/:id/avaliacoes', async (req, res) => {
    try {
        const alunoId = req.params.id;
        const { data_avaliacao, peso_kg, altura_cm, alongamento_cm, observacoes, metricas_customizadas } = req.body;

        if (!peso_kg || !altura_cm) {
            return res.status(400).json({ error: 'Peso e Altura são obrigatórios.' });
        }

        // Cálculo automático de IMC: peso / (altura em metros)^2
        const alturaM = altura_cm / 100;
        const imc = Number((peso_kg / (alturaM * alturaM)).toFixed(2));
        const dataFinal = data_avaliacao || new Date().toISOString().split('T')[0];

        const avaliacaoResult = await dbRun(
            `INSERT INTO avaliacoes_fisicas (aluno_id, data_avaliacao, peso_kg, altura_cm, imc, alongamento_cm, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [alunoId, dataFinal, peso_kg, altura_cm, imc, alongamento_cm || 0, observacoes || '']
        );

        const avaliacaoId = avaliacaoResult.lastID;

        // Inserir Métricas Customizadas (se houver)
        if (metricas_customizadas && Array.isArray(metricas_customizadas)) {
            for (const metrica of metricas_customizadas) {
                if (metrica.nome_metrica && metrica.valor) {
                    await dbRun(
                        `INSERT INTO metricas_customizadas (avaliacao_id, nome_metrica, valor) VALUES (?, ?, ?)`,
                        [avaliacaoId, metrica.nome_metrica, metrica.valor]
                    );
                }
            }
        }

        res.status(201).json({ id: avaliacaoId, imc, message: 'Avaliação física registrada com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao registrar avaliação: ' + error.message });
    }
});

// GET /api/alunos/:id/avaliacoes - Obter Histórico de Avaliações
app.get('/api/alunos/:id/avaliacoes', async (req, res) => {
    try {
        const avaliacoes = await dbAll(
            `SELECT * FROM avaliacoes_fisicas WHERE aluno_id = ? ORDER BY data_avaliacao DESC`,
            [req.params.id]
        );

        // Carregar métricas customizadas para cada avaliação
        for (let avaliacao of avaliacoes) {
            const custom = await dbAll(
                `SELECT nome_metrica, valor FROM metricas_customizadas WHERE avaliacao_id = ?`,
                [avaliacao.id]
            );
            avaliacao.metricas_customizadas = custom;
        }

        res.json(avaliacoes);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar avaliações: ' + error.message });
    }
});

// DELETE /api/avaliacoes/:id - Excluir Avaliação
app.delete('/api/avaliacoes/:id', async (req, res) => {
    try {
        await dbRun(`DELETE FROM avaliacoes_fisicas WHERE id = ?`, [req.params.id]);
        res.json({ message: 'Avaliação removida com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir avaliação: ' + error.message });
    }
});

// Iniciar o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});

