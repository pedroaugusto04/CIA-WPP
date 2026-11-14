import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config/env.js';
import { AttendanceState as State } from '../src/domain/attendance/types.js';
import { transitionAttendance as runTransition } from '../src/flows/cia/attendance-machine.js';
import type { AttendanceConfig, Session } from '../src/domain/attendance/types.js';
import { SessionRepository } from '../src/repositories/session-repository.js';
import { AttendanceService } from '../src/services/attendance-service.js';
import { extractMessages } from '../src/services/webhook-parser.js';
import { buildApp } from '../src/app.js';
import { combineOutboundMessages } from '../src/utils/outbound-message.js';

const environment = {
  ...parseEnv(readFileSync(new URL('../.env.example', import.meta.url), 'utf8')),
  HOST: '127.0.0.1',
  LOG_LEVEL: 'silent',
  WHATSAPP_PHONE_NUMBER_ID: '123',
  META_ACCESS_TOKEN: 'test',
  META_VERIFY_TOKEN: 'verify',
};
const session = (state: State): Session => ({ state, updatedAt: Date.now(), invalidAttempts: 0 });
const transitionAttendance = (
  current: Session | undefined,
  text: string,
  config: AttendanceConfig,
) => runTransition(current, { type: 'text', text }, config);

const payload = {
  entry: [
    {
      changes: [
        {
          field: 'messages',
          value: {
            metadata: { phone_number_id: '123' },
            messages: [{ from: '5511', type: 'text', id: 'inbound-id', text: { body: 'oi' } }],
          },
        },
      ],
    },
  ],
};

test('agrega mensagens da mesma transição para um único envio dentro dos limites da Meta', () => {
  assert.deepEqual(
    combineOutboundMessages([
      { type: 'text', body: 'Resposta inicial' },
      { type: 'text', body: 'Próxima orientação' },
    ]),
    [{ type: 'text', body: 'Resposta inicial\n\nPróxima orientação' }],
  );
  const list = {
    type: 'list' as const,
    body: 'Escolha',
    button: 'Ver opções',
    section: 'Atendimento',
    rows: [{ id: 'menu:faq', title: 'Dúvidas' }],
  };
  assert.deepEqual(combineOutboundMessages([{ type: 'text', body: 'Resposta' }, list]), [
    { ...list, body: 'Resposta\n\nEscolha' },
  ]);
  assert.equal(combineOutboundMessages([{ type: 'text', body: 'x'.repeat(5000) }]).length, 2);
});

test('configuração aceita links pendentes e valida URLs, FAQs, comandos e retomada', () => {
  assert.equal(loadConfig(environment).attendance.parents.url, undefined);
  assert.throws(() => loadConfig({ ...environment, META_ACCESS_TOKEN: '' }), /META_ACCESS_TOKEN/);
  assert.throws(
    () => loadConfig({ ...environment, SESSION_HASH_SECRET: 'short' }),
    /SESSION_HASH_SECRET/,
  );
  assert.throws(() => loadConfig({ ...environment, PORT: 'abc' }), /PORT/);
  assert.throws(
    () => loadConfig({ ...environment, META_GRAPH_VERSION: '21' }),
    /META_GRAPH_VERSION/,
  );
  assert.throws(
    () => loadConfig({ ...environment, PARENTS_GROUP_FORM_URL: 'http://example.com' }),
    /HTTPS/,
  );
  assert.throws(
    () => loadConfig({ ...environment, BOT_RESUME_ENABLED: 'true', BOT_RESUME_COMMAND: '' }),
    /BOT_RESUME_COMMAND/,
  );
  assert.throws(() => loadConfig({ ...environment, BOT_HUMAN_COMMANDS: '["menu"]' }), /único/);
  assert.throws(
    () =>
      loadConfig({
        ...environment,
        FAQ_ENTRIES:
          '[{"id":"x","question":"q","answer":"a"},{"id":"x","question":"q2","answer":"a2"}]',
      }),
    /repetidas/,
  );
});

test('menu cobre todas as opções e seleções avulsas iniciam no menu', () => {
  const config = loadConfig({
    ...environment,
    PARENTS_GROUP_FORM_URL: 'https://example.com/pais',
    TEATIVO_WAITLIST_URL: 'https://example.com/teativo',
    CARD_FORM_URL: 'https://example.com/carteira',
  }).attendance;
  assert.equal(transitionAttendance(undefined, 'oi', config).state, State.MENU);
  assert.equal(transitionAttendance(undefined, '1', config).state, State.MENU);
  assert.equal(transitionAttendance(undefined, 'menu:welcome', config).state, State.MENU);
  for (const [option, url] of [
    ['1', 'pais'],
    ['4', 'teativo'],
    ['5', 'carteira'],
  ]) {
    const result = transitionAttendance(session(State.MENU), option!, config);
    assert.equal(result.state, State.MENU);
    assert.ok(
      result.messages.some(
        (message) => message.type === 'text' && message.body.includes(`https://example.com/${url}`),
      ),
    );
  }
  assert.equal(transitionAttendance(session(State.MENU), '2', config).state, State.HUMAN);
  assert.equal(
    transitionAttendance(session(State.MENU), 'menu:welcome', config).state,
    State.PROFILE,
  );
  const menu = transitionAttendance(undefined, 'oi', config).messages[0];
  assert.equal(menu?.type, 'list');
  if (menu?.type === 'list') assert.equal(menu.rows.length, 7);
  assert.equal(transitionAttendance(session(State.MENU), '7', config).state, State.HUMAN);
  assert.equal(transitionAttendance(session(State.MENU), '99', config).state, State.MENU);
  for (const phrase of ['Grupo de pais', 'grupo de pais', 'pais']) {
    const result = transitionAttendance(session(State.MENU), phrase, config);
    assert.equal(result.state, State.MENU);
    assert.ok(
      result.messages.some(
        (message) => message.type === 'text' && message.body.includes('https://example.com/pais'),
      ),
    );
  }
  for (const phrase of ['Grupo de adultos', 'grupo de adultos', 'adultos']) {
    assert.equal(transitionAttendance(session(State.MENU), phrase, config).state, State.HUMAN);
  }
  for (const phrase of ['Projeto Teativo', 'projeto teativo', 'teativo']) {
    const result = transitionAttendance(session(State.MENU), phrase, config);
    assert.equal(result.state, State.MENU);
    assert.ok(
      result.messages.some(
        (message) =>
          message.type === 'text' && message.body.includes('https://example.com/teativo'),
      ),
    );
  }
  for (const phrase of ['Carteirinha', 'carteirinha']) {
    const result = transitionAttendance(session(State.MENU), phrase, config);
    assert.equal(result.state, State.MENU);
    assert.ok(
      result.messages.some(
        (message) =>
          message.type === 'text' && message.body.includes('https://example.com/carteira'),
      ),
    );
  }
  for (const phrase of ['Acolhimento', 'acolhimento']) {
    assert.equal(transitionAttendance(session(State.MENU), phrase, config).state, State.PROFILE);
  }
  for (const phrase of ['Falar com a equipe', 'falar com a equipe']) {
    assert.equal(transitionAttendance(session(State.MENU), phrase, config).state, State.HUMAN);
  }
  const pending = transitionAttendance(
    session(State.MENU),
    '1',
    loadConfig(environment).attendance,
  );
  assert.equal(pending.state, State.HUMAN);
  assert.ok(
    pending.messages.some(
      (message) =>
        message.type === 'text' && message.body.includes(config.resourceUnavailableMessage),
    ),
  );
});

test('acolhimento valida os três perfis e permite pular para humano em qualquer etapa', () => {
  const config = loadConfig(environment).attendance;
  for (const option of ['1', '2', '3']) {
    const result = transitionAttendance(session(State.PROFILE), option, config);
    assert.equal(result.state, State.HUMAN);
    assert.ok(
      result.messages.some(
        (message) => message.type === 'text' && message.body.includes('agendamento'),
      ),
    );
  }
  for (const phrase of ['mãe', 'mae', 'pai', 'mãe ou pai', 'mae ou pai']) {
    assert.equal(transitionAttendance(session(State.PROFILE), phrase, config).state, State.HUMAN);
  }
  for (const phrase of ['Autista adulto', 'autista adulto', 'adulto autista']) {
    assert.equal(transitionAttendance(session(State.PROFILE), phrase, config).state, State.HUMAN);
  }
  for (const phrase of ['Familiar', 'familiar']) {
    assert.equal(transitionAttendance(session(State.PROFILE), phrase, config).state, State.HUMAN);
  }
  for (const nav of ['Voltar ao menu', 'voltar ao menu']) {
    assert.equal(transitionAttendance(session(State.PROFILE), nav, config).state, State.MENU);
  }
  assert.equal(
    transitionAttendance(session(State.PROFILE), 'nome pessoal', config).state,
    State.PROFILE,
  );
  for (const state of [State.MENU, State.PROFILE, State.FAQ]) {
    assert.equal(
      transitionAttendance(session(state), 'falar com atendente', config).state,
      State.HUMAN,
    );
    assert.equal(transitionAttendance(session(state), 'menu', config).state, State.MENU);
  }
  assert.equal(
    runTransition(session(State.PROFILE), { type: 'selection', id: 'nav:menu' }, config).state,
    State.MENU,
  );
  assert.equal(
    runTransition(session(State.PROFILE), { type: 'selection', id: 'nav:human' }, config).state,
    State.HUMAN,
  );
});

test('navegação visual e tentativas inválidas preservam a etapa correta', () => {
  const config = loadConfig(environment).attendance;
  const profile = session(State.PROFILE);
  const list = runTransition(
    profile,
    { type: 'selection', id: 'profile:mother_or_father' },
    config,
  );
  const profilePrompt = transitionAttendance(session(State.MENU), '3', config).messages[0];
  assert.equal(profilePrompt?.type, 'list');
  if (profilePrompt?.type === 'list') {
    assert.ok(profilePrompt.rows.some((row) => row.id === 'nav:menu'));
    assert.ok(profilePrompt.rows.some((row) => row.id === 'nav:human'));
  }
  assert.equal(list.state, State.HUMAN);

  const firstInvalid = transitionAttendance(profile, 'entrada inválida', config);
  assert.equal(firstInvalid.invalidAttempts, 1);
  assert.ok(
    firstInvalid.messages.some(
      (message) => message.type === 'text' && message.body === config.invalidOptionMessage,
    ),
  );

  const secondInvalid = transitionAttendance(
    { ...profile, invalidAttempts: firstInvalid.invalidAttempts },
    'entrada inválida',
    config,
  );
  assert.equal(secondInvalid.invalidAttempts, 2);
  assert.ok(
    secondInvalid.messages.some(
      (message) => message.type === 'text' && message.body === config.repeatedInvalidOptionMessage,
    ),
  );
  assert.equal(transitionAttendance(profile, 'profile:family_member', config).invalidAttempts, 0);
});

test('mídia não suportada explica as opções e seleções antigas não avançam o fluxo', () => {
  const config = loadConfig(environment).attendance;
  const unsupported = runTransition(
    undefined,
    { type: 'unsupported', messageType: 'image' },
    config,
  );
  assert.equal(unsupported.state, State.MENU);
  assert.ok(
    unsupported.messages.some(
      (message) => message.type === 'text' && message.body === config.unsupportedMessage,
    ),
  );

  const staleSelection = runTransition(
    undefined,
    { type: 'selection', id: 'menu:welcome' },
    config,
  );
  assert.equal(staleSelection.state, State.MENU);
  assert.ok(
    staleSelection.messages.some(
      (message) => message.type === 'text' && message.body === config.staleSelectionMessage,
    ),
  );
  const paused = runTransition(
    session(State.HUMAN),
    { type: 'unsupported', messageType: 'image' },
    config,
  );
  assert.deepEqual(paused.messages, []);
});

test('dúvidas usa conteúdo aprovado configurável; vazio encaminha para equipe', () => {
  const config = loadConfig({
    ...environment,
    FAQ_ENTRIES: '[{"id":"agenda","question":"Como agendar?","answer":"Converse com a equipe."}]',
  }).attendance;
  assert.equal(transitionAttendance(session(State.MENU), '6', config).state, State.FAQ);
  const faqList = transitionAttendance(session(State.MENU), '6', config).messages[0];
  assert.equal(faqList?.type, 'list');
  if (faqList?.type === 'list') assert.equal(faqList.rows.at(-1)?.id, 'nav:menu');
  assert.ok(
    transitionAttendance(session(State.FAQ), 'faq:agenda', config).messages.some(
      (message) => message.type === 'text' && message.body.includes('Converse com a equipe.'),
    ),
  );
  assert.ok(
    transitionAttendance(session(State.FAQ), 'faq:agenda', config).messages.some(
      (message) => message.type === 'text' && message.body.includes('Converse com a equipe.'),
    ),
  );
  assert.equal(transitionAttendance(session(State.FAQ), '99', config).state, State.FAQ);
  assert.equal(
    transitionAttendance(session(State.MENU), '6', loadConfig(environment).attendance).state,
    State.HUMAN,
  );
});

test('humano permanece silencioso até retomada explícita habilitada', () => {
  const disabled = loadConfig({ ...environment, BOT_RESUME_ENABLED: 'false' }).attendance;
  for (const text of ['oi', 'menu', 'reiniciar', '7', 'retomar bot']) {
    assert.deepEqual(transitionAttendance(session(State.HUMAN), text, disabled), {
      state: State.HUMAN,
      messages: [],
      invalidAttempts: 0,
    });
  }
  const enabled = loadConfig({
    ...environment,
    BOT_RESUME_ENABLED: 'true',
    BOT_RESUME_COMMAND: 'menu',
  }).attendance;
  assert.equal(transitionAttendance(session(State.HUMAN), 'menu', enabled).state, State.MENU);
});

test('sessões persistem sem conteúdo pessoal, expiram e preservam pausa humana', async (context) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cia-state-'));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const config = loadConfig({ ...environment, STATE_FILE: path.join(dir, 'sessions.json') });
  const repository = new SessionRepository(config);
  await repository.initialize();
  const now = Date.now();
  await repository.commit('5511', State.PROFILE, 'private-message-id', now);
  await repository.commit('5522', State.HUMAN, 'human-message-id', now);
  const contents = await readFile(config.stateFile, 'utf8');
  for (const forbidden of [
    '5511',
    '5522',
    'private-message-id',
    'human-message-id',
    'answers',
    'profile',
    'text',
  ]) {
    assert.equal(contents.includes(forbidden), false);
  }
  const restored = new SessionRepository(config);
  await restored.initialize();
  assert.equal(restored.get('5511')?.state, State.PROFILE);
  await restored.cleanup(now + config.sessionTtlMs + config.deduplicationTtlMs);
  assert.equal(restored.get('5511'), undefined);
  assert.equal(restored.get('5522', now + config.sessionTtlMs), undefined);
  assert.equal(restored.hasProcessed('private-message-id'), false);
});

test('estado v2 é rejeitado sem ser sobrescrito', async (context) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cia-state-v2-'));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const config = loadConfig({ ...environment, STATE_FILE: path.join(dir, 'sessions.json') });
  const versionTwo = '{"version":2,"sessions":{},"processed":{}}';
  await writeFile(config.stateFile, versionTwo);
  await assert.rejects(new SessionRepository(config).initialize(), /incompatível/);
  assert.equal(await readFile(config.stateFile, 'utf8'), versionTwo);
});

test('estado antigo não é sobrescrito silenciosamente', async (context) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cia-legacy-'));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const config = loadConfig({ ...environment, STATE_FILE: path.join(dir, 'legacy.json') });
  const legacy = '{"conversations":{},"messageIds":[]}';
  await writeFile(config.stateFile, legacy);
  await assert.rejects(new SessionRepository(config).initialize(), /incompatível/);
  assert.equal(await readFile(config.stateFile, 'utf8'), legacy);
});

test('concorrência, retries e reinício preservam estado e não salvam respostas', async (context) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cia-service-'));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const config = loadConfig({ ...environment, STATE_FILE: path.join(dir, 'sessions.json') });
  const repository = new SessionRepository(config);
  await repository.initialize();
  const replies: string[] = [];
  let fail = false;
  const service = new AttendanceService(config.attendance, repository, {
    async send(_to, message) {
      if (fail) throw new Error('offline');
      replies.push(message.body);
    },
  });
  const message = (id: string, text: string) => ({
    from: '5511',
    id,
    content: { type: 'text' as const, text },
  });
  await Promise.all([service.process(message('1', 'oi')), service.process(message('1', 'oi'))]);
  assert.equal(replies.length, 1);
  fail = true;
  await assert.rejects(service.process(message('2', '3')), /offline/);
  assert.equal(repository.get('5511')?.state, State.MENU);
  assert.equal(repository.hasProcessed('2'), false);
  fail = false;
  await service.process(message('2', '3'));
  await service.process(message('3', '2'));
  assert.equal(repository.get('5511')?.state, State.HUMAN);
  const restored = new SessionRepository(config);
  await restored.initialize();
  const restarted = new AttendanceService(config.attendance, restored, {
    async send() {
      assert.fail('Humano não deve receber mensagem automática.');
    },
  });
  await restarted.process(message('4', 'dados pessoais sensíveis'));
  assert.equal((await readFile(config.stateFile, 'utf8')).includes('dados pessoais'), false);
});

test('parser ignora echoes, mensagens inválidas e outros números', () => {
  assert.deepEqual(extractMessages(null, '123'), []);
  assert.equal(extractMessages(payload, '123').length, 1);
  assert.deepEqual(extractMessages(payload, '999'), []);
  const echoes = structuredClone(payload);
  echoes.entry[0]!.changes[0]!.field = 'smb_message_echoes';
  assert.deepEqual(extractMessages(echoes, '123'), []);
  const listReply = structuredClone(payload);
  listReply.entry[0]!.changes[0]!.value.messages[0] = {
    from: '5511',
    type: 'interactive',
    id: 'selected',
    interactive: { type: 'list_reply', list_reply: { id: 'menu:welcome', title: 'Acolhimento' } },
  } as (typeof listReply.entry)[0]['changes'][0]['value']['messages'][0];
  assert.deepEqual(extractMessages(listReply, '123')[0]?.content, {
    type: 'selection',
    id: 'menu:welcome',
  });
  const image = structuredClone(payload);
  image.entry[0]!.changes[0]!.value.messages[0] = {
    from: '5511',
    type: 'image',
    id: 'image-message',
    image: { id: 'media-id' },
  } as (typeof image.entry)[0]['changes'][0]['value']['messages'][0];
  assert.deepEqual(extractMessages(image, '123')[0]?.content, {
    type: 'unsupported',
    messageType: 'image',
  });
  const reaction = structuredClone(payload);
  reaction.entry[0]!.changes[0]!.value.messages[0] = {
    from: '5511',
    type: 'reaction',
    id: 'reaction-message',
    reaction: { message_id: 'outbound-id', emoji: '👍' },
  } as (typeof reaction.entry)[0]['changes'][0]['value']['messages'][0];
  assert.deepEqual(extractMessages(reaction, '123'), []);
});

test('rotas validam handshake, preservam 400 e retornam 503 sem vazar detalhes', async (context) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cia-routes-'));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const app = await buildApp(
    loadConfig({ ...environment, STATE_FILE: path.join(dir, 'sessions.json') }),
  );
  context.after(() => app.close());
  assert.equal(
    (await app.inject('/webhook?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=42')).body,
    '42',
  );
  assert.equal(
    (await app.inject('/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42')).statusCode,
    403,
  );
  const malformed = await app.inject({
    method: 'POST',
    url: '/webhook',
    headers: { 'content-type': 'application/json' },
    payload: '{',
  });
  assert.equal(malformed.statusCode, 400);
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return calls === 1
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify({ messages: [{ id: 'out' }] }), { status: 200 });
  });
  const failed = await app.inject({ method: 'POST', url: '/webhook', payload });
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.body, 'PROCESSING_FAILED');
  assert.equal((await app.inject({ method: 'POST', url: '/webhook', payload })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/webhook', payload })).statusCode, 200);
  assert.equal(calls, 2);
});
