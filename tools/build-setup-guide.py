"""Build a focused API setup PDF using the original annotated screenshots."""
from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter

root = Path(__file__).resolve().parents[1]
work = root / 'artifacts/setup-guide'
work.mkdir(parents=True, exist_ok=True)
out = root / 'output/pdf'
out.mkdir(parents=True, exist_ok=True)
fonts = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('Setup', str(fonts / 'segoeui.ttf')))
pdfmetrics.registerFont(TTFont('SetupBold', str(fonts / 'segoeuib.ttf')))
w, h = landscape(A4)
c = canvas.Canvas(str(work / 'cover.pdf'), pagesize=(w, h))
c.setTitle('OpenCode: подключение API, модели и роли')
c.setAuthor('')

def paragraph(text, x, top, width, size=12, color='#273249', bold=False):
    p = Paragraph(escape(text), ParagraphStyle('p', fontName='SetupBold' if bold else 'Setup',
                  fontSize=size, leading=size*1.4, textColor=colors.HexColor(color)))
    _, height = p.wrap(width, h)
    p.drawOn(c, x, h-top-height)
    return height

c.setFillColor(colors.HexColor('#f7f9fc'))
c.rect(0, 0, w, h, fill=1, stroke=0)
paragraph('OpenCode: подключение API и выбор моделей', 35, 29, w-70, 24, bold=True)
paragraph('Три исходных скриншота с обведёнными элементами: проект, поле ключа OpenRouter, выбор роли и отправка.',
          35, 74, w-70, 12, '#65758d')
c.setFillColor(colors.HexColor('#edf2ff'))
c.roundRect(35, h-163, w-70, 55, 9, fill=1, stroke=0)
paragraph('Готовые чекпоинты работают без API-ключа. Подключение ниже нужно только для нового запуска моделей.',
          49, 120, w-98, 13, '#3c55a0', True)

steps = [
    ('1. Создать отдельный проект',
     'В папке комплекта выполнить npm run api:project -- qwen-spec. Другие шаблоны: qwen-direct, sonnet-spec, sonnet-direct. Открыть напечатанную папку через «Добавить проект» в OpenCode.'),
    ('2. Подключить собственного провайдера',
     'Настройки → Провайдеры → OpenRouter → Подключить. Вставить свой API-ключ в обведённое поле, подтвердить кнопкой «Продолжить». В PDF поле пустое; реальный ключ в документы и Git не записывают.'),
    ('3. Выбрать модель и роль',
     'В Настройки → Модели включить доступную модель провайдера; выбрать её под полем сообщения. Рядом выбрать Analyst, Designer, Developer или Tester. Эти роли загружаются из opencode.json подготовленного проекта.'),
    ('4. Проверить режим перед отправкой',
     'Модель с пометкой «запись» воспроизводит сохранённый результат. Настоящая модель провайдера вызывает платный API. Температура в шаблонах не переопределена; Default в интерфейсе не является значением температуры.')
]
y = 184
for title, body in steps:
    paragraph(title, 35, y, w-70, 13, bold=True)
    height = paragraph(body, 35, y+24, w-70, 10.8, '#65758d')
    y += 24+height+16
paragraph('Следующие страницы сохранены из гайда от 7 октября. Имена моделей и папки на скриншотах — примеры прежнего стенда; используйте свою папку и модель, доступную вашему аккаунту.',
          35, h-55, w-70, 9, '#7c8ca3')
c.save()

source = root / 'docs/pdf/OpenCode-Step-by-Step-2026-10-07.pdf'
original = PdfReader(source)
writer = PdfWriter()
writer.append(str(work / 'cover.pdf'))
for index in [7, 8, 9]:
    writer.add_page(original.pages[index])
writer.add_metadata({'/Title':'OpenCode: настройка API и моделей со скриншотами','/Author':''})
writer.add_outline_item('Актуальная последовательность настройки', 0)
writer.add_outline_item('Открыть проект', 1)
writer.add_outline_item('Вставить ключ OpenRouter', 2)
writer.add_outline_item('Выбрать роль и отправить задание', 3)
destination = out / 'OpenCode-API-Setup-Annotated.pdf'
with destination.open('wb') as stream:
    writer.write(stream)
published = root / 'docs/pdf/OpenCode-API-Setup-Annotated.pdf'
published.write_bytes(destination.read_bytes())
print(json.dumps({'pages':len(PdfReader(published).pages),'originalPages':[8,9,10],'file':str(published)},ensure_ascii=False))
