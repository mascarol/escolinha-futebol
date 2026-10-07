const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "escolinha.db");
const db = new sqlite3.Database(dbPath);

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

const alunosTeste = [
  {
    nome: "Lucas Silva",
    nasc: "2019-05-12",
    pos: "Atacante",
    resp: "Roberto Silva",
    tel: "11988880001",
    cpf: "111.222.333-01",
  },
  {
    nome: "Enzo Gabriel",
    nasc: "2019-02-20",
    pos: "Meio-Campo",
    resp: "Mariana Gabriel",
    tel: "11988880002",
    cpf: "111.222.333-02",
  },
  {
    nome: "Gabriel Souza",
    nasc: "2017-08-15",
    pos: "Goleiro",
    resp: "Carlos Souza",
    tel: "11988880003",
    cpf: "111.222.333-03",
  },
  {
    nome: "Matheus Lima",
    nasc: "2017-11-03",
    pos: "Lateral Direito",
    resp: "Fernanda Lima",
    tel: "11988880004",
    cpf: "111.222.333-04",
  },
  {
    nome: "Pedro Henrique",
    nasc: "2015-04-10",
    pos: "Zagueiro",
    resp: "Juliana Henrique",
    tel: "11988880005",
    cpf: "111.222.333-05",
  },
  {
    nome: "Felipe Alves",
    nasc: "2015-09-25",
    pos: "Meio-Campo",
    resp: "Ricardo Alves",
    tel: "11988880006",
    cpf: "111.222.333-06",
  },
  {
    nome: "Guilherme Santos",
    nasc: "2015-01-18",
    pos: "Atacante",
    resp: "Patricia Santos",
    tel: "11988880007",
    cpf: "111.222.333-07",
  },
  {
    nome: "Arthur Costa",
    nasc: "2013-06-30",
    pos: "Volante",
    resp: "Marcelo Costa",
    tel: "11988880008",
    cpf: "111.222.333-08",
  },
  {
    nome: "Bernardo Oliveira",
    nasc: "2013-10-14",
    pos: "Lateral Esquerdo",
    resp: "Aline Oliveira",
    tel: "11988880009",
    cpf: "111.222.333-09",
  },
  {
    nome: "Nicolas Pereira",
    nasc: "2013-03-08",
    pos: "Zagueiro",
    resp: "Eduardo Pereira",
    tel: "11988880010",
    cpf: "111.222.333-10",
  },
  {
    nome: "Caio Ribeiro",
    nasc: "2011-07-22",
    pos: "Atacante",
    resp: "Camila Ribeiro",
    tel: "11988880011",
    cpf: "111.222.333-11",
  },
  {
    nome: "Vinicius Rocha",
    nasc: "2011-12-05",
    pos: "Goleiro",
    resp: "Fabio Rocha",
    tel: "11988880012",
    cpf: "111.222.333-12",
  },
  {
    nome: "Samuel Martins",
    nasc: "2009-08-19",
    pos: "Meio-Campo",
    resp: "Vanessa Martins",
    tel: "11988880013",
    cpf: "111.222.333-13",
  },
  {
    nome: "Daniel Ferreira",
    nasc: "2009-01-11",
    pos: "Zagueiro",
    resp: "Sandro Ferreira",
    tel: "11988880014",
    cpf: "111.222.333-14",
  },
  {
    nome: "Leonardo Gomez",
    nasc: "2009-04-02",
    pos: "Atacante",
    resp: "Luciana Gomez",
    tel: "11988880015",
    cpf: "111.222.333-15",
  },
];

const createTables = () => {
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

    alunosTeste.forEach((item) => {
      const turma = calcularTurmaPorData(item.nasc);

      db.run(
        `INSERT INTO alunos (nome, data_nascimento, posicao, turma, foto_url, observacoes_medicas)
         VALUES (?, ?, ?, ?, ?, ?)
        `,
        [item.nome, item.nasc, item.pos, turma, "", "Sem restrições"],
        function (err) {
          if (err) {
            console.error("Erro ao inserir aluno:", err.message);
            return;
          }

          const alunoId = this.lastID;

          db.run(
            `INSERT INTO responsaveis (aluno_id, nome, parentesco, telefone_whatsapp, cpf)
             VALUES (?, ?, ?, ?, ?)
            `,
            [alunoId, item.resp, "Pai/Mãe", item.tel, item.cpf],
            function (responsavelErr) {
              if (responsavelErr) {
                console.error(
                  `Erro ao inserir responsável para ${item.nome}:`,
                  responsavelErr.message,
                );
              }
            },
          );
        },
      );
    });

    console.log("✅ 15 alunos e responsáveis cadastrados com sucesso!");
  });
};

createTables();
