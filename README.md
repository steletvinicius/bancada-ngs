# Bancada NGS

Apps web para o preparo de bibliotecas NGS, divididos pela área do laboratório. Todos os arquivos ficam na raiz do repositório (sem pastas), para facilitar o envio pelo site do GitHub.

| Arquivo | O que é |
|---|---|
| `index.html` | Portal com os módulos |
| `pre-pcr.html` | Módulo pré-PCR: bateria de testes → normalização do DNA genômico → master mix → placa de PCR |
| `pos-pcr.html` | Módulo pós-PCR: amplicons da PCR (um ou vários pacotes `_pre-pcr.json`, completos ou parciais) → purificação AMPure → quantificação Qubit e diluição → fragmentação → ligação dos barcodes → seleção de tamanho → amplificação secundária → purificação 1:1 → Qubit HS e pool equimolar → purificação do pool → quantificação do pool final |

## Arquivos de dados (editáveis)

Os apps leem estes arquivos toda vez que são abertos. Para mudar algo **para todos os computadores**, edite o arquivo e envie ao GitHub (Add file → Upload files, ou o lápis ✎ para editar direto no site). Em 1–2 minutos o app passa a usar a versão nova.

| Arquivo | Conteúdo | Muda quando… |
|---|---|---|
| `fluxo-pre-pcr.json` | Estrutura comum do pré-PCR: etapas, descrições e checklists | o procedimento do laboratório muda |
| `fluxo-pos-pcr.json` | Estrutura comum do pós-PCR: etapas, descrições e checklists (com cronômetros) | o procedimento do laboratório muda |
| `kits.json` | Um item por kit: QC da amostra, normalização, reagentes do master mix com volume por amostra, termociclagem e, em `posPcr`, volumes e tempos do pós-PCR | entra um kit novo ou muda uma receita |
| `tecnicos.json` | Técnicos | entra ou sai alguém |
| `reagentes.json` | Lotes e validades | chega um lote novo |
| `termocicladores.json` | Termocicladores | muda o parque de equipamentos |

O seletor **Protocolo** lista os kits; o app monta o protocolo juntando o fluxo do módulo com o kit escolhido. Também dá para editar pelo próprio app (**Editar protocolo** → abas Kit e Fluxo; **Cadastros**): as alterações valem logo naquele computador e o app oferece **Baixar** o arquivo atualizado para enviar ao GitHub.

### `kits.json`

```json
{
  "atualizadoEm": "03/11/2026",
  "kits": [
    {
      "id": "alltype-ngs-11-loci-meia",
      "nome": "Altype NGS 11 Loci - meia receita",
      "versao": "0.3",
      "descricao": "…",
      "qc": { "concMinima": 7, "razao260280Min": 1.6, "razao260280Max": 2.1 },
      "normalizacao": {
        "concAlvo": 7,
        "volumeFinal": 4.3,
        "modoPadrao": "qiagility",
        "volumeMinimoRobo": 1,
        "volumeMortoDiluente": 15,
        "abaixoDoAlvoUsarPuro": true,
        "ajusteAutomatico": true,
        "itensManuaisNoFim": true,
        "bancada": { "volumePreparo": 20, "volumeMinimo": 1, "volumeMaximo": 100 }
      },
      "masterMix": {
        "nome": "Alltype multiplex",
        "volumeReacao": 10,
        "volumeDNA": 4.3,
        "excedentePercentual": 10,
        "reagentes": [
          { "nome": "Alltype Buffer", "volumePorAmostra": 2 },
          { "nome": "AllType Polimerase", "volumePorAmostra": 0.4 }
        ]
      },
      "termociclagem": [
        { "etapa": "Desnaturação inicial", "temperatura": "95 °C", "tempo": "3 min", "ciclos": "1" }
      ],
      "avisos": [],
      "posPcr": {
        "limpezaAmplicons": {
          "nome": "Purificação AMPure 0,6×",
          "volumeAmostra": 10,
          "razaoBeads": 0.6,
          "volumeEtanol": 50,
          "lavagensEtanol": 2,
          "etanolPercentual": 75,
          "volumeEluicao": 13.5,
          "volumeTransferencia": 12.5,
          "excedentePercentual": 10,
          "reagentes": { "beads": "AMPure XP beads", "etanol": "Etanol absoluto", "eluicao": "Low TE" },
          "excedenteEtanolPercentual": 20,
          "tempos": { "ambientarBeadsMin": 30, "ligacaoMin": 5, "etanolSeg": 30, "eluicaoMin": 2 }
        },
        "quantificacao": {
          "metodo": "Qubit dsDNA BR", "volumeInput": 1, "massaAlvo": 50, "volumeFinal": 17.5,
          "diluente": "Água livre de nuclease", "volumeMinimo": 1, "casasDecimais": 1,
          "fracaoAmostragem": 0.30, "fracaoFaixa": 0.15, "faixaMin": 20, "faixaMax": 50,
          "qubit": { "padroes": 2, "volumePadrao": 10, "volumeTrabalho": 200, "diluicaoReagente": 200, "excedentePercentual": 10 },
          "reagentes": { "kit": "Qubit dsDNA BR Assay Kit" },
          "tempos": { "incubacaoMin": 2 }
        },
        "mixFragmentacao": {
          "nome": "Mix de fragmentação", "volumeAmostra": 17.5, "excedentePercentual": 10,
          "reagentes": [
            { "nome": "AllType Fragmentase", "volumePorAmostra": 4.5 },
            { "nome": "AllType Fragmentation Buffer", "volumePorAmostra": 2.5 }
          ]
        },
        "mixLigacao": {
          "nome": "Mix de ligação", "volumeAmostra": 24.5, "excedentePercentual": 10,
          "reagentes": [ { "nome": "Água Ultrapura", "volumePorAmostra": 12.5 }, { "nome": "Alltype Ligase buffer", "volumePorAmostra": 5.0 } ],
          "barcode": { "nome": "AllType Barcode", "volumePorAmostra": 2.0, "placas": ["01", "02", "03", "04"] }
        }
      }
    }
  ]
}
```

- Volumes em µL; concentrações em ng/µL. `volumePorAmostra` é o volume de cada reagente por reação; o app multiplica pelo número de reações + excedente.
- A soma dos reagentes + `volumeDNA` deve dar `volumeReacao`; o app avisa se não fechar.
- `modoPadrao`: `"qiagility"` ou `"bancada"`.
- Em `posPcr.limpezaAmplicons`, o volume de beads por poço é `razaoBeads × volumeAmostra`; os nomes em `reagentes` são os usados para escolher o lote. `excedenteEtanolPercentual` é a margem do etanol 75% (independente do excedente das beads).
- Em `posPcr.quantificacao`: o app sugere quantificar os controles + `fracaoAmostragem` das amostras; `fracaoFaixa` delas na faixa de DNA inicial `faixaMin`–`faixaMax` ng/µL e o restante nos extremos (mais baixa e mais alta). Volume de amplicon = `massaAlvo` ÷ concentração, completado com `diluente` até `volumeFinal`; poços sem leitura usam a mediana das leituras.
- Na quantificação, volumes calculados abaixo de `volumeMinimo` (1 µL) são arredondados para 1 µL (sem pré-diluição). A mediana usa os volumes calculados originais, sem arredondar, e só o resultado é arredondado para 1 µL quando ficar abaixo disso. Nos amplicons quantificados, o técnico marca “Usei o calculado”; desmarcado, o poço usa o volume da mediana.
- Em `posPcr.mixLigacao`, `reagentes` é o mix comum; o `barcode` é adicionado à parte, um por poço (placa de `placas` + poço A1–H12). O app autopreenche a partir do primeiro poço informado (por coluna, passando para a próxima placa depois do H12), não aceita a mesma placa + poço em dois amplicons e registra, neste navegador, os barcodes já usados em rodadas anteriores.
- Blocos de purificação (`limpezaAmplicons`, `selecaoTamanho`, `limpezaBiblioteca`, `limpezaPool`): `volumeBeads` fixa o volume de beads (senão, `razaoBeads × volumeAmostra`); `selecao` (`volumeBeadsNegativa`, `volumeTransferencia1`, `volumeBeadsPositiva`, `volumeDescarte`) faz a seleção dupla; `tuboUnico: true` trata a purificação como um tubo só (pool).
- Blocos de mix do pós-PCR (`mixFragmentacao`, `mixLigacao`, `mixAmplificacao`) aceitam `termociclagem` (mesmo formato do pré-PCR), mostrada na etapa.
- `pool`: `volumeMaximo` (µL da biblioteca menos concentrada), `volumeMinimoPool` e `concMinimaPool` (o Low TE só completa o pool até onde a concentração continua ≥ esse valor), `referencia` padrão (`min`, `tukey`, `p10`, `q1`; o técnico pode trocar na tela ou digitar um valor manual). O controle negativo entra com `volumeControleNegativo` (padrão: `volumeMaximo`).
- `poolFinal`: `alvoNm` (padrão 4) e, opcionalmente, `tamanhoMedioPb` para calcular a molaridade.
- Um kit sem o bloco `posPcr` (ou sem um dos sub-blocos) mostra a etapa correspondente como “sem parâmetros”.
- Para um kit novo, copie um bloco `{ … }` inteiro, mude `id` e `nome`, e separe os kits com vírgula. Evite mudar o `id` de um kit em uso: as corridas e os pacotes guardam esse id.

### `fluxo-pre-pcr.json` e `fluxo-pos-pcr.json`

Lista `etapas`, cada uma com `id`, `nome`, `tipo` e checklist. Tipos: `intake` (bateria), `normalize`, `mastermix`, `plate` no pré-PCR; `handoff` (pacotes do pré-PCR), `cleanup` (purificação com beads), `quant` (quantificação e diluição), `barcode` (mix de ligação + barcode por poço), `pool` (Qubit HS de todas e pool equimolar), `poolqc` (quantificação final) e `mix` (mix com reagentes por poço, ex.: fragmentação) no pós-PCR. Nas etapas do pós-PCR, `"parametros"` aponta o sub-bloco de `posPcr` do kit.

- Um item de texto é um passo de bancada que o técnico marca.
- `{ "texto": "...", "auto": "<chave>" }` é marcado pelo app quando ele comprova a ação: `txt-loaded`, `maps-loaded`, `intake-ok`, `qas-generated`, `postrun-ok`, `lots-ok`, `cycler-set`, `handoff-done`, `pkg-loaded`, `pkg-ok`, `quant-sel`, `quant-done`, `bc-ok`, `pool-read`, `pool-ok`, `poolqc-read`.
- `"quando": "has-manual"` faz o item aparecer só quando há poços a completar à mão.
- `"timer": "ligacaoMin"` dá cronômetro ao item (chaves de `tempos` terminadas em `Min` são minutos; em `Seg`, segundos). `"alerta": true` destaca o item.
- `"icone": "magneto"` (placa na rack magnética) ou `"icone": "gelo"` mostra o ícone ao lado do passo; a etapa exibe no topo os ícones dos seus passos. `"icones": ["gelo"]` na etapa força o ícone no topo.
- Nos textos do pós-PCR, `{beads}`, `{amostra}`, `{razao}`, `{etanol}`, `{etanolPct}`, `{eluicao}`, `{transferencia}`, `{reagenteBeads}`, `{reagenteEluicao}` `{etanolTotal}`, `{etanolAbs}`, `{etanolAgua}`, `{etanolMargem}`, `{reagenteEtanol}` (purificação); `{input}`, `{massa}`, `{volumeFinal}`, `{trabalhoTotal}`, `{trabalhoReagente}`, `{trabalhoTampao}`, `{tubosQubit}`, `{volTrabalhoAmostra}`, `{volTrabalhoPadrao}`, `{volPadrao}`, `{reagenteQubit}` (quantificação); `{mixPorPoco}`, `{amostra}`, `{reagente1}`, `{reagente2}` (mix); `{barcodeVol}`, `{reagenteEnzimas}` (ligação); e os nomes em `tempos` são trocados pelos valores do kit.
- Não mude o `id` das etapas: as corridas salvas usam esses ids.

### `tecnicos.json`, `reagentes.json`, `termocicladores.json`

```json
{ "atualizadoEm": "03/11/2026", "tecnicos": [ { "nome": "Ana Souza" } ] }
```
```json
{ "atualizadoEm": "03/11/2026", "reagentes": [
  { "nome": "AllType Polimerase", "lote": "L2611", "validade": "30/06/2027" }
] }
```
```json
{ "atualizadoEm": "03/11/2026", "termocicladores": [ { "id": "TC-03", "descricao": "Veriti 96 – sala pré-PCR" } ] }
```

No `reagentes.json`, use o mesmo nome do reagente no `kits.json` para o lote aparecer primeiro na lista daquele componente. Validade em dd/mm/aaaa.

## Rodadas do pós-PCR

- Carregue um ou mais pacotes `_pre-pcr.json`. Em cada placa, clique nos poços, nas colunas ou nas filas para escolher o que entra na rodada; os botões Todos, Só pendentes e Nenhum ajudam.
- Com uma bateria só, a placa nova pode **manter as posições** da placa de PCR ou ser **compactada**; com várias baterias, os poços são compactados em sequência, por coluna, e a etapa de purificação mostra a tabela origem → poço novo.
- O app registra, neste navegador, quais poços de cada bateria já entraram em uma rodada. Ao carregar a mesma bateria numa rodada seguinte (Limpar → Nova corrida), esses poços vêm desmarcados e marcados como “já em outra rodada”. Remover a bateria da rodada libera os poços.

## Registro da biblioteca

Na última etapa do pós-PCR, **Baixar registro (.json)** gera `<rodada>_biblioteca.json` (schema `bancada-ngs/biblioteca`): por poço, código IL_INICIAIS, bateria e poço de origem, DNA inicial, Qubit do amplicon, normalização usada, barcode (placa + poço), Qubit HS, volume no pool e massa relativa; mais a referência do pool, o pool final e os lotes de todos os reagentes.

## Código-fonte

`pre-pcr.html` e `pos-pcr.html` são gerados por `python3 build.py` a partir do mesmo motor (`fonte-app.html`, `fonte-core.js`) mais `fonte-modelo-qiagility.qas`, o fluxo de cada módulo e `kits.json` (as cópias embutidas só são usadas se os arquivos do site não puderem ser lidos). Não é preciso rodar o build para mudar dados: basta editar os `.json`.

## Publicar no GitHub Pages

**Settings → Pages → Deploy from a branch**, branch `main`, pasta `/ (root)`. Endereços: `https://<usuario>.github.io/bancada-ngs/`, `…/pre-pcr.html` e `…/pos-pcr.html`.

Tudo roda no navegador. Listas do LIMS, mapas PDF, relatórios do QIAgility e pacotes são lidos localmente e não saem do computador. O app guarda apenas os códigos `IL_INICIAIS`, nunca nomes de pacientes.

Formato do pacote entregue ao pós-PCR: `pacote-pre-pcr-v1.md`.
