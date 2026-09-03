CONTABILIZADOR YEXUX V2.1.1 - SERVICO CENTRAL DE CONVITES

OBJETIVO
- link curto: https://SEU-WORKER/ativar/4839217462
- codigo aleatorio de 10 digitos
- uso unico, validade, cancelamento e status central
- o R2 continua hospedando CONTABILIZADOR_YEXUX_SETUP.exe

ARQUIVOS
- worker.js: Cloudflare Worker
- schema.sql: estrutura do banco D1
- wrangler.toml.example: exemplo de configuracao

CONFIGURACAO RESUMIDA
1. Criar um banco D1 chamado yexux-convites.
2. Executar schema.sql no D1.
3. Publicar worker.js com binding DB para esse banco.
4. Criar uma chave administrativa forte e salvar como secret ADMIN_KEY do Worker.
5. Na Gestao de Usuarios e Acessos do YEXUX, informar:
   - URL HTTPS do Worker
   - a mesma chave administrativa
   - URL publica do CONTABILIZADOR_YEXUX_SETUP.exe no R2
6. Gerar um convite novo.

IMPORTANTE
A chave ADMIN_KEY fica somente no Worker e no computador Administrador.
Nao deve ser enviada aos colaboradores nem colocada no R2.
