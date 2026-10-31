#!/usr/bin/env python3
"""Gera pre-pcr.html a partir de fonte-app.html + fonte-core.js + fonte-modelo-qiagility.qas + fluxo-pre-pcr.json + kits.json.

O pre-pcr.html lê fluxo-pre-pcr.json, kits.json, tecnicos.json, reagentes.json e termocicladores.json do site ao abrir;
as cópias de fluxo e kits embutidas aqui é só reserva, para quando o arquivo não puder ser lido.
Uso: python3 build.py
"""
import json, pathlib
root = pathlib.Path(__file__).parent
src = (root / 'fonte-app.html').read_text(encoding='utf-8')
core = (root / 'fonte-core.js').read_text(encoding='utf-8')
tpl = (root / 'fonte-modelo-qiagility.qas').read_text(encoding='utf-8')
flow = json.loads((root / 'fluxo-pre-pcr.json').read_text(encoding='utf-8'))
kits = json.loads((root / 'kits.json').read_text(encoding='utf-8'))
body = (src.replace('/*__CORE__*/', core)
           .replace('/*__TEMPLATE__*/""', json.dumps(tpl, ensure_ascii=False))
           .replace('/*__FLOW__*/{ "etapas": [] }', json.dumps(flow, ensure_ascii=False))
           .replace('/*__KITS__*/{ "kits": [] }', json.dumps(kits, ensure_ascii=False)))
assert '/*__' not in body, 'marcador não substituído'
head = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n')
(root / 'pre-pcr.html').write_text(head + body + '\n</body>\n</html>\n', encoding='utf-8')
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/pre-pcr-artifact.html').write_text(body, encoding='utf-8')
print('pre-pcr.html gerado')
