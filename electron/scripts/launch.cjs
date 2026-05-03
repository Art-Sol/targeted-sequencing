// Launcher: запускает Electron с гарантированно очищенной переменной
// ELECTRON_RUN_AS_NODE. Если она выставлена в окружении (что бывает после
// прошлых проектов или тулов вроде `nx`), Electron стартует в режиме
// «обычный Node.js» — без `app`, `BrowserWindow` и всего Electron API.

delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const path = require('path');
const electronBin = require('electron');

const mainScript = path.join(__dirname, '..', 'dist', 'main.js');

const child = spawn(electronBin, [mainScript], {
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code) => process.exit(code ?? 1));
