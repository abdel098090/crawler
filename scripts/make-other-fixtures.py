# Developer script: builds protected PDFs and a sample .docx for the tests.
# Run with: python3 scripts/make-other-fixtures.py  (after make-pdf-fixtures.mjs)
import json
from pypdf import PdfReader, PdfWriter
from pypdf.constants import UserAccessPermissions as P
from docx import Document

src = "tests/fixtures/sample-en.pdf"

# 1. Needs a password to open at all.
w = PdfWriter(clone_from=PdfReader(src))
w.encrypt(user_password="secret", owner_password="owner", algorithm="AES-128")
w.write("tests/fixtures/sample-password.pdf")

# 2. Opens without a password, but the author turned off copying and extraction.
w = PdfWriter(clone_from=PdfReader(src))
w.encrypt(user_password="", owner_password="owner", permissions_flag=P.PRINT, algorithm="AES-128")
w.write("tests/fixtures/sample-nocopy.pdf")

# 3. A Word file with Arabic and English and some metadata.
texts = json.load(open("scripts/fixture-texts.json", encoding="utf-8"))
d = Document()
d.core_properties.author = "Ankabut Sample Author"
d.core_properties.title = "Sample Word file"
for lang in ("ar", "en"):
    for h, p in texts[lang]["chapters"]:
        d.add_heading(h, 1)
        d.add_paragraph(p)
d.save("tests/fixtures/sample-mixed.docx")
print("ok")
