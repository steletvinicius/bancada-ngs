# Pacote pré-PCR → pós-PCR (versão 1)

Arquivo JSON gerado no fim do módulo pré-PCR (etapa **Placa de PCR → Gerar pacote pós-PCR**), um por bateria. Nome: `<mapas>_pre-pcr.json`, por exemplo `LMX01012026EXA01PL01_pre-pcr.json`. Não contém nomes de pacientes.

O pós-PCR aceita **vários pacotes na mesma rodada** e **parte dos poços de um pacote**. Cada pacote é identificado por `run.batch` + `generatedAt`; o pós-PCR guarda, no navegador, quais poços de cada pacote já entraram em alguma rodada.

```json
{
  "schema": "bancada-ngs/pre-pcr-handoff",
  "version": 1,
  "generatedAt": "2026-10-31T13:40:00.000Z",
  "protocol": { "id": "alltype-ngs-11-loci-meia", "name": "Altype NGS 11 Loci - meia receita", "version": "0.3" },
  "run": { "name": "LMX01012026EXA01PL01", "batch": "LMX01012026EXA01PL01", "operator": "…", "date": "2026-10-31" },
  "thermocycler": { "id": "TC-03", "description": "…" },
  "reagents": [ { "mix": "Alltype multiplex", "component": "AllType Polimerase", "reagent": "AllType Polimerase", "lot": "L2611", "expiry": "2027-06-30" } ],
  "batch": { "mapCodes": ["LMX01012026EXA01", "LMX01012026PL01"], "qasFile": "LMX01012026EXA01PL01.QAS" },
  "normalization": {
    "mode": "qiagility", "targetConc": 7, "finalVol": 4.3, "minVol": 1,
    "postRun": { "file": "… Report AAAA-MM-DD_hh-mm-ss.htm", "result": "ok | warn | bad", "qasFile": "…", "robotSerial": "…", "start": "…", "stop": "…" }
  },
  "pcr": { "mix": ["Alltype multiplex"], "reactions": 9, "reactionVol": 10 },
  "plate": {
    "format": 96, "order": "column",
    "wells": [
      { "well": "A1", "pos": 1, "code": "2000101_ABC", "il": "2000101", "type": "sample", "source": "stock",
        "stockConc": 30.0, "dnaVol": 1.0, "diluentVol": 3.3, "finalConc": 7, "adjusted": false, "validation": "ok" }
    ]
  },
  "steps": [ { "id": "bateria", "name": "Bateria de testes", "done": 4, "total": 4 } ]
}
```

| Campo | Significado |
|---|---|
| `plate.wells[].type` | `sample`, `cp` (controle positivo), `cn` (controle negativo), `ctl` |
| `source` | `stock` (placa de estoque), `tube` (microtubo no bloco R1 do QIAgility, ex.: controle positivo), `diluent` (diluente/água), `manual` (adicionado à mão) |
| `finalConc` | concentração final prevista no poço (ng/µL); com `adjusted: true` o robô pipetou o volume mínimo e a concentração ficou acima do alvo |
| `reagents` | lote e validade (AAAA-MM-DD) de cada componente do master mix; `lot: null` quando não registrado |
| `thermocycler` | termociclador escolhido na etapa Placa de PCR (`null` se não informado) |
| `validation` | resultado da conferência com o relatório pós-corrida: `ok`, `warn`, `bad`, `manual` ou `null` (sem relatório) |

Mudanças incompatíveis aumentam `version`. O pós-PCR recusa `schema` desconhecido.
