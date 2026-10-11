"""One semantic template serves browser preview and Chromium PDF export."""

import re
from html import escape

from .models import Resume


def markup(text: str, metrics: bool = False) -> str:
    text = escape(text).replace("\n", "<br>")
    if metrics:
        text = re.sub(r"(?<![\w])\d[\d,]*(?:\+|%|x)?", r"<strong>\g<0></strong>", text)
    return text


def safe_url(url: str) -> str:
    return escape(url, quote=True) if re.match(r"^(https?://|mailto:|tel:)", url, re.I) else ""


def render_resume(resume: Resume, preview: bool = False) -> str:
    contacts = " · ".join(
        f'<a href="{safe_url(c.url)}">{markup(c.label)}</a>' if safe_url(c.url) else markup(c.label)
        for c in resume.contacts
    )
    sections = []
    for s in resume.sections:
        if not s.visible or (not s.text.strip() and not s.entries):
            continue
        content = f"<p>{markup(s.text)}</p>" if s.text else ""
        for e in s.entries:
            if s.kind == "skills":
                content += f'<p class="skill-line"><strong>{markup(e.title)}:</strong> {", ".join(markup(b.text) for b in e.bullets)}{markup(e.body)}</p>'
                continue
            title = markup(e.title)
            subtitle = markup(e.subtitle)
            if s.kind == "projects":
                heading = f"{title} <span class='entry-subtitle'>| {subtitle}</span>" if subtitle else title
                subline = ""
            else:
                heading = title
                subline = (
                    f'<div class="subline">{subtitle}{" · " + markup(e.location) if e.location else ""}</div>'
                    if subtitle or e.location
                    else ""
                )
            content += f'<article class="entry"><div class="entry-heading"><h3>{heading}</h3><span class="date">{markup(e.dates)}</span></div>{subline}'
            if e.body:
                content += f'<p class="entry-body">{markup(e.body)}</p>'
            if e.bullets:
                content += (
                    "<ul>" + "".join(f"<li>{markup(b.text, metrics=True)}</li>" for b in e.bullets) + "</ul>"
                )
            content += "</article>"
        sections.append(f"<section><h2>{markup(s.title)}</h2>{content}</section>")
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{escape(resume.name)} - Resume</title><style>
    @font-face {{font-family:'Segoe UI';src:local('Segoe UI');font-weight:400}}
    @font-face {{font-family:'Segoe UI';src:local('Segoe UI Semibold');font-weight:600}}
    @font-face {{font-family:'Segoe UI';src:local('Segoe UI Bold');font-weight:700}}
    *{{box-sizing:border-box}} html{{background:{"#eeefed" if preview else "#fff"};color:#20252e}}
    body{{margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:9.4pt;line-height:1.34;font-weight:400}}
    .document{{width:210mm;min-height:297mm;margin:0 auto;background:white;padding:16mm 17mm 17mm}}
    header{{padding-bottom:3mm}} h1{{font-size:27pt;letter-spacing:-.8pt;line-height:1.12;margin:0 0 2mm;font-weight:700;color:#172234}}
    .headline{{font-size:12pt;font-weight:600;color:#4c5872;margin:0 0 2mm}} .contacts{{font-size:8.6pt;color:#5c6470;line-height:1.65}}
    a{{color:inherit;text-decoration:none}} a:hover{{text-decoration:underline}} h2{{font-size:9.8pt;letter-spacing:1.1pt;text-transform:uppercase;font-weight:700;color:#38476c;border-bottom:1px solid #dce0e7;margin:3.2mm 0 1.7mm;padding-bottom:1.1mm;break-after:avoid}}
    h3{{font-size:10pt;font-weight:700;margin:0}} .entry-heading{{display:flex;justify-content:space-between;gap:4mm;align-items:baseline;break-after:avoid}}
    .entry-subtitle,.subline{{font-weight:600}} .date{{font-size:8.7pt;white-space:nowrap;color:#5c6470;font-weight:400}}
    .subline{{font-size:9.2pt;break-after:avoid}} p{{margin:0 0 1.4mm;orphans:3;widows:3}} .entry{{margin-bottom:2mm;break-inside:avoid}}
    .entry-body{{font-size:8.7pt;color:#576174;margin-top:.8mm;break-after:avoid}} ul{{margin:1.1mm 0 0;padding-left:4.3mm;list-style:disc}}
    li{{padding-left:.4mm;margin:0 0 .9mm;break-inside:avoid;orphans:3;widows:3}} strong{{font-weight:700}} .skill-line{{margin-bottom:1.1mm}}
    @page{{size:A4;margin:16mm 17mm 17mm}} @media print{{html{{background:white}}.document{{width:auto;min-height:0;padding:0;margin:0}}}}
    </style></head><body><main class="document"><header><h1>{markup(resume.name)}</h1><p class="headline">{markup(resume.headline)}</p><div class="contacts">{contacts}</div></header>{"".join(sections)}</main></body></html>"""
