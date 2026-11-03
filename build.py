#!/usr/bin/env python3
"""Gera pre-pcr.html e pos-pcr.html a partir do mesmo motor (fonte-app.html + fonte-core.js).

Cada módulo lê do site, ao abrir: o seu fluxo (fluxo-pre-pcr.json ou fluxo-pos-pcr.json), kits.json,
tecnicos.json, reagentes.json e termocicladores.json. As cópias de fluxo e kits embutidas aqui são reserva,
para quando os arquivos não puderem ser lidos.
Uso: python3 build.py
"""
import json, pathlib
root = pathlib.Path(__file__).parent
read = lambda n: (root / n).read_text(encoding='utf-8')
src, core, tpl = read('fonte-app.html'), read('fonte-core.js'), read('fonte-modelo-qiagility.qas')
kits = json.loads(read('kits.json'))
head = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n')
(root / 'dist').mkdir(exist_ok=True)
for mod, out, flow_file, title in [('pre', 'pre-pcr.html', 'fluxo-pre-pcr.json', 'Bancada NGS Pré-PCR'), ('pos', 'pos-pcr.html', 'fluxo-pos-pcr.json', 'Bancada NGS Pós-PCR')]:
    flow = json.loads(read(flow_file))
    body = (src.replace('/*__CORE__*/', core)
               .replace('/*__TEMPLATE__*/""', json.dumps(tpl, ensure_ascii=False))
               .replace('/*__FLOW__*/{ "etapas": [] }', json.dumps(flow, ensure_ascii=False))
               .replace('/*__KITS__*/{ "kits": [] }', json.dumps(kits, ensure_ascii=False))
               .replace("/*__MODULE__*/'pre'", repr(mod))
               .replace('<title>Bancada NGS Pré-PCR</title>', f'<title>{title}</title>', 1))
    assert '/*__' not in body, 'marcador não substituído'
    (root / out).write_text(head + body + '\n</body>\n</html>\n', encoding='utf-8')
    # na prévia (artifact) não há o portal index.html: o atalho para a Home só existe no site
    art = '\n'.join(l for l in body.split('\n') if 'data-home' not in l)
    (root / 'dist' / out.replace('.html', '-artifact.html')).write_text(art, encoding='utf-8')
    print(out, 'gerado')
