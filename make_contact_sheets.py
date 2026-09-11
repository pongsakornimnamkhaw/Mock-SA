from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

src=Path(r"D:\SA\Mock-SA\_render_pages")
out=Path(r"D:\SA\Mock-SA\_contact_sheets")
out.mkdir(exist_ok=True)
pages=sorted(src.glob("page-*.png"), key=lambda p:int(p.stem.split('-')[-1]))
for batch in range(0,len(pages),8):
    sheet=Image.new("RGB",(1200,1600),"#cfcfcf")
    for j,p in enumerate(pages[batch:batch+8]):
        im=Image.open(p).convert("RGB"); im.thumbnail((285,750))
        x=(j%4)*300+(300-im.width)//2; y=(j//4)*800+35
        sheet.paste(im,(x,y)); ImageDraw.Draw(sheet).text((x,8+(j//4)*800),f"Page {batch+j+1}",fill="black")
    sheet.save(out/f"contact-{batch+1:02d}-{min(batch+8,len(pages)):02d}.png")
print(len(pages), len(list(out.glob('*.png'))))
