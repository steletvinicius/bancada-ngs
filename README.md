# Bancada NGS

Apps web para o preparo de bibliotecas NGS, divididos pela área do laboratório. Todos os arquivos ficam na raiz do repositório (sem pastas), para facilitar o envio pelo site do GitHub.

## Arquivos do site

| Arquivo | O que é |
|---|---|
| `index.html` | Portal com os módulos |
| `pre-pcr.html` | Módulo pré-PCR: bateria de testes → normalização do DNA genômico → master mix → placa de PCR |
| `pos-pcr.html` | Módulo pós-PCR (em construção); entrada = pacote `_pre-pcr.json` |

## Arquivos de dados (editáveis)

O `pre-pcr.html` lê estes arquivos toda vez que é aberto. Para mudar algo **para todos os computadores**, edite o arquivo e envie ao GitHub (Add file → Upload files, ou o lápis ✎ para editar direto no site). Em 1–2 minutos o app passa a usar a versão nova.

| Arquivo | Conteúdo | Muda quando… |
|---|---|---|
| `fluxo-pre-pcr.json` | Estrutura comum a todos os protocolos: etapas, descrições e checklists | o procedimento do laboratório muda |
| `kits.json` | Um item por kit: QC da amostra, normalização, reagentes do master mix com volume por amostra, termociclagem | entra um kit novo ou muda uma receita |
| `tecnicos.json` | Técnicos | entra ou sai alguém |
| `reagentes.json` | Lotes e validades | chega um lote novo |
| `termocicladores.json` | Termocicladores | muda o parque de equipamentos |

O seletor **Protocolo** do app lista os kits; o app monta o protocolo juntando o fluxo com o kit escolhido. Também dá para editar pelo próprio app (**Editar protocolo** → abas Kit e Fluxo; **Cadastros**): as alterações valem logo naquele computador e o app oferece **Baixar** o arquivo atualizado para enviar ao GitHub.

### `kits.json`

```json
{
  "atualizadoEm": "31/10/2026",
  "kits": [
    {
      "id": "altype-ngs-11-loci-meia",
      "nome": "Altype NGS 11 Loci - meia receita",
      "versao": "0.3",
      "descricao": "Genotipagem HLA de 11 loci amplificados juntos em um único poço (meia receita).",
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
        "nome": "HLA multiplex",
        "volumeReacao": 25,
        "volumeDNA": 4.3,
        "excedentePercentual": 10,
        "reagentes": [
          { "nome": "Tampão de PCR 5×", "volumePorAmostra": 5 },
          { "nome": "DNA polimerase", "volumePorAmostra": 0.5 }
        ]
      },
      "termociclagem": [
        { "etapa": "Desnaturação inicial", "temperatura": "95 °C", "tempo": "3 min", "ciclos": "1" }
      ],
      "avisos": []
    }
  ]
}
```

- Volumes em µL; concentrações em ng/µL. `volumePorAmostra` é o volume de cada reagente por reação; o app multiplica pelo número de reações + excedente.
- A soma dos reagentes + `volumeDNA` deve dar `volumeReacao`; o app avisa se não fechar.
- `modoPadrao`: `"qiagility"` ou `"bancada"`.
- Para um kit novo, copie um bloco `{ … }` inteiro, mude `id` e `nome`, e separe os kits com vírgula.

### `fluxo-pre-pcr.json`

Lista `etapas`, cada uma com `id`, `nome`, `tipo` (`intake`, `normalize`, `mastermix`, `plate`), `descricao` e checklist (`checklist`; na normalização, `checklistQIAgility` e `checklistBancada`). Um item de texto é um passo de bancada que o técnico marca; `{ "texto": "...", "auto": "<chave>" }` é marcado pelo app quando ele comprova a ação (`txt-loaded`, `maps-loaded`, `intake-ok`, `qas-generated`, `postrun-ok`, `lots-ok`, `cycler-set`, `handoff-done`); `"quando": "has-manual"` faz o item aparecer só quando há poços a completar à mão. Não mude o `id` das etapas: as corridas salvas usam esses ids.

### `tecnicos.json`, `reagentes.json`, `termocicladores.json`

```json
{ "atualizadoEm": "31/10/2026", "tecnicos": [ { "nome": "Ana Souza" } ] }
```
```json
{ "atualizadoEm": "31/10/2026", "reagentes": [
  { "nome": "DNA polimerase", "lote": "L2611", "validade": "30/06/2027" }
] }
```
```json
{ "atualizadoEm": "31/10/2026", "termocicladores": [ { "id": "TC-03", "descricao": "Veriti 96 – sala pré-PCR" } ] }
```

No `reagentes.json`, use o mesmo nome do reagente no `kits.json` para o lote aparecer primeiro na lista daquele componente. Validade em dd/mm/aaaa.

## Código-fonte

`pre-pcr.html` é gerado por `python3 build.py` a partir de `fonte-app.html`, `fonte-core.js`, `fonte-modelo-qiagility.qas`, `fluxo-pre-pcr.json` e `kits.json` (as cópias embutidas só são usadas se os arquivos do site não puderem ser lidos). Não é preciso rodar o build para mudar dados: basta editar os `.json`.

## Publicar no GitHub Pages

**Settings → Pages → Deploy from a branch**, branch `main`, pasta `/ (root)`. Endereços: `https://<usuario>.github.io/bancada-ngs/` e `…/pre-pcr.html`.

Tudo roda no navegador. Listas do LIMS, mapas PDF e relatórios do QIAgility são lidos localmente e não saem do computador. O app guarda apenas os códigos `IL_INICIAIS`, nunca nomes de pacientes.

Formato do pacote entregue ao pós-PCR: `pacote-pre-pcr-v1.md`.
