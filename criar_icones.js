const fs = require('fs');
const path = require('path');

// Garante que a pasta public existe
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Cria um PNG simples válido (1x1 transparente estendido)
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const buffer = Buffer.from(pngBase64, 'base64');

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), buffer);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), buffer);

console.log("✔ Ícones gerados com sucesso na pasta public!");