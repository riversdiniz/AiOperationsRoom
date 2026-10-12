'use strict';

/* Testes da lógica pura do escritório pixel (frontend/pixel.js).
   Rodar: node --test tests/js/pixel.test.js
   Não testa DOM nem animação: testa que os sprites são bem formados, que a
   planta tem lugar para todos sem placas encostando, que toda vaga é
   alcançável andando, e que a escolha de área respeita o estado. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const px = require(path.join(__dirname, '..', '..', 'frontend', 'pixel.js'));

const LARGURA = 968; // largura útil da sala na cena (1000 - 2 margens)
const ALFABETO = new Set(['.', ...Object.keys(px.COR_FIXA), ...Object.keys(px.CLASSE_VAR)]);
const PLACA = 99 / px.P; // largura máxima da placa (PLACA_MAX em pixel.js), em pixels de arte

/* ------------------------------------------------------------ sprites */

test('toda pose, quadro, penteado e fone tem 20 linhas de 12 pixels e só letras conhecidas', () => {
  Object.keys(px.POSES).forEach((pose) => {
    px.ESTILOS.forEach((estilo) => {
      [false, true].forEach((principal) => {
        [0, 1].forEach((q) => {
          const mapa = px.mapaPessoa(pose, q, estilo, principal);
          assert.equal(mapa.length, px.SH, `${pose}/${estilo}`);
          mapa.forEach((linha, r) => {
            assert.equal(linha.length, px.SW, `${pose}/${estilo}/${q} linha ${r}`);
            linha.split('').forEach((ch) => assert.ok(ALFABETO.has(ch), `${pose}: letra ${ch}`));
          });
        });
      });
    });
  });
});

test('fone só no principal, e só por cima do desenho (nunca pinta o vazio)', () => {
  const temFone = (m) => m.join('').includes('H');
  assert.ok(temFone(px.mapaPessoa('pe-frente', 0, 'curto', true)));
  assert.ok(!temFone(px.mapaPessoa('pe-frente', 0, 'curto', false)));
  px.ESTILOS.forEach((estilo) => {
    const sem = px.mapaPessoa('pe-lado', 0, estilo, false);
    const com = px.mapaPessoa('pe-lado', 0, estilo, true);
    sem.forEach((linha, r) => linha.split('').forEach((ch, c) => {
      if (ch === '.') assert.equal(com[r][c], '.', `${estilo} ${r},${c}`);
    }));
  });
});

test('quadro 2 de quem está de frente pisca; quem anda troca as pernas', () => {
  const a = px.mapaPessoa('pe-frente', 0, 'curto', false).join('');
  const b = px.mapaPessoa('pe-frente', 1, 'curto', false).join('');
  assert.ok(a.includes('E') && !b.includes('E'));
  assert.notDeepEqual(px.mapaPessoa('andar-frente', 0, 'curto', false), px.mapaPessoa('andar-frente', 1, 'curto', false));
});

test('a mesma execução tem sempre a mesma aparência', () => {
  const e = { id: 7, session_id: 'abc', agent_id: 'x1', tipo_agente: 'Explore' };
  assert.deepEqual(px.aparencia(e), px.aparencia({ ...e }));
  assert.equal(px.aparencia({ ...e, tipo_agente: 'principal' }).principal, true);
});

test('compilar gera um path por cor; cor de pessoa vem por variável CSS', () => {
  const camadas = px.compilar(['.OO.', 'OTTO']);
  const o = camadas.find((c) => c.ch === 'O');
  const t = camadas.find((c) => c.ch === 'T');
  assert.equal(o.d, 'M1 0h2v1h-2zM0 1h1v1h-1zM3 1h1v1h-1z');
  assert.equal(t.classe, 'pp-camisa');
  assert.equal(t.cor, null);
});

/* ------------------------------------------------------------- planta */

const CENARIOS = [
  { ativos: 0, total: 0 },
  { ativos: 3, total: 9 }, // o pico real medido em 05/10/2026
  { ativos: 7, total: 12 },
  { ativos: 2, total: 25 }, // dia cheio de subagentes encerrados
];

test('a planta tem lugar para todos, com folga na convivência', () => {
  CENARIOS.forEach((c) => {
    const plano = px.planejarSala(c, LARGURA);
    const mesas = plano.vagas.filter((v) => v.zona === 'mesa').length;
    const convivencia = plano.vagas.filter((v) => v.zona !== 'mesa').length;
    assert.ok(mesas >= c.ativos + 1, `mesas ${mesas} para ${c.ativos} ativos`);
    assert.ok(convivencia >= c.total + 2, `convivência ${convivencia} para ${c.total}`);
    assert.equal(new Set(plano.vagas.map((v) => v.id)).size, plano.vagas.length);
  });
});

test('placas, losangos e tempos de duas vagas nunca se encostam', () => {
  CENARIOS.forEach((c) => {
    const plano = px.planejarSala(c, LARGURA);
    plano.vagas.forEach((a, i) => plano.vagas.slice(i + 1).forEach((b) => {
      // lado a lado: placas não se tocam; na mesma coluna: o balão da órfã
      // (32 px acima dos pés) fica abaixo do tempo de cima (11 px abaixo)
      if (Math.abs(a.x - b.x) < PLACA) assert.ok(Math.abs(a.y - b.y) >= 43, `${a.id} e ${b.id} empilhados`);
    }));
  });
});

test('toda vaga cabe na sala e fica abaixo da parede do fundo', () => {
  CENARIOS.forEach((c) => {
    const plano = px.planejarSala(c, LARGURA);
    plano.vagas.forEach((v) => {
      assert.ok(v.x - PLACA / 2 >= 0 && v.x + PLACA / 2 <= plano.W, `${v.id} x`);
      assert.ok(v.y - px.SH >= 32 - 10 && v.y + 12 <= plano.H, `${v.id} y=${v.y} H=${plano.H}`);
    });
  });
});

test('de qualquer vaga se chega a qualquer outra andando, pelas passagens', () => {
  CENARIOS.forEach((c) => {
    const plano = px.planejarSala(c, LARGURA);
    const grade = px.criarGrade(plano);
    const origem = plano.vagas[0].acesso;
    plano.vagas.forEach((v) => {
      const caminho = px.rota(grade, origem, v.acesso);
      assert.ok(caminho && caminho.length, `sem rota até ${v.id} (${JSON.stringify(c)})`);
    });
  });
});

test('a rota só tem trechos retos (horizontais ou verticais) e não atravessa móvel', () => {
  const plano = px.planejarSala({ ativos: 3, total: 9 }, LARGURA);
  const grade = px.criarGrade(plano);
  const de = plano.vagas.find((v) => v.id === 'mesa-0').acesso;
  const para = plano.vagas.find((v) => v.id === 'estar-4').acesso;
  const caminho = px.rota(grade, de, para);
  for (let i = 1; i < caminho.length; i += 1) {
    const a = caminho[i - 1];
    const b = caminho[i];
    assert.ok(a.x === b.x || a.y === b.y, 'trecho diagonal');
    const passos = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 2;
    for (let k = 0; k <= passos; k += 1) {
      const x = a.x + ((b.x - a.x) * k) / (passos || 1);
      const y = a.y + ((b.y - a.y) * k) / (passos || 1);
      const i2 = Math.floor(y / 2) * grade.cw + Math.floor(x / 2);
      assert.equal(grade.livre[i2], 1, `célula ocupada em ${x},${y}`);
    }
  }
});

/* --------------------------------------------------- estado e lugar */

test('encerrada e órfã nunca vão para a mesa; ativas podem ir a qualquer área', () => {
  for (let s = 0; s < 1; s += 0.01) {
    assert.notEqual(px.sortearZona('concluida', s), 'mesa');
    assert.notEqual(px.sortearZona('orfa', s), 'mesa');
  }
  ['trabalhando', 'delegando', 'aguardando'].forEach((status) => {
    const zonas = new Set();
    for (let s = 0.001; s < 1; s += 0.01) zonas.add(px.sortearZona(status, s));
    assert.deepEqual([...zonas].sort(), ['cafe', 'estar', 'mesa'], status);
  });
});

test('quem trabalha vai mais à mesa do que quem aguarda', () => {
  assert.ok(px.PESOS.trabalhando.mesa > px.PESOS.aguardando.mesa);
  assert.ok(px.PESOS.delegando.mesa > px.PESOS.aguardando.mesa);
});

test('foco=mesa (vitrine): quem trabalha ou delega só sorteia mesa; os demais não mudam', () => {
  const zonasDe = (status) => {
    const zonas = new Set();
    for (let s = 0.001; s < 1; s += 0.01) zonas.add(px.sortearZona(status, s));
    return [...zonas].sort();
  };
  px.definirFocoMesa(true);
  try {
    assert.deepEqual(zonasDe('trabalhando'), ['mesa']);
    assert.deepEqual(zonasDe('delegando'), ['mesa']);
    assert.deepEqual(zonasDe('aguardando'), ['cafe', 'estar', 'mesa']);
    assert.deepEqual(zonasDe('concluida'), ['cafe', 'estar']);
    assert.deepEqual(zonasDe('orfa'), ['cafe', 'estar']);
  } finally {
    px.definirFocoMesa(false);
  }
  assert.deepEqual(zonasDe('trabalhando'), ['cafe', 'estar', 'mesa']); // desligado de novo: comportamento normal
});

test('escolherVaga nunca devolve vaga ocupada nem a vaga atual', () => {
  const plano = px.planejarSala({ ativos: 3, total: 9 }, LARGURA);
  const ocupadas = new Set(plano.vagas.filter((v) => v.zona === 'estar').map((v) => v.id));
  for (let s = 0; s < 1; s += 0.05) {
    const v = px.escolherVaga(plano, 'concluida', ocupadas, s, 'balcao-0');
    assert.ok(v && !ocupadas.has(v.id) && v.id !== 'balcao-0' && v.zona === 'cafe');
  }
  const cheias = new Set(plano.vagas.filter((v) => v.zona !== 'mesa').map((v) => v.id));
  assert.equal(px.escolherVaga(plano, 'orfa', cheias, 0.5, null), null); // sem lugar: fica onde está
});

test('prepararSalas: só salas com gente, ordem por nome, Sem projeto por último', () => {
  const salas = px.prepararSalas({
    salas: [
      { chave: 'cx', nome: 'Sem projeto', projeto_id: null, execucoes: [{ id: 1, status: 'concluida' }] },
      { chave: 'p2', nome: 'Zeta', projeto_id: 2, execucoes: [{ id: 2, status: 'trabalhando' }] },
      { chave: 'p1', nome: 'Alfa', projeto_id: 1, execucoes: [] },
      { chave: 'p3', nome: 'Beta', projeto_id: 3, execucoes: [{ id: 3, status: 'concluida' }] },
    ],
  });
  assert.deepEqual(salas.map((s) => s.chave), ['p3', 'p2', 'cx']);
  assert.equal(salas[0].ativos, 0); // encerrada não conta como ativa
});

test('nove execuções ativas dimensionam a sala com mesas suficientes', () => {
  const execucoes = Array.from({ length: 9 }, (_, id) => ({ id, status: 'trabalhando' }));
  const [sala] = px.prepararSalas({ salas: [{ chave: 'p1', nome: 'Projeto', projeto_id: 1, ativos: 9, execucoes }] });
  const plano = px.planejarSala({ ativos: sala.ativos, total: sala.execucoes.length }, LARGURA);
  assert.ok(plano.vagas.filter((vaga) => vaga.zona === 'mesa').length >= 9);
});

/* -------------------------------------------------------- vida social */

test('a TV fica na sala de estar, entre a última fileira e a parede, e todo assento continua alcançável', () => {
  [{ ativos: 1, total: 2 }, { ativos: 3, total: 9 }, { ativos: 8, total: 20 }].forEach((contagem) => {
    const plano = px.planejarSala(contagem, LARGURA);
    const yUltima = 60 + (plano.linhasEstar - 1) * 43;
    assert.ok(plano.tv.x - 11 >= px.X.estar[0] && plano.tv.x + 11 <= plano.W - 2, 'TV dentro da sala de estar');
    assert.ok(plano.tv.y > yUltima + 9, 'TV abaixo do acesso dos assentos');
    assert.ok(plano.tv.y + 8 <= plano.H - 3, 'TV acima da parede de baixo');
    assert.equal(plano.tv.fila, plano.linhasEstar - 1);
    const grade = px.criarGrade(plano);
    const origem = plano.vagas.find((v) => v.id === 'mesa-0').acesso;
    plano.vagas.filter((v) => v.zona === 'estar').forEach((v) => {
      assert.ok(px.rota(grade, origem, v.acesso), `rota até ${v.id}`);
    });
  });
});

test('vagasRoda usa só lugares do tipo certo e nunca devolve lugar ocupado', () => {
  const plano = px.planejarSala({ ativos: 2, total: 6 }, LARGURA);
  const vazio = new Set();
  const conversa = px.vagasRoda(plano, 'conversa', vazio);
  assert.deepEqual(conversa.map((v) => v.tipo), ['balcao', 'balcao']);
  assert.deepEqual(px.vagasRoda(plano, 'conversa', new Set(['balcao-0'])), [], 'conversa precisa dos dois balcões');

  const copa = px.vagasRoda(plano, 'copa', new Set(['banqueta-0']));
  assert.ok(copa.length >= 2 && copa.length <= px.LIMITES_RODA.copa[1]);
  assert.ok(copa.every((v) => v.zona === 'cafe' && v.id !== 'banqueta-0'));
  assert.equal(copa[0].tipo, 'banqueta', 'banquetas antes do balcão');

  const fila = plano.tv.fila * 3;
  const tv = px.vagasRoda(plano, 'tv', new Set([`estar-${fila + 1}`]));
  assert.deepEqual(tv.map((v) => v.id), [`estar-${fila}`, `estar-${fila + 2}`]);
  assert.deepEqual(px.vagasRoda(plano, 'outra', vazio), []);
});

test('falaRoda devolve texto curto, preenche o nome e só o futebol tem gol', () => {
  let semente = 7;
  const rnd = () => {
    semente = (semente * 16807) % 2147483647;
    return (semente - 1) / 2147483646;
  };
  const datas = [new Date(2026, 9, 9, 9), new Date(2026, 9, 12, 12), new Date(2026, 9, 14, 21)];
  for (let i = 0; i < 600; i += 1) {
    const tipo = ['conversa', 'copa', 'tv'][i % 3];
    const programa = px.PROGRAMAS[i % px.PROGRAMAS.length];
    const fala = px.falaRoda(tipo, { nomes: i % 4 ? ['Explore', 'Claude principal'] : [], data: datas[i % 3], programa }, rnd);
    assert.ok(fala.texto && fala.texto.length <= 40, fala.texto);
    assert.ok(!fala.texto.includes('{nome}'), fala.texto);
    if (fala.evento) assert.ok(tipo === 'tv' && programa === 'futebol');
    if (fala.reacao) assert.ok(fala.reacao.length <= 20);
  }
});

test('sem nomes de colegas, a fofoca não aparece', () => {
  const rnd = () => 0.1; // sorteio que cairia em fofoca
  const fala = px.falaRoda('copa', { nomes: [], data: new Date(2026, 9, 14, 15) }, rnd);
  assert.ok(px.FALAS.trabalho.includes(fala.texto));
});

/* ------------------------------------------------- vida social: parte 2 */

test('a faixa de baixo tem banheiro e lounge, e seus lugares ficam abaixo da parede da faixa', () => {
  CENARIOS.forEach((c) => {
    const plano = px.planejarSala(c, LARGURA);
    assert.equal(plano.H - plano.Hc, 78);
    const tipos = (t) => plano.vagas.filter((v) => v.tipo === t);
    assert.equal(tipos('pia').length, 2);
    assert.equal(tipos('fliper').length, 2);
    assert.equal(tipos('game').length, 2);
    assert.equal(tipos('pingue').length, 2);
    plano.vagas.filter((v) => ['banheiro', 'lounge'].includes(v.zona)).forEach((v) => {
      assert.ok(v.y > plano.Hc + 12, `${v.id} abaixo da parede`);
      assert.ok(v.x >= (v.zona === 'banheiro' ? px.X.banheiro[0] : px.X.lounge[0]), `${v.id} na própria área`);
    });
    // passeio comum nunca usa banheiro nem lounge: só as rodas
    Object.values(px.PESOS).forEach((pesos) => {
      assert.ok(!('banheiro' in pesos) && !('lounge' in pesos));
    });
  });
});

test('vagasRoda dos jogos e do espelho', () => {
  const plano = px.planejarSala({ ativos: 1, total: 4 }, LARGURA);
  const vazio = new Set();
  assert.deepEqual(px.vagasRoda(plano, 'pingpong', vazio).map((v) => v.id), ['pingue-0', 'pingue-1']);
  assert.deepEqual(px.vagasRoda(plano, 'videogame', vazio).map((v) => v.id), ['game-0', 'game-1']);
  assert.deepEqual(px.vagasRoda(plano, 'fliperama', new Set(['fliper-1'])), [], 'fliperama precisa das duas máquinas');
  assert.deepEqual(px.vagasRoda(plano, 'jokenpo', vazio).map((v) => v.tipo), ['balcao', 'balcao']);
  assert.deepEqual(px.vagasRoda(plano, 'espelho', new Set(['pia-0'])).map((v) => v.id), ['pia-1']);
  Object.keys(px.LIMITES_RODA).forEach((tipo) => assert.ok(px.FAMILIA_RODA[tipo], `família de ${tipo}`));
});

test('perfil: sempre o mesmo para a mesma pessoa, com 2 ou 3 traços sem contradição', () => {
  const nomes = new Set(px.NOMES.map(([n]) => n));
  for (let i = 0; i < 300; i += 1) {
    const chave = `sessao-${i}|agente-${i % 7}`;
    const p = px.perfil(chave);
    assert.deepEqual(px.perfil(chave), p, 'determinístico');
    assert.ok(nomes.has(p.nome));
    assert.ok(p.artigo === 'a' || p.artigo === 'o');
    assert.ok(p.tracos.length === 2 || p.tracos.length === 3, `${p.tracos}`);
    assert.equal(new Set(p.tracos).size, p.tracos.length);
    p.tracos.forEach((t) => assert.ok(px.TRACOS[t], t));
    px.OPOSTOS.forEach(([a, b]) => assert.ok(!(p.tracos.includes(a) && p.tracos.includes(b)), `${a} e ${b}`));
    assert.ok(p.bordao.length > 0);
  }
});

test('perfil não repete nome de quem já está na tela', () => {
  const p = px.perfil('alguem|x');
  const outro = px.perfil('alguem|x', new Set([p.nome]));
  assert.notEqual(outro.nome, p.nome);
});

test('relacao é simétrica, estável e nunca consigo mesmo', () => {
  let rivais = 0;
  let amigos = 0;
  for (let i = 0; i < 200; i += 1) {
    const a = `a${i}`;
    const b = `b${i * 3}`;
    assert.equal(px.relacao(a, b), px.relacao(b, a));
    assert.equal(px.relacao(a, b), px.relacao(a, b));
    if (px.relacao(a, b) === 'rival') rivais += 1;
    if (px.relacao(a, b) === 'amigo') amigos += 1;
  }
  assert.equal(px.relacao('x', 'x'), null);
  assert.ok(rivais > 0 && amigos > 0 && rivais + amigos < 200);
});

test('aposta nunca passa do menor saldo; jogos sem rivalidade nem apostador valem zero', () => {
  const comum = { tracos: ['calma', 'leitura'] };
  const apostador = { tracos: ['apostas'] };
  const pao = { tracos: ['economia'] };
  assert.equal(px.aposta('pingpong', comum, comum, 100, 100, false), 0);
  assert.ok(px.aposta('pingpong', comum, comum, 100, 100, true) > 0);
  assert.ok(px.aposta('jokenpo', comum, comum, 100, 100, false) > 0);
  assert.ok(px.aposta('jokenpo', apostador, comum, 100, 100, false) > px.aposta('jokenpo', pao, comum, 100, 100, false));
  assert.equal(px.aposta('jokenpo', apostador, comum, 100, 7, false), 7);
  assert.equal(px.aposta('jokenpo', comum, comum, 0, 50, false), 0);
});

test('jokenpô: pedra ganha de tesoura, tesoura de papel, papel de pedra', () => {
  assert.equal(px.jokenpo('pedra', 'tesoura'), 1);
  assert.equal(px.jokenpo('tesoura', 'papel'), 1);
  assert.equal(px.jokenpo('papel', 'pedra'), 1);
  assert.equal(px.jokenpo('tesoura', 'pedra'), -1);
  assert.equal(px.jokenpo('papel', 'papel'), 0);
});

test('habilidade e afinidade seguem os traços', () => {
  const gamer = { tracos: ['games'] };
  const atleta = { tracos: ['esporte'] };
  assert.ok(px.habilidade(gamer, 'videogame') > px.habilidade(atleta, 'videogame'));
  assert.ok(px.habilidade(atleta, 'pingpong') > px.habilidade(gamer, 'pingpong'));
  assert.equal(px.habilidade(gamer, 'jokenpo'), px.habilidade(atleta, 'jokenpo'));
  assert.ok(px.pesoRoda('espelho', [{ tracos: ['vaidade'] }]) > px.pesoRoda('espelho', [{ tracos: ['leitura'] }]));
});

test('a fofoca concorda o artigo com o nome', () => {
  const rnd = () => 0.05; // fofoca, primeira frase
  const fala = px.falaRoda('copa', { nomes: [{ nome: 'Marina', artigo: 'a' }], data: new Date(2026, 9, 14, 15) }, rnd);
  assert.equal(fala.texto, 'Viram o commit da Marina? 👀');
});
