# AI Operations Room

Uma sala local para acompanhar sessões e subagentes do Claude Code. O aplicativo recebe somente metadados de hooks, mantém os dados em SQLite local e serve a interface em `127.0.0.1`.

## Requisitos

- Python 3.12 ou superior
- [`uv` instalado](https://docs.astral.sh/uv/getting-started/installation/) e disponível no terminal
- Claude Code, somente para acompanhar sessões reais

## Início rápido

```powershell
uv sync --extra dev
uv run python -m backend.cli hooks-install
uv run python -m backend.cli serve
```

Execute os comandos na pasta deste repositório. Abra [http://127.0.0.1:8765](http://127.0.0.1:8765) e **deixe o terminal do servidor aberto** enquanto usa a sala; `Ctrl+C` encerra o servidor. O hook continua instalado depois que o servidor para e registra eventos para a próxima abertura. A tela Projetos associa um diretório local a cada nome exibido na sala. O caminho mais específico vence. Uma sala aparece quando há uma sessão capturada nesse diretório; cadastrar um projeto sozinho não cria uma sala vazia.

Mantenha a pasta do repositório no mesmo lugar após instalar os hooks: o comando registrado no Claude Code aponta para o caminho local deste checkout. Se precisar movê-la, execute `hooks-remove` antes da mudança e `hooks-install` na nova localização.

### Abrir automaticamente ao entrar no Windows

Depois de executar `uv sync --extra dev` e `hooks-install` uma vez, você pode iniciar o servidor em segundo plano e abrir o navegador com:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-room.ps1
```

O script usa a porta 8765, espera a API responder e abre a sala. Se a porta já estiver ocupada, ele encerra com erro em vez de abrir outra aplicação. Para usar outra porta, acrescente `-Port 8898` ao comando. Se o atalho não abrir a sala, execute o comando manualmente em um terminal para ver o erro; erros de um atalho oculto não aparecem na tela.

Para executar esse script em cada **login** do Windows:

1. Pressione `Win+R`, digite `shell:startup` e pressione Enter.
2. Na pasta aberta, crie um atalho. Como destino, use `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\caminho\para\AiOperationsRoom\scripts\start-room.ps1"`, trocando o caminho pelo local real do repositório.
3. Faça logout e login para testar. Para desativar a abertura automática, remova esse atalho da pasta Inicializar.

O script inicia apenas o servidor real. A demonstração abaixo usa dados separados e deve ser aberta com `demo --serve`. [A Microsoft documenta a pasta `shell:startup` para aplicativos iniciados no login](https://support.microsoft.com/en-gb/windows/experience/startup-boot/configure-startup-applications-in-windows).

## Demonstração

O modo demo cria uma fila e um banco separados em `~/.ai-operations-room-demo`, sem acessar dados reais ou precisar do Claude Code. Projetos cadastrados na demo não aparecem no servidor real, e vice-versa.

```powershell
uv run python -m backend.cli demo --serve
```

Abra `http://127.0.0.1:8765` e interrompa o processo quando terminar. Para apenas gerar os dados fictícios, omita `--serve`. Ao executar `demo` novamente, os eventos e horários fictícios são renovados; sessões da demo não são classificadas como órfãs por falta de PID.

Use `--port 8876` em qualquer comando de servidor quando a porta padrão já estiver ocupada.

## Vida social

Cada sala tem, além das estações de trabalho, do café e da sala de estar, uma faixa embaixo com um **banheiro** e um **lounge de jogos**, ligados ao café por uma porta.

Quando agentes da mesma sala estão à toa (aguardando ou encerrados), de vez em quando eles se juntam numa roda e conversam por balões:

- **Papo no balcão** e **papo na copa:** fofoca com o nome dos colegas, piadas, assuntos de trabalho e do dia e da hora.
- **TV na sala de estar:** futebol (com gol), novela ou desenho; quem é de sonecas cochila.
- **Jokenpô valendo moedinhas:** "Jo… ken… pô!", os gestos sobre a cabeça e as moedinhas passando de um para o outro.
- **Pingue-pongue** até 5 pontos, **videogame** melhor de 3 e **fliperama** no lounge, com placar e provocações entre rivais.
- **Espelho do banheiro:** sozinho ou em dupla, com o rosto refletido no espelho.

Cada agente tem um nome brasileiro, dois ou três traços de personalidade (Competição, Apostas, Games, Séries e TV, Fofoca, Vaidade, Cafeína, Piadas, Esporte, Timidez, Economia, Sonecas, Calma, Leitura), um bordão, amigos e rivais, sempre os mesmos para o mesmo agente. Os traços decidem a roda que cada um prefere, quem chama quem e quem joga melhor. Tudo aparece na janela de detalhes, ao clicar num agente.

As moedinhas são fictícias: cada agente começa com 🪙100 (subagentes com 🪙30), ganha 🪙5 por pedido atendido e 🪙15 quando um subagente entrega o resultado, e as apostas passam de quem perde para quem ganha. O saldo fica salvo no navegador e é esquecido três dias depois de o agente sumir.

As rodas são só encenação: o estado de cada agente continua no losango e na placa. Quando alguém da roda volta a trabalhar, ele avisa ("Opa, me chamaram!") e sai. Com movimento reduzido ativado no sistema, nenhuma roda nova começa. Para mostrar ou gravar uma roda específica, acrescente `#?roda=pingpong` ao endereço (vale também `conversa`, `copa`, `tv`, `jokenpo`, `videogame`, `fliperama` e `espelho`).

## Hooks do Claude Code

O registro altera `~/.claude/settings.json`: adiciona um command hook para `SessionStart`, `UserPromptSubmit`, `Stop`, `SubagentStart`, `SubagentStop` e `SessionEnd`. Antes de alterar o arquivo, revise seu conteúdo.

```powershell
uv run python -m backend.cli hooks-install
uv run python -m backend.cli hooks-remove
```

`hooks-remove` remove somente entradas cujo comando aponta para `hooks/capture.py` deste checkout, mesmo se o executável Python tiver mudado. Ele preserva os demais hooks e configurações.

No Windows, `hooks-install` registra PowerShell explicitamente e também corrige um hook antigo deste checkout que tenha sido criado sem o campo `shell`.

O hook registra identificadores, tipo de agente, diretório de trabalho, razão de encerramento e a hora do evento. Ele não salva prompts, respostas nem transcrições. Para detectar sessões interrompidas sem hook de encerramento, o servidor consulta o identificador da sessão e o PID em `~/.claude/sessions`; não copia o conteúdo desses arquivos para o banco. Os dados ficam por padrão em `~/.ai-operations-room`; defina `AI_OPERATIONS_ROOM_DATA_DIR` para usar outra pasta.

O Painel usa um período selecionável de 6, 12 ou 24 horas. O Escritório mostra execuções ativas e as encerradas nas últimas 12 horas; apenas sessões principais sem subagentes encerradas em menos de 30 segundos são ocultadas da sala.

## Sugestões de agentes

Estou compartilhando também 2 agentes que eu utilizo nos meus projetos de trabalho e pessoais[SUGESTAO_DE_AGENTES.md](SUGESTAO_DE_AGENTES.md): um revisor de código e um pesquisador de contexto.

## Desenvolvimento

```powershell
.venv\Scripts\python.exe -m pytest -q --basetemp=.test-temp
node --check frontend/app.js
node --test tests/js/pixel.test.js
```

Consulte [ARCHITECTURE.md](ARCHITECTURE.md), [DEVELOPMENT.md](DEVELOPMENT.md) e [HANDOFF.md](HANDOFF.md) para decisões e pontos de extensão.

## Limites atuais

- A interface consulta a API a cada quatro segundos.
- Esta versão é destinada somente ao Windows. macOS e Linux não foram validados; no macOS, a detecção de sessões órfãs ainda não funciona. Em 08/10/2026, uma sessão real do Claude Code com subagente Explore foi capturada no Windows, e a API exibiu a filha concluída e o principal trabalhando novamente.
- O suporte de hooks foi validado com o formato documentado do Claude Code. O registro assistido usa o arquivo global de configurações do usuário; configurações gerenciadas pela organização podem impedir hooks locais.
- O serviço é local e não fornece autenticação ou acesso remoto.

## Inspiração visual

A sala pixel foi inspirada pelo [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents), da equipe Pixel Agents. Os personagens e móveis foram criados para este projeto; nenhum asset do Pixel Agents é usado.

A vida social foi inspirada pelo [Habblaud](https://github.com/marmottajr/habblaud) (MIT), de Márcio Junior. A ideia foi reimplementada aqui com código e arte próprios; nenhum arquivo do Habblaud é usado.

## Licença

Distribuído sob a [licença MIT](LICENSE).
