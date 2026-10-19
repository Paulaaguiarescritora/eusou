/**
 * EuSou - Controle de Concorrência e Lock de Execução
 * F17-A.1: Disaster Recovery & Backup Strategy
 *
 * Garante que duas execuções simultâneas de backup não colidam nem corrompam dados.
 */

const fs = require('fs');
const path = require('path');

const LOCK_FILE = path.resolve(__dirname, '../../backups/.backup.lock');
const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutos

class ConcurrencyLock {
  static isProcessAlive(pid) {
    try {
      // Em Node.js no Windows/Linux, process.kill(pid, 0) checa se o processo existe
      return process.kill(pid, 0);
    } catch (e) {
      return e.code === 'EPERM'; // Existe, mas sem permissão de matar -> está vivo
    }
  }

  static acquire(operationName = 'BACKUP') {
    const backupDir = path.dirname(LOCK_FILE);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    if (fs.existsSync(LOCK_FILE)) {
      try {
        const content = fs.readFileSync(LOCK_FILE, 'utf8');
        const lockInfo = JSON.parse(content);
        const age = Date.now() - new Date(lockInfo.acquiredAt).getTime();

        // Se o processo ainda está rodando e o lock está dentro do TTL, bloqueia
        if (this.isProcessAlive(lockInfo.pid) && age < LOCK_TTL_MS) {
          console.warn(`[CONCURRENCY-LOCK] Bloqueio ativo detectado: Operação "${lockInfo.operation}" iniciada em ${lockInfo.acquiredAt} (PID: ${lockInfo.pid}).`);
          return {
            acquired: false,
            reason: 'LOCKED',
            activeLock: lockInfo
          };
        }

        console.warn(`[CONCURRENCY-LOCK] Lock obsoleto ou processo inativo (PID ${lockInfo.pid}, idade: ${Math.round(age / 1000)}s). Reivindicando lock...`);
      } catch (err) {
        console.warn(`[CONCURRENCY-LOCK] Lock inválido ou corrompido. Substituindo...`);
      }
    }

    const newLock = {
      pid: process.pid,
      operation: operationName,
      acquiredAt: new Date().toISOString()
    };

    fs.writeFileSync(LOCK_FILE, JSON.stringify(newLock, null, 2), 'utf8');
    return {
      acquired: true,
      lock: newLock
    };
  }

  static release() {
    if (fs.existsSync(LOCK_FILE)) {
      try {
        fs.unlinkSync(LOCK_FILE);
        return true;
      } catch (err) {
        console.error('[CONCURRENCY-LOCK] Erro ao liberar lock:', err.message);
        return false;
      }
    }
    return false;
  }
}

module.exports = { ConcurrencyLock };
