# F17-A.1 — Relatório da Suíte de Testes de Falhas e Resiliência

**Data da Execução**: 13/10/2026  
**Script Executado**: `scripts/backup/test-failures.js` (`npm run db:test-failures`)  
**Resultado Geral**: **100% DE APROVAÇÃO (4 DE 4 TESTES RESILIENTES)**

---

## 1. Objetivo dos Testes de Falha

Comprovar que o sistema de backup e recuperação não assume premissas ingênuas de disponibilidade e reage de forma segura a cenários adversos de infraestrutura, garantindo que:
- Falhas remotas sejam capturadas imediatamente;
- Nenhum backup incompleto ou falho seja registrado como sucesso;
- A última cópia válida de backup local e remota nunca seja destruída por uma tentativa fracassada;
- Nenhuma credencial ou segredo vaze em mensagens de erro ou logs;
- Concorrência de processos seja bloqueada com segurança.

---

## 2. Cenários Simulados e Resultados Auditados

### Cenário 1: Storage Off-Site Indisponível (Queda de Rede / Host Inacessível)
- **Simulação:** Tentativa de upload apontando para uma porta de rede inexistente (`http://127.0.0.1:59999`).
- **Comportamento Esperado:** Capturar exceção de rede (`fetch failed` / `ECONNREFUSED`), abortar o upload, emitir log `UPLOAD_FAILED` e não apagar nenhum arquivo anterior.
- **Resultado Obtido:** **APROVADO (PASS)**. O sistema capturou o erro de conexão imediatamente, não gravou falso positivo e preservou a integridade dos arquivos locais.

---

### Cenário 2: Credencial de Acesso Inválida (Autenticação Rejeitada)
- **Simulação:** Tentativa de envio para o cofre remoto utilizando token incorreto (`token_falso_invalido_12345`).
- **Comportamento Esperado:** O servidor de storage deve rejeitar a requisição com `HTTP 401 Unauthorized` e mensagem sanitizada, sem exibir o token correto nem o token falso em logs desprotegidos.
- **Resultado Obtido:** **APROVADO (PASS)**. O servidor remoto respondeu `HTTP 401` com `{"error":"Unauthorized"}`, a operação foi cancelada e nenhuma informação confidencial foi vazada.

---

### Cenário 3: Arquivo Corrompido / Checksum SHA-256 Divergente
- **Simulação:** Envio de arquivo com cabeçalho `X-Object-Sha256` deliberadamente adulterado (`hash_falso_adulterado_...`), simulando corrupção de disco ou manipulação de trânsito.
- **Comportamento Esperado:** O storage deve recalcular o hash SHA-256 do fluxo de bytes recebido, identificar a divergência, excluir imediatamente o arquivo corrompido e responder `HTTP 400 Bad Request` (`ChecksumMismatch`).
- **Resultado Obtido:** **APROVADO (PASS)**. O servidor retornou `HTTP 400` com a mensagem `SHA-256 divergente`, destruiu o arquivo corrompido em disco e impediu o armazenamento de dados corrompidos.

---

### Cenário 4: Execução Concorrente Simultânea (Controle de Lock)
- **Simulação:** Um primeiro processo adquire o lock de execução (`LOCK_ACQUIRED`). Um segundo processo tenta iniciar a rotina de backup em paralelo.
- **Comportamento Esperado:** O segundo processo deve detectar a trava ativa (`backups/.backup.lock`), registrar `EVENT=LOCK_BLOCKED`, não executar o dump e sair com código de erro controlado (`exit code 2`), sem sobrescrever o lock do primeiro.
- **Resultado Obtido:** **APROVADO (PASS)**. O primeiro lock foi concedido (`acquired: true`); a segunda tentativa foi recusada (`acquired: false`, `reason: 'LOCKED'`). Ao término da operação, o lock foi liberado perfeitamente (`LOCK_RELEASED`).

---

## 3. Matriz de Resultados

| # | Teste de Resiliência | Exceção Esperada | Exceção Capturada | Status |
|---|---|---|---|:---:|
| **1** | Storage Indisponível | Falha de conexão de rede | `fetch failed` | **PASS** |
| **2** | Credencial Inválida | Rejeição HTTP 401 | `HTTP 401 Unauthorized` | **PASS** |
| **3** | Hash Adulterado | Rejeição HTTP 400 | `ChecksumMismatch (HTTP 400)` | **PASS** |
| **4** | Concorrência Dupla | Recusa por Lock Ativo | `acquired: false (LOCKED)` | **PASS** |
