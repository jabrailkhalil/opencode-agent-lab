"""Optional PDF authoring tool; requires reportlab and pypdf, never used at startup."""
import json
import math
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
TMP = ROOT / 'artifacts/workflow-guide'
TMP.mkdir(parents=True, exist_ok=True)
FONT = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('Guide', str(FONT / 'segoeui.ttf')))
pdfmetrics.registerFont(TTFont('GuideBold', str(FONT / 'segoeuib.ttf')))
W, H = landscape(A4)
INK = '#273249'
MUTED = '#687b95'
ROLE = {'analyst': ('Аналитик', '#4c63b6'), 'designer': ('Дизайнер', '#947249'),
        'developer': ('Разработчик', '#2c8171'), 'tester': ('Тестировщик', '#8c5e9d')}
ORDER = list(ROLE)
model = json.loads((TMP / 'model.json').read_text(encoding='utf-8'))
pdf = canvas.Canvas(str(TMP / 'workflow-pages.pdf'), pagesize=(W, H))
pdf.setTitle('OpenCode: порядок заданий, spec-driven и пошаговый гайд')
pdf.setAuthor('')
page = 0

def para(text, x, y, width, size=10.5, color=INK, bold=False):
    style = ParagraphStyle('p', fontName='GuideBold' if bold else 'Guide', fontSize=size,
                           leading=size*1.35, textColor=colors.HexColor(color))
    p = Paragraph(escape(text), style)
    _, height = p.wrap(width, H)
    p.drawOn(pdf, x, H-y-height)
    return height

def box(x, y, width, height, fill='#ffffff', stroke='#dfe5ef'):
    pdf.setFillColor(colors.HexColor(fill))
    pdf.setStrokeColor(colors.HexColor(stroke))
    pdf.roundRect(x, H-y-height, width, height, 9, fill=1, stroke=1)

def line(points, dashed=False):
    pdf.setStrokeColor(colors.HexColor('#99a8bf'))
    pdf.setLineWidth(1.2)
    pdf.setDash(3, 3) if dashed else pdf.setDash()
    p = pdf.beginPath()
    for i, (x, y) in enumerate(points):
        (p.moveTo if i == 0 else p.lineTo)(x, H-y)
    pdf.drawPath(p)
    pdf.setDash()
    (x0, y0), (x, y) = points[-2:]
    angle = math.atan2(y-y0, x-x0)
    for a in (-0.5, 0.5):
        pdf.line(x, H-y, x-6*math.cos(angle+a), H-(y-6*math.sin(angle+a)))

def begin(title, subtitle):
    global page
    page += 1
    pdf.setFillColor(colors.HexColor('#f7f9fc'))
    pdf.rect(0, 0, W, H, fill=1, stroke=0)
    para(title, 28, 22, W-56, 21, bold=True)
    para(subtitle, 28, 55, W-56, 10, MUTED)

def finish():
    para('Актуальные схемы | OpenCode Agent Lab | Порядок из сохранённых прогонов | '+str(page),
         28, H-25, W-56, 8, MUTED)
    pdf.showPage()

def method(spec):
    begin('Spec-driven: от правил к проверяемому результату' if spec else 'Прямые задания: контекст передаётся по мере работы',
          'Ведущий управляет очередностью. Роли не вызывают друг друга; в записи помощник подставляет нужную роль и задание.')
    box(28, 91, W-56, 59, '#edf2ff')
    para('Каждое обращение: выбрать роль -> передать входы -> отправить задание -> получить ответ и файлы.',
         43, 101, W-86, 12, bold=True)
    para('Получатель следующего задания зависит от готовых документов, замечаний и новых наблюдений.',
         43, 125, W-86, 10, MUTED)
    box(28, 169, 240, 100)
    para('Исходные договорённости', 42, 181, 210, 13, bold=True)
    para('Бриф, интерфейсы, данные, референс UI и исходные приёмочные тесты.', 42, 208, 210, 10.5, MUTED)
    box(304, 169, W-332, 100)
    para('Аналитик получает первое задание', 320, 181, W-364, 13, '#4c63b6', True)
    para('Создаёт ANALYSIS.md и артефакты OpenSpec: proposal, spec, первоначальный design и tasks.' if spec
         else 'Создаёт ANALYSIS.md: формулы, неоднозначности, предложенные решения.', 320, 208, W-364, 10.5, MUTED)
    line([(270, 218), (299, 218)])
    line([(565, 271), (565, 281)])
    box(28, 286, W-56, 75, '#edf2ff' if spec else '#eef2f6')
    para('Общий источник правил: spec.md, design.md, tasks.md' if spec else 'Общий контекст: бриф, анализ, отчёты и прямые задания',
         43, 296, W-86, 13, bold=True)
    para('Ведущий запускает строгую валидацию; замечания возвращает аналитику отдельным заданием. Исправленный документ проверяется повторно. Формат спецификации и качество приложения проверяются раздельно.' if spec else
         'В этой ветке тоже есть план и тесты. Новые условия передаются через промпты и отчёты, без отдельного набора артефактов OpenSpec и его валидации.', 43, 322, W-86, 10, MUTED)
    descriptions = [
        ('designer', 'Получает правила и анализ. Создаёт план UI'+('; уточняет design.md.' if spec else '.')),
        ('developer', 'Получает план, контракт'+(' и tasks.md.' if spec else ' и бриф.')+' Пишет dist/; запускает тесты.'),
        ('tester', 'Получает код'+(' и сценарии.' if spec else ', бриф и тесты.')+' Проверяет; фиксирует QA и непроверенные пункты.')]
    for i, (role, body) in enumerate(descriptions):
        x = 28+i*267
        box(x, 385, 251, 91)
        para(ROLE[role][0], x+14, 396, 225, 13, ROLE[role][1], True)
        para(body, x+14, 424, 223, 10, MUTED)
        line([(x+125, 363), (x+125, 381)])
    box(28, 496, W-56, 59)
    para('Новые факты -> адресное задание -> исправление -> повторная проверка', 43, 505, W-86, 12, bold=True)
    para(('При изменении правила оно возвращается в WHEN/THEN и задачи. В Qwen это отдельное обращение qspec-11.' if spec else
          'При проблеме раскладки задание возвращается дизайнеру; код исправляет разработчик; итог сводит аналитик.'), 43, 530, W-86, 9.5, MUTED)
    line([(W-27, 522), (W-12, 522), (W-12, 323), (W-27, 323)])
    finish()

method(True)
method(False)
for run in sorted(model, key=lambda r: ['qwen-spec','qwen-direct','sonnet-spec','sonnet-direct'].index(r['id'])):
    rows = run['stages']
    parts = math.ceil(len(rows)/6)
    for part in range(parts):
        subset = rows[part*6:(part+1)*6]
        begin(run['label']+' | порядок заданий '+str(part+1)+'/'+str(parts),
              'Каждая строка - новое обращение ведущего. Читайте сверху вниз; возврат роли показан отдельной строкой.')
        box(28, 84, W-56, 39, '#edf2ff')
        para('Выбор роли -> конкретные документы и наблюдения -> ответ и сохранённые файлы. Номер = обращение, не общий круг четырёх агентов.',
             39, 93, W-78, 10)
        for j, role in enumerate(ORDER):
            para(ROLE[role][0], 54+j*83, 137, 81, 10, ROLE[role][1], True)
        para('Вход / задание / результат', 409, 137, 390, 10, MUTED, True)
        top, step = 164, 60
        for k, s in enumerate(subset):
            y = top+k*step
            idx = ORDER.index(s['role'])
            cx = 91+idx*83
            if k:
                px = 91+ORDER.index(subset[k-1]['role'])*83
                line([(px, y-step+42), (px,y-7), (cx,y-7), (cx,y-2)])
            para(str(s['number']).zfill(2), 28, y+10, 23, 10, MUTED, True)
            box(cx-38, y, 76, 42, '#ffffff', ROLE[s['role']][1])
            para(ROLE[s['role']][0], cx-33, y+5, 67, 8.3, ROLE[s['role']][1], True)
            para(s['id'], cx-33, y+24, 70, 8.5, MUTED)
            line([(cx+38,y+20),(397,y+20)], True)
            box(405,y-1,W-433,56)
            # Three labelled lines; automatic wrapping keeps file names readable.
            for n, (label, key) in enumerate([('Вход','input'),('Задача','action'),('Выход','output')]):
                para(label, 414, y+3+n*17, 36, 7.5, MUTED, True)
                para(s[key], 453, y+3+n*17, W-493, 7.8, INK)
        note_y = 536
        if run['spec']:
            text = ('qspec-11: аналитик фиксирует новые WHEN/THEN и уточняет tasks.md; непроверенные пункты остаются открыты.' if run['id']=='qwen-spec' else
                    'Sonnet завершает итогом FINAL.md; отдельного заключительного задания на обновление spec.md в этой записи нет.')
        else:
            text = 'Бриф, тесты и дизайн-план есть. Уточнения идут через задания и отчёты, без артефактов OpenSpec.'
        if part == parts-1 and run.get('refinement'):
            text += ' Далее - отдельная подготовленная UI-итерация по общему контракту; не API-вызов модели.'
        para(text, 28, note_y, W-56, 8.3, MUTED)
        finish()
pdf.save()

writer = PdfWriter()
writer.append(str(TMP / 'workflow-pages.pdf'))
original = ROOT / 'docs/pdf/OpenCode-Step-by-Step-2026-10-07.pdf'
writer.append(str(original))
writer.add_metadata({'/Title':'OpenCode: актуальные схемы и исходный пошаговый гайд','/Author':''})
writer.add_outline_item('Актуальные схемы: spec-driven и адресные задания', 0)
writer.add_outline_item('Исходная пошаговая инструкция от 7 октября', page)
destination = OUT / 'OpenCode-Guide-with-Workflows.pdf'
with destination.open('wb') as stream:
    writer.write(stream)
published = ROOT / 'docs/pdf/OpenCode-Guide-with-Workflows.pdf'
published.write_bytes(destination.read_bytes())
print(json.dumps({'workflowPages':page,'originalPages':len(PdfReader(original).pages),
                  'totalPages':len(PdfReader(published).pages),'file':str(published)}, ensure_ascii=False))
