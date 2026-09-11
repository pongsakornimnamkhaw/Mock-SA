import zipfile
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

src = Path(r"D:\SA\Doc\เอกสาร SA jingjing.docx")
out = Path(r"D:\SA\Mock-SA\_docx_media")
out.mkdir(exist_ok=True)
thumbs = []
with zipfile.ZipFile(src) as z:
    for name in [n for n in z.namelist() if n.startswith("word/media/")]:
        dst = out / Path(name).name
        dst.write_bytes(z.read(name))
        im = Image.open(dst).convert("RGB")
        im.thumbnail((420, 420))
        canvas = Image.new("RGB", (460, 470), "white")
        canvas.paste(im, ((460-im.width)//2, 35))
        ImageDraw.Draw(canvas).text((10, 10), dst.name, fill="black")
        thumbs.append(canvas)

sheet = Image.new("RGB", (920, 940), "#dddddd")
for i, im in enumerate(thumbs):
    sheet.paste(im, ((i % 2) * 460, (i // 2) * 470))
sheet.save(out / "contact.png")
