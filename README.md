# Atendimento WhatsApp do CIA

Backend Fastify/TypeScript com o fluxo do PDF `docs/TECNOImpacto_CIA_Partes_1-3.pdf`. Requer Node.js 24 ou superior.

## Executar

```sh
npm install
cp .env.example .env
# Preencha as credenciais e um segredo de sessão gerado com openssl rand -hex 32.
npm run dev
```

Produção: `npm run build` e `npm start`. Direcione o ngrok para `PORT` e configure na Meta uma callback de `WEBHOOK_PATHS`. O `META_VERIFY_TOKEN` precisa coincidir com o handshake da Meta.

## Deploy na VPS

O workflow `.github/workflows/deploy-vps.yml` publica cada push em `main` e também pode ser iniciado manualmente (`workflow_dispatch`). Ele sincroniza o código por SSH/rsync e faz o build com Docker na VPS; não usa registry e nunca envia o `.env` nem `data/` do runner. Os textos e configurações comuns ficam em `config/public-config.env`, versionado junto com o código e atualizado a cada deploy. Segredos e estado das sessões permanecem na VPS.

O repositório é público e `config/public-config.env` é intencionalmente público: qualquer pessoa pode lê-lo, mas apenas colaboradores com permissão de escrita podem editá-lo. Para mudar mensagens ou links pela interface do GitHub, abra esse arquivo, clique em **Edit**, altere os valores e faça commit na `main` (ou abra um PR, se a branch exigir revisão). O deploy automático sincroniza a alteração.

O workflow já aponta para o VPS2 (`163.176.195.173`, usuário `ubuntu`), usa a porta SSH 22 e publica em `~/whatsapp-webhook`. No GitHub Actions, configure somente o secret `SERVER_SSH_KEY`, a chave privada de deploy cuja chave pública está autorizada no VPS2. Não precisa cadastrar variables nem tokens da Meta no GitHub.

Na VPS, Docker com o plugin Docker Compose precisa estar instalado, e o usuário SSH precisa poder executar `docker compose`. O arquivo privado `~/whatsapp-webhook/.env` fica somente no VPS2 e contém `META_ACCESS_TOKEN`, `META_VERIFY_TOKEN` e `SESSION_HASH_SECRET` (gere este último com `openssl rand -hex 32`). Nenhum desses valores vai para GitHub Actions. Mantenha o arquivo com permissão `600`; o script de deploy reforça essa permissão. `config/public-config.env` fornece os outros valores, inclusive os textos do bot.

O container escuta em `8080` e publica somente em `127.0.0.1:18084` no VPS2, evitando conflito com serviços existentes. O Nginx do VPS2 compartilha a porta já liberada `8089` usando o `server_name` interno `cia-wpp.internal` e encaminha a rota ao container; o Nginx do VPS1 publica `https://pedro-duarte.ddns.net/cia-wpp/api` e a encaminha ao VPS2. Os arquivos de configuração usados estão em `scripts/deploy/nginx/`. O volume `~/whatsapp-webhook/data` guarda o estado das sessões e é preservado nas atualizações. Para mudar textos ou parâmetros comuns, edite `config/public-config.env` no repositório e faça push; o deploy os aplica automaticamente. O `.env` da VPS deve ficar apenas com segredos para não mascarar mudanças versionadas. Se reiniciar manualmente, use `APP_UID="$(id -u)" APP_GID="$(id -g)" docker compose --env-file config/public-config.env --env-file .env -f docker-compose.prod.yml up -d`.

## Fluxo

1. Grupo de pais: orientações, formulário e inclusão manual pela equipe.
2. Autistas adultos: apresentação e contato na própria conversa, seguidos de atendimento humano.
3. Acolhimento: perfil mãe/pai, familiar ou autista adulto; orientação de agendamento e atendimento humano.
4. Projeto Teativo: lista de espera.
5. Carteirinha: orientações e formulário.
6. Dúvidas: lista de perguntas e respostas configuradas; sem perguntas cadastradas, segue para a equipe.
7. Falar com uma pessoa: pausa o bot.

Os textos iniciais são propostas baseadas no PDF. Ajuste `CARD_MESSAGE` com os critérios e documentos oficiais quando a entidade os disponibilizar. Não existe uma opção de parcerias.

O menu, a triagem de perfil e as perguntas frequentes usam listas interativas do WhatsApp. As listas de perfil e dúvidas incluem “Voltar ao menu”; a lista de perfil também inclui “Falar com a equipe”. `menu` e os comandos de atendimento humano continuam como atalhos digitáveis. Duas entradas inválidas consecutivas recebem uma orientação mais direta. Respostas de listas antigas não são executadas quando não há sessão ativa.

## Configuração

O `.env.example` documenta todas as variáveis. As configurações ativas são obrigatórias e validadas na inicialização, sem valores padrão silenciosos. Exceções intencionais: URLs de formulários podem ficar vazias; `FAQ_ENTRIES` pode ser `[]`; `BOT_RESUME_COMMAND` é exigido apenas quando a retomada está habilitada.

Preencha os links oficiais:

- `PARENTS_GROUP_FORM_URL`: cadastro para o grupo de pais.
- `TEATIVO_WAITLIST_URL`: lista de espera do projeto.
- `CARD_FORM_URL`: solicitação da carteirinha.

São aceitas URLs HTTPS sem credenciais. Enquanto um link estiver vazio, o bot informa a indisponibilidade e deixa o atendimento com a equipe; não envia URLs fictícias.

Mensagens ficam em `BOT_*_MESSAGE`, `PARENTS_GROUP_MESSAGE`, `ADULTS_GROUP_MESSAGE`, `TEATIVO_MESSAGE`, `CARD_MESSAGE`, `WELCOME_PROFILE_MESSAGE`, `WELCOME_CONFIRMATION_MESSAGE`, `FAQ_TITLE` e `FAQ_EMPTY_MESSAGE`. Os títulos das opções ficam em `MENU_LABEL_*` e `PROFILE_LABEL_*`. Strings entre aspas duplas aceitam `\n` para quebras de linha. A confirmação do acolhimento aceita `{{profile}}`, apenas para compor a resposta enviada.

`FAQ_ENTRIES` recebe um array JSON de `{ "id": "identificador", "question": "Pergunta aprovada", "answer": "Resposta aprovada" }`. IDs e perguntas não podem se repetir. São aceitas até 9 perguntas porque a décima linha da lista é reservada para “Voltar ao menu”. Cada pergunta deve caber no limite de título da lista. Não há respostas geradas por IA nem coleta de dados para cadastro dentro do bot.

## Atendimento humano

`BOT_HUMAN_COMMANDS` define as palavras para pedir uma pessoa. A passagem para humano significa pausar a automação e manter a conversa no WhatsApp Business da equipe. Não atribui a conversa a um voluntário nem envia notificações externas.

A pausa é persistida e sobrevive ao reinício. Mensagens da pessoa e ecos de respostas enviadas pela equipe renovam a atividade. Após 24 horas sem atividade, a próxima mensagem retorna ao menu automaticamente. `menu` continua disponível como retomada imediata opcional.

A retomada imediata por `menu` é opcional. Mesmo sem ela, a sessão volta ao menu automaticamente após 24 horas sem atividade do usuário ou da equipe.

Ecos da equipe atualizam a pausa humana; reações e mensagens de status são ignoradas. Imagens, áudios, documentos e outros tipos de mensagem sem texto recebem uma orientação para usar as opções. Uma resposta da equipe pelo WhatsApp Business também pausa a automação para aquele contato.

## Arquitetura

O padrão State é aplicado como máquina de estados finitos com registros declarativos de handlers. O motor é uma função pura: recebe sessão e conteúdo de entrada e devolve o próximo estado e as mensagens. Não faz HTTP nem escreve arquivos.

- `domain/attendance/`: estados e contratos do domínio.
- `flows/cia/`: opções, transições e handlers por responsabilidade; sem uma classe por pergunta.
- `config/`: leitura e validação de infraestrutura, conteúdo, links e políticas.
- `services/`: aplicação das transições e cliente da Meta.
- `repositories/`: estado mínimo e deduplicação.
- `routes/`: handshake e recebimento de mensagens.
- `constants/`, `errors/`, `utils/`, `types/`: protocolos, regex, erros, funções comuns e contratos de transporte.

A estrutura e as transições são tipadas em código. Conteúdo e políticas operacionais ficam no ambiente. Apenas `server.ts` lê `process.env`.

## Estado técnico e privacidade

O estado persistido contém somente identificadores HMAC, estado, timestamps e um contador de tentativas inválidas. Não guarda telefone em texto, mensagens, nomes, perfil de acolhimento, respostas, documentos ou laudos. Os dados enviados pela pessoa permanecem na conversa do WhatsApp e são tratados pela equipe. Identificadores técnicos são pseudonimizados, não anônimos.

`SESSION_HASH_SECRET` deve ser aleatório, privado e estável entre reinícios. Alterá-lo perde a associação com as sessões anteriores, inclusive pausas humanas. Faça a alteração apenas como operação planejada.

- `SESSION_TTL_SECONDS`: inatividade máxima de qualquer sessão, inclusive pausa humana.
- `DEDUPLICATION_TTL_SECONDS`: validade dos identificadores de mensagens processadas.
- `DEDUPLICATION_LIMIT`: limite de identificadores recentes.
- `SESSION_CLEANUP_INTERVAL_SECONDS`: frequência da limpeza, também executada na inicialização e ao gravar mensagens.
- `STATE_FILE`: arquivo de estado; exemplo `./data/sessions.json`.

O arquivo atual usa o formato v3. Arquivos de versões anteriores são rejeitados sem serem sobrescritos; se ainda houver um, aponte `STATE_FILE` para um arquivo novo e trate o antigo conforme a política da entidade. Use um diretório persistente e uma única instância por arquivo. Múltiplas réplicas precisam de um banco compartilhado e coordenação de processamento.

Mensagens de uma mesma transição são agrupadas num único envio sempre que os limites de tamanho da Meta permitem; listas interativas mantêm sua seleção tocável. Textos que excedam o limite são divididos. A fila serializa processamento e gravação; o arquivo é substituído atomicamente. Falhas retornam `503` para permitir retries; IDs já processados são deduplicados. Um crash após a Meta aceitar o envio e antes da gravação local ainda pode repetir uma resposta, pois as duas operações não são uma transação única.

## Verificar

```sh
npm run format:check
npm run typecheck
npm test
npm run build
```

Os testes usam arquivos temporários e simulam a Meta. Não enviam mensagens reais.
