const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

let botProcess = null;
let restartCount = 0;
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY = 5 * 1000; // 5 saniye
const RESTART_COOLDOWN = 60 * 1000; // 60 saniye (çok sık kilitlenmeyi önlemek için)

const LOG_FILE = path.join(__dirname, 'bot.log');
const CHILD_LOG_FILE = path.join(__dirname, 'bot-child.log');

function log(message) {
  const timestamp = new Date().toLocaleString('tr-TR');
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage);
  
  // Log dosyasına yaz
  fs.appendFile(LOG_FILE, logMessage, (err) => {
    if (err) console.error('Log yazma hatası:', err);
  });
}

function startBot() {
  if (botProcess && !botProcess.killed) {
    console.log('⚠️ Bot zaten çalışıyor.');
    return;
  }

  log('🚀 Bot başlatılıyor...');
  
  botProcess = spawn('node', [path.join(__dirname, 'index.js')], {
    stdio: 'pipe',
    detached: false,
    env: process.env
  });

  // Child process çıktısını dosyaya yönlendir
  const childStdout = fs.createWriteStream(CHILD_LOG_FILE, { flags: 'a' });
  
  botProcess.stdout.pipe(childStdout);
  botProcess.stderr.pipe(childStdout);

  botProcess.on('exit', (code, signal) => {
    log(`⚠️ Bot process çıktı (Code: ${code}, Signal: ${signal})`);
    if (childStdout) childStdout.end();
    restartCount++;

    if (restartCount <= MAX_RESTART_ATTEMPTS) {
      log(`🔄 Yeniden başlatılıyor... (Deneme: ${restartCount}/${MAX_RESTART_ATTEMPTS})`);
      setTimeout(startBot, RESTART_DELAY);
    } else {
      log('❌ Maksimum yeniden başlatma sayısına ulaşıldı. Beklemede...');
      log(`⏳ ${RESTART_COOLDOWN / 1000} saniye sonra yeniden deneme...`);
      restartCount = 0;
      setTimeout(startBot, RESTART_COOLDOWN);
    }
  });

  botProcess.on('error', (error) => {
    log(`❌ Bot process hatası: ${error.message}`);
  });

  restartCount = 0;
}

function stopBot() {
  if (botProcess && !botProcess.killed) {
    log('📴 Bot durduruluyor...');
    botProcess.kill('SIGTERM');
    
    setTimeout(() => {
      if (botProcess && !botProcess.killed) {
        log('⚠️ Bot SIGKILL ile kapatılıyor...');
        botProcess.kill('SIGKILL');
      }
    }, 5000);
  }
}

// Sinyalleri Dinle
process.on('SIGINT', () => {
  log('📴 Manager SIGINT aldı. Kapatılıyor...');
  stopBot();
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
  log('📴 Manager SIGTERM aldı. Kapatılıyor...');
  stopBot();
  setTimeout(() => process.exit(0), 1000);
});

// İçerideki hataları yakala
process.on('uncaughtException', (error) => {
  log(`❌ Manager uncaughtException: ${error.message}`);
});

process.on('unhandledRejection', (reason) => {
  log(`❌ Manager unhandledRejection: ${reason}`);
});

// Başlangıçta Botu Başlat
log('═══════════════════════════════════════');
log('🤖 Discord Bot Manager Başlatıldı');
log('═══════════════════════════════════════');
startBot();

// Periyodik Kontrol - Bot çalışıp çalışmadığını kontrol et
setInterval(() => {
  if (!botProcess || botProcess.killed) {
    log('⚠️ Bot çalışmıyor! Başlatılıyor...');
    startBot();
  }
}, 30 * 1000); // 30 saniye

module.exports = { startBot, stopBot };
