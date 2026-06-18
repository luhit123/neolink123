from __future__ import annotations

import json
import math
import os
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    FrameBreak,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import Flowable


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

PDF_PATH = OUT_DIR / "NeoLink_Two_Month_Pilot_Project_Report_Feb_Mar_2026.pdf"
AGG_PATH = TMP_DIR / "neolink_feb_march_2026_aggregates.json"
LOGO_PATH = ROOT / "public" / "neolink-logo.png"


PAGE_W, PAGE_H = A4
MARGIN_X = 17 * mm
MARGIN_Y = 15 * mm

NAVY = colors.HexColor("#0B1F33")
BLUE = colors.HexColor("#1D4ED8")
CYAN = colors.HexColor("#0891B2")
GREEN = colors.HexColor("#16A34A")
AMBER = colors.HexColor("#D97706")
RED = colors.HexColor("#DC2626")
PURPLE = colors.HexColor("#7C3AED")
SLATE = colors.HexColor("#334155")
LIGHT = colors.HexColor("#F8FAFC")
LINE = colors.HexColor("#CBD5E1")
TEXT = colors.HexColor("#1E293B")
MUTED = colors.HexColor("#64748B")


def load_aggregate():
    if AGG_PATH.exists():
        with AGG_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "source": "Report narrative",
        "periodLabel": "Two-month pilot project: February-March 2026",
        "totals": {"admissions": 0},
        "dataNotes": [],
    }


AGG = load_aggregate()


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        "TitleBig",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=27,
        leading=32,
        textColor=colors.white,
        alignment=TA_CENTER,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        "SubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12.5,
        leading=17,
        textColor=colors.HexColor("#DBEAFE"),
        alignment=TA_CENTER,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=NAVY,
        spaceBefore=4,
        spaceAfter=9,
    )
)
styles.add(
    ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13.5,
        leading=17,
        textColor=NAVY,
        spaceBefore=8,
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.6,
        leading=13.6,
        textColor=TEXT,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        "BodySmall",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.4,
        leading=11.4,
        textColor=TEXT,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        "Callout",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=10.2,
        leading=14,
        textColor=NAVY,
        backColor=colors.HexColor("#E0F2FE"),
        borderColor=colors.HexColor("#7DD3FC"),
        borderWidth=0.7,
        borderPadding=7,
        spaceBefore=4,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        "Caption",
        parent=styles["BodyText"],
        fontName="Helvetica-Oblique",
        fontSize=7.8,
        leading=10,
        textColor=MUTED,
        alignment=TA_CENTER,
        spaceBefore=3,
    )
)
styles.add(
    ParagraphStyle(
        "TableCell",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=7.8,
        leading=10,
        textColor=TEXT,
    )
)
styles.add(
    ParagraphStyle(
        "TableHead",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=8.1,
        leading=10,
        textColor=colors.white,
    )
)


def p(text: str, style: str = "Body"):
    return Paragraph(text, styles[style])


def bullet_list(items, bullet_color=BLUE):
    return ListFlowable(
        [ListItem(p(item, "Body"), leftIndent=10) for item in items],
        bulletType="bullet",
        bulletFontName="Helvetica-Bold",
        bulletColor=bullet_color,
        leftIndent=14,
        bulletIndent=4,
        spaceBefore=2,
        spaceAfter=6,
    )


class HeaderFooterCanvas:
    def __init__(self, canvas, doc):
        self.canvas = canvas
        self.doc = doc


def draw_footer(canvas, doc):
    canvas.saveState()
    page_num = canvas.getPageNumber()
    if page_num == 1:
        canvas.restoreState()
        return
    canvas.setStrokeColor(colors.HexColor("#E2E8F0"))
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_X, 13 * mm, PAGE_W - MARGIN_X, 13 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN_X, 8 * mm, "NeoLink Two-Month Pilot Project Report | February-March 2026")
    canvas.drawRightString(PAGE_W - MARGIN_X, 8 * mm, f"Page {page_num}")
    canvas.restoreState()


class CoverFlowable(Flowable):
    def __init__(self, width, height):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(NAVY)
        c.rect(-MARGIN_X, -MARGIN_Y, PAGE_W, PAGE_H, stroke=0, fill=1)
        c.setFillColor(colors.HexColor("#123B63"))
        c.circle(PAGE_W * 0.05, PAGE_H * 0.82, 180, stroke=0, fill=1)
        c.setFillColor(colors.HexColor("#0E7490"))
        c.circle(PAGE_W * 0.94, PAGE_H * 0.18, 210, stroke=0, fill=1)
        c.setFillColor(colors.HexColor("#1E40AF"))
        c.circle(PAGE_W * 0.78, PAGE_H * 0.86, 110, stroke=0, fill=1)

        if LOGO_PATH.exists():
            try:
                c.drawImage(str(LOGO_PATH), (PAGE_W - 92) / 2 - MARGIN_X, 520, width=92, height=92, mask="auto")
            except Exception:
                pass

        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 33)
        title = "NeoLink"
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 485, title)
        c.setFont("Helvetica-Bold", 18)
        c.setFillColor(colors.HexColor("#BFDBFE"))
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 455, "AI-Enabled PICU/NICU Digital Medical Records System")
        c.setFont("Helvetica", 12)
        c.setFillColor(colors.HexColor("#E0F2FE"))
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 431, "Two-Month Pilot Project Report")
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 414, "February-March 2026")
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColor(colors.HexColor("#BFDBFE"))
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 392, "NICU, Department of Pediatrics")
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 376, "Nalbari Medical College and Hospital")

        c.setFillColor(colors.HexColor("#E0F2FE"))
        c.roundRect(34, 300, PAGE_W - 2 * MARGIN_X - 68, 74, 10, stroke=0, fill=1)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 347, "A pilot evaluation of digital documentation, AI-assisted analytics,")
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 330, "clinical audit readiness, workflow impact, and scale-up potential")

        c.setFillColor(colors.white)
        c.roundRect(46, 195, PAGE_W - 2 * MARGIN_X - 92, 58, 9, stroke=0, fill=1)
        c.setFillColor(TEXT)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 231, "Departmental pilot evaluation report")
        c.setFont("Helvetica", 9)
        c.setFillColor(SLATE)
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 214, f"Prepared on {date.today().strftime('%d %B %Y')}")

        c.setFont("Helvetica", 7.8)
        c.setFillColor(colors.HexColor("#BFDBFE"))
        c.drawCentredString((PAGE_W - 2 * MARGIN_X) / 2, 70, "Confidential departmental report - aggregate and feature evaluation only")
        c.restoreState()


class MetricCards(Flowable):
    def __init__(self, cards, width=500, height=88):
        super().__init__()
        self.cards = cards
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        gap = 8
        card_w = (self.width - gap * (len(self.cards) - 1)) / len(self.cards)
        for i, (label, value, color) in enumerate(self.cards):
            x = i * (card_w + gap)
            c.setFillColor(colors.HexColor("#F8FAFC"))
            c.setStrokeColor(colors.HexColor("#CBD5E1"))
            c.roundRect(x, 0, card_w, self.height, 7, stroke=1, fill=1)
            c.setFillColor(color)
            c.roundRect(x, self.height - 8, card_w, 8, 7, stroke=0, fill=1)
            c.setFillColor(NAVY)
            c.setFont("Helvetica-Bold", 15)
            c.drawCentredString(x + card_w / 2, 48, value)
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 7.4)
            lines = split_text(label, card_w - 14, "Helvetica", 7.4)
            y = 28
            for line in lines[:2]:
                c.drawCentredString(x + card_w / 2, y, line)
                y -= 10


def split_text(text, max_width, font="Helvetica", size=8):
    words = str(text).split()
    lines = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        if stringWidth(test, font, size) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


class HorizontalScoreChart(Flowable):
    def __init__(self, data, width=500, height=245, title=None):
        super().__init__()
        self.data = data
        self.width = width
        self.height = height
        self.title = title

    def draw(self):
        c = self.canv
        if self.title:
            c.setFont("Helvetica-Bold", 11)
            c.setFillColor(NAVY)
            c.drawString(0, self.height - 4, self.title)
        top = self.height - 24
        left = 140
        chart_w = self.width - left - 32
        row_h = 25
        for i, (label, value, color) in enumerate(self.data):
            y = top - i * row_h
            c.setFillColor(TEXT)
            c.setFont("Helvetica", 8)
            for j, line in enumerate(split_text(label, left - 10, "Helvetica", 8)[:2]):
                c.drawRightString(left - 8, y - j * 9, line)
            c.setFillColor(colors.HexColor("#E2E8F0"))
            c.roundRect(left, y - 8, chart_w, 11, 5, stroke=0, fill=1)
            c.setFillColor(color)
            c.roundRect(left, y - 8, chart_w * min(value, 5) / 5, 11, 5, stroke=0, fill=1)
            c.setFillColor(NAVY)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(left + chart_w + 8, y - 6, f"{value}/5")
        c.setFont("Helvetica-Oblique", 7.2)
        c.setFillColor(MUTED)
        c.drawString(left, 4, "Pilot assessment score: 1 = limited, 5 = strong capability demonstrated")


class CoverageDonut(Flowable):
    def __init__(self, items, width=235, height=210):
        super().__init__()
        self.items = items
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        cx, cy = 82, 116
        r = 54
        total = sum(v for _, v, _ in self.items) or 1
        start = 90
        for label, value, color in self.items:
            extent = 360 * value / total
            c.setFillColor(color)
            c.wedge(cx - r, cy - r, cx + r, cy + r, start, start - extent, stroke=0, fill=1)
            start -= extent
        c.setFillColor(colors.white)
        c.circle(cx, cy, r * 0.56, stroke=0, fill=1)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(cx, cy + 4, "AI")
        c.setFont("Helvetica", 7)
        c.setFillColor(MUTED)
        c.drawCentredString(cx, cy - 9, "analytics")
        x = 158
        y = 172
        c.setFont("Helvetica", 7.4)
        for label, value, color in self.items:
            c.setFillColor(color)
            c.rect(x, y - 6, 8, 8, stroke=0, fill=1)
            c.setFillColor(TEXT)
            c.drawString(x + 13, y - 5, label)
            y -= 18


class WorkflowDiagram(Flowable):
    def __init__(self, width=500, height=210):
        super().__init__()
        self.width = width
        self.height = height

    def draw_box(self, c, x, y, w, h, title, body, fill, stroke):
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.roundRect(x, y, w, h, 7, stroke=1, fill=1)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 8.6)
        c.drawCentredString(x + w / 2, y + h - 16, title)
        c.setFillColor(TEXT)
        c.setFont("Helvetica", 6.9)
        lines = split_text(body, w - 14, "Helvetica", 6.9)
        yy = y + h - 29
        for line in lines[:3]:
            c.drawCentredString(x + w / 2, yy, line)
            yy -= 8

    def arrow(self, c, x1, y1, x2, y2):
        c.setStrokeColor(SLATE)
        c.setLineWidth(1)
        c.line(x1, y1, x2, y2)
        ang = math.atan2(y2 - y1, x2 - x1)
        size = 5
        pts = [
            (x2, y2),
            (x2 - size * math.cos(ang - 0.45), y2 - size * math.sin(ang - 0.45)),
            (x2 - size * math.cos(ang + 0.45), y2 - size * math.sin(ang + 0.45)),
        ]
        c.setFillColor(SLATE)
        c.setStrokeColor(SLATE)
        c.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1])
        c.line(pts[0][0], pts[0][1], pts[2][0], pts[2][1])

    def draw(self):
        c = self.canv
        boxes = [
            (0, 120, 94, 58, "Admission", "NICU/PICU registration, demographics, unit, diagnosis", colors.HexColor("#DBEAFE"), BLUE),
            (126, 120, 94, 58, "Clinical Entry", "Progress notes, vitals, diagnosis updates, outcome status", colors.HexColor("#DCFCE7"), GREEN),
            (252, 120, 94, 58, "AI Layer", "Summaries, risk alerts, handoff, reports, data checks", colors.HexColor("#EDE9FE"), PURPLE),
            (378, 120, 94, 58, "Dashboard", "Admissions, discharge, referral, deaths, trends", colors.HexColor("#FEF3C7"), AMBER),
            (63, 22, 112, 58, "Clinical Audit", "Monthly review, mortality analysis, quality improvement", colors.HexColor("#FFE4E6"), RED),
            (205, 22, 112, 58, "Administration", "Bed planning, staff planning, referral strengthening", colors.HexColor("#CCFBF1"), CYAN),
            (347, 22, 112, 58, "Research", "Structured dataset for audit, academic work, publications", colors.HexColor("#F1F5F9"), SLATE),
        ]
        for b in boxes:
            self.draw_box(c, *b)
        self.arrow(c, 94, 149, 126, 149)
        self.arrow(c, 220, 149, 252, 149)
        self.arrow(c, 346, 149, 378, 149)
        self.arrow(c, 425, 120, 119, 80)
        self.arrow(c, 425, 120, 261, 80)
        self.arrow(c, 425, 120, 403, 80)


class RoleWorkflow(Flowable):
    def __init__(self, width=500, height=190):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        lanes = [
            ("Nursing sisters", "Record essential bedside facts and urgent updates", colors.HexColor("#DBEAFE"), BLUE),
            ("Designated data person", "Daily entry, verification, missing-field follow-up, report preparation", colors.HexColor("#DCFCE7"), GREEN),
            ("Doctors", "Diagnosis, progress notes, clinical validation, mortality/referral review", colors.HexColor("#EDE9FE"), PURPLE),
            ("Administrator", "Dashboard review, monthly reports, resource decisions", colors.HexColor("#FEF3C7"), AMBER),
        ]
        y = 138
        for title, body, fill, stroke in lanes:
            c.setFillColor(fill)
            c.setStrokeColor(stroke)
            c.roundRect(10, y, 470, 32, 6, stroke=1, fill=1)
            c.setFillColor(NAVY)
            c.setFont("Helvetica-Bold", 8.6)
            c.drawString(22, y + 19, title)
            c.setFillColor(TEXT)
            c.setFont("Helvetica", 7.8)
            c.drawString(160, y + 19, body)
            if y > 42:
                c.setStrokeColor(SLATE)
                c.line(245, y - 4, 245, y - 16)
                c.line(245, y - 16, 240, y - 11)
                c.line(245, y - 16, 250, y - 11)
            y -= 43


class OutcomeAnalyticsDiagram(Flowable):
    def __init__(self, width=500, height=230):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        center_x, center_y = 250, 118
        c.setFillColor(NAVY)
        c.roundRect(center_x - 68, center_y - 24, 136, 48, 8, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(center_x, center_y + 7, "NeoLink")
        c.setFont("Helvetica", 7.3)
        c.drawCentredString(center_x, center_y - 7, "structured data + AI analytics")
        nodes = [
            ("Admission", "load, unit, inborn/outborn, diagnosis", 58, 170, BLUE),
            ("Discharge", "recovery rate, length of stay, summary", 58, 42, GREEN),
            ("Referral", "source, reason, district, outcome", 370, 170, AMBER),
            ("Mortality", "unit-wise deaths, diagnosis, early death review", 370, 42, RED),
        ]
        for title, body, x, y, color in nodes:
            c.setFillColor(colors.HexColor("#F8FAFC"))
            c.setStrokeColor(color)
            c.roundRect(x, y, 102, 52, 7, stroke=1, fill=1)
            c.setFillColor(color)
            c.setFont("Helvetica-Bold", 9)
            c.drawCentredString(x + 51, y + 34, title)
            c.setFillColor(TEXT)
            c.setFont("Helvetica", 6.6)
            for i, line in enumerate(split_text(body, 88, "Helvetica", 6.6)[:2]):
                c.drawCentredString(x + 51, y + 21 - i * 8, line)
            c.setStrokeColor(SLATE)
            c.line(center_x, center_y, x + 51, y + 26)


class AIPatternMap(Flowable):
    def __init__(self, width=500, height=235):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        center_x, center_y = 250, 118
        nodes = [
            ("Peak admission hours", "date/time clusters", 22, 172, BLUE),
            ("Referral causes", "source + reason + outcome", 27, 98, AMBER),
            ("Length of stay", "diagnosis-wise duration", 72, 24, GREEN),
            ("Antibiotic use", "drug pattern + escalation", 337, 24, PURPLE),
            ("Diagnosis clusters", "common diseases + seasonality", 373, 98, CYAN),
            ("Mortality links", "diagnosis + timing + referral", 342, 172, RED),
        ]
        for _, _, x, y, _ in nodes:
            c.setStrokeColor(SLATE)
            c.setLineWidth(0.7)
            c.line(center_x, center_y, x + 63, y + 23)

        for title, body, x, y, color in nodes:
            c.setFillColor(colors.HexColor("#F8FAFC"))
            c.setStrokeColor(color)
            c.roundRect(x, y, 126, 46, 7, stroke=1, fill=1)
            c.setFillColor(color)
            c.setFont("Helvetica-Bold", 8.2)
            c.drawCentredString(x + 63, y + 29, title)
            c.setFillColor(TEXT)
            c.setFont("Helvetica", 6.5)
            for i, line in enumerate(split_text(body, 108, "Helvetica", 6.5)[:2]):
                c.drawCentredString(x + 63, y + 17 - i * 8, line)

        c.setFillColor(NAVY)
        c.roundRect(center_x - 72, center_y - 27, 144, 54, 10, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(center_x, center_y + 9, "AI Pattern")
        c.drawCentredString(center_x, center_y - 4, "Recognition Engine")
        c.setFont("Helvetica", 6.8)
        c.setFillColor(colors.HexColor("#BFDBFE"))
        c.drawCentredString(center_x, center_y - 17, "turns records into decisions")


def make_table(data, col_widths, header=True, font_size=7.8):
    rows = []
    for i, row in enumerate(data):
        style = "TableHead" if i == 0 and header else "TableCell"
        rows.append([p(str(cell), style) for cell in row])
    table = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY if header else colors.white),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white if header else TEXT),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ]
        )
    )
    return table


def build_story():
    story = []
    story.append(CoverFlowable(PAGE_W - 2 * MARGIN_X, PAGE_H - MARGIN_Y - 18 * mm))
    story.append(PageBreak())

    story.append(p("Executive Summary", "H1"))
    story.append(
        p(
            "NeoLink was evaluated as a two-month pilot project during February-March 2026 in the NICU, Department of Pediatrics, Nalbari Medical College and Hospital, for use in high-workload PICU/NICU settings. The application is designed to replace scattered paper-based documentation with a structured digital registry, role-based clinical documentation, outcome tracking, AI-assisted analysis, and structured reporting.",
            "Body",
        )
    )
    story.append(
        p(
            "The major strength of NeoLink is that it converts routine bedside and administrative data into useful information for clinical audit, mortality review, referral analysis, resource planning, monthly reporting, research, and quality improvement.",
            "Callout",
        )
    )
    cards = [
        ("Pilot duration", "2 months", BLUE),
        ("Pilot period", "Feb-Mar 2026", CYAN),
        ("Primary setting", "PICU/NICU", GREEN),
        ("Report focus", "Features + benefits", PURPLE),
    ]
    story.append(MetricCards(cards, width=PAGE_W - 2 * MARGIN_X, height=78))
    story.append(Spacer(1, 8))
    story.append(
        bullet_list(
            [
                "The application supports admission registration, progress documentation, discharge/referral/death outcome recording, and NICU-specific inborn/outborn classification.",
                "Dashboards and reports can summarize admissions, discharges, referrals, mortality, diagnosis patterns, length of stay, and unit-wise workload.",
                "AI features support clinical summaries, handoff notes, risk alerts, discharge advice, mortality review, and data quality checks.",
                "A key operational finding is that routine digital entry may be difficult for nursing sisters in a hectic NICU; a designated data entry/medical record assistant is recommended.",
            ]
        )
    )

    story.append(p("Headline Recommended for Submission", "H2"))
    story.append(
        p(
            "<b>NeoLink: An AI-Enabled Digital PICU/NICU Medical Records and Analytics System for Better Documentation, Audit, Referral Tracking, and Quality Improvement</b>",
            "Callout",
        )
    )
    story.append(PageBreak())

    story.append(p("Background and Need", "H1"))
    story.append(
        p(
            "PICU and NICU units generate high-volume clinical data every day. In a busy intensive care environment, patient records, diagnosis changes, referral details, outcomes, and mortality information may remain distributed across registers, case sheets, discharge summaries, and verbal handovers. This makes monthly reporting, audit preparation, morbidity and mortality meetings, and referral review time-consuming.",
            "Body",
        )
    )
    story.append(
        p(
            "NeoLink addresses this gap by creating a single structured platform where clinical and administrative data are captured once and reused for care continuity, dashboard monitoring, reporting, and decision support.",
            "Body",
        )
    )
    story.append(WorkflowDiagram(width=PAGE_W - 2 * MARGIN_X, height=205))
    story.append(p("Figure 1. NeoLink data-to-decision workflow for PICU/NICU.", "Caption"))
    story.append(Spacer(1, 8))
    story.append(p("Objectives of the Two-Month Pilot", "H2"))
    story.append(
        bullet_list(
            [
                "To assess whether digital patient registration and outcome tracking can be used in a real PICU/NICU workflow.",
                "To evaluate whether dashboard-based analysis can reduce manual effort in monthly departmental reporting.",
                "To assess the value of AI-assisted summaries, risk analysis, handoff support, discharge guidance, and mortality review.",
                "To identify operational barriers before wider implementation, especially data-entry workload in a busy NICU.",
            ]
        )
    )
    story.append(PageBreak())

    story.append(p("Core Application Features", "H1"))
    feature_rows = [
        ["Feature", "Description", "Administrative / clinical advantage"],
        [
            "Digital patient registry",
            "Structured record for admission date, unit, age, gender, diagnosis, notes, and outcome.",
            "Improves retrieval, reduces dependence on physical registers, and supports rapid patient tracing.",
        ],
        [
            "NICU/PICU unit management",
            "Separate workflows for NICU and PICU with NICU inborn/outborn classification.",
            "Enables unit-wise workload review and comparison of inborn versus outborn outcomes.",
        ],
        [
            "Outcome tracking",
            "Captures in-progress, discharged, referred, deceased, and step-down patients.",
            "Supports discharge rate, referral rate, mortality rate, and bed-utilization review.",
        ],
        [
            "Referral system and network tracking",
            "Records referred patients, referring hospital, district, referral reason, outborn status, and final outcome.",
            "Helps identify referral burden, late referrals, high-referral districts, and areas needing peripheral strengthening.",
        ],
        [
            "Progress notes and diagnosis updates",
            "Doctors can add clinical diagnosis and progress notes; nursing drafts can be completed by doctors.",
            "Improves continuity of care and makes handover more reliable.",
        ],
        [
            "Analytics dashboard",
            "Displays total admissions, discharges, referrals, deaths, trends, and diagnosis distribution.",
            "Reduces manual report preparation and gives leadership quick visibility.",
        ],
        [
            "Real-time bed occupancy",
            "Tracks current admitted, discharged, referred, deceased and step-down patients by unit.",
            "Supports live bed-status review and helps plan expansion of beds, staff and equipment.",
        ],
        [
            "Centralised monitoring dashboard",
            "Provides higher authority and administrators with real-time statistics on admissions, discharge, referral, mortality, bed occupancy and unit workload.",
            "Enables rapid administrative review, resource planning, expansion decisions and monitoring across units or institutions.",
        ],
        [
            "AI clinical assistant",
            "Generates summaries, handoff notes, risk assessment, discharge instructions, and mortality review support.",
            "Saves time and helps standardize documentation while preserving clinical judgment.",
        ],
        [
            "Role-based access",
            "Separate permissions for nurse, doctor, administrator, institution administrator, and super administrator.",
            "Protects sensitive data and supports institutional governance.",
        ],
        [
            "Mobile/PWA support",
            "Responsive interface usable on desktop, tablet, or mobile devices.",
            "Useful in wards and intensive care areas where fixed workstations may not always be available.",
        ],
    ]
    story.append(make_table(feature_rows, [30 * mm, 69 * mm, 73 * mm]))
    story.append(PageBreak())

    story.append(p("AI-Based Analysis Capability", "H1"))
    story.append(
        p(
            "The AI layer in NeoLink is not intended to replace clinical decision-making. Its purpose is to organize data, highlight patterns, prepare summaries, and assist doctors and administrators in reviewing routine PICU/NICU information more efficiently.",
            "Body",
        )
    )
    analytics_rows = [
        ["AI analysis area", "What NeoLink can analyze", "Expected output"],
        [
            "Admission analysis",
            "Monthly admissions, NICU/PICU split, inborn/outborn status, common admission diagnoses, referral load.",
            "Admission trends, workload estimation, bed/staff planning inputs.",
        ],
        [
            "Discharge analysis",
            "Discharged patients, recovery pattern, discharge summaries, diagnosis-wise outcomes, length of stay.",
            "Discharge rate, follow-up planning, quality improvement insights.",
        ],
        [
            "Referral analysis",
            "Referring hospital, district, reason for referral, final outcome of referred patients.",
            "Referral network mapping and identification of late/critical referrals.",
        ],
        [
            "Mortality analysis",
            "Deaths by unit, diagnosis, inborn/outborn status, duration after admission, latest clinical notes.",
            "Structured mortality review and M&M meeting preparation.",
        ],
        [
            "Documentation quality",
            "Missing diagnosis, incomplete outcome, draft records, absent referral details, inconsistent dates.",
            "Daily correction list and better data completeness.",
        ],
    ]
    story.append(make_table(analytics_rows, [35 * mm, 72 * mm, 65 * mm]))
    story.append(Spacer(1, 8))
    story.append(OutcomeAnalyticsDiagram(width=PAGE_W - 2 * MARGIN_X, height=220))
    story.append(p("Figure 2. Outcome analytics map: admission, discharge, referral, and mortality.", "Caption"))
    story.append(PageBreak())

    story.append(p("How AI Analysis Helps Identify Patterns", "H1"))
    story.append(
        p(
            "The main value of AI in NeoLink is pattern recognition. Once data are entered in a structured manner, AI can connect admission timing, diagnosis, treatment, antibiotics, referral details, length of stay, and final outcome. This helps the department move from simple counting to meaningful clinical and administrative interpretation.",
            "Body",
        )
    )
    story.append(AIPatternMap(width=PAGE_W - 2 * MARGIN_X, height=224))
    story.append(p("Figure 3. AI pattern recognition domains in NeoLink.", "Caption"))
    story.append(Spacer(1, 6))
    pattern_rows = [
        ["Pattern area", "What AI can identify", "How it helps the unit"],
        [
            "Peak admission hours",
            "Hours or days when admissions rise, including night or emergency clustering.",
            "Supports duty roster planning, emergency preparedness, and resource placement.",
        ],
        [
            "Admission duration and length of stay",
            "Average stay by diagnosis, unit, outcome, inborn/outborn status, or referral group.",
            "Helps identify prolonged-stay conditions and improves bed utilization planning.",
        ],
        [
            "Referral cause analysis",
            "Common reasons for referral, referring hospitals, districts, and outcomes after referral.",
            "Supports referral network strengthening, peripheral training, and transport improvement.",
        ],
        [
            "Antibiotic-use pattern",
            "Frequently used antibiotics, combination therapy, escalation, duration, and diagnosis-wise use.",
            "Supports antibiotic stewardship, rational use review, and infection-control meetings.",
        ],
        [
            "Diagnosis pattern",
            "Top diagnoses, seasonal clusters, high-burden disease groups, and repeat presentations.",
            "Helps plan equipment, medicines, protocols, and academic audits.",
        ],
        [
            "Diagnosis-mortality link",
            "Which diagnoses are more commonly linked with death, early death, referral, or long stay.",
            "Improves mortality review, M&M discussion, and targeted quality improvement.",
        ],
        [
            "Outcome linkage",
            "Relationship between admission type, diagnosis, referral source, antibiotics, length of stay, and final outcome.",
            "Converts raw records into actionable clinical and administrative intelligence.",
        ],
        [
            "Bed occupancy and expansion need",
            "Current bed occupancy, frequent full-capacity periods, admission pressure, long-stay groups, and referral overflow.",
            "Supports evidence-based decisions for increasing beds, manpower, monitors, ventilators, CPAP/HFNC devices and oxygen points.",
        ],
        [
            "Centralised administrative dashboard",
            "Real-time unit statistics including active occupancy, admissions, discharges, referrals, deaths, diagnosis burden and referral pressure.",
            "Allows higher authority to monitor service load continuously and make timely policy, manpower, equipment and expansion decisions.",
        ],
    ]
    story.append(make_table(pattern_rows, [37 * mm, 72 * mm, 63 * mm]))
    story.append(PageBreak())

    story.append(p("AI Questions NeoLink Can Answer", "H1"))
    story.append(
        p(
            "With consistent data entry, NeoLink can generate practical answers that are useful for doctors, nurses, administrators, and departmental review meetings. These questions are difficult to answer quickly from paper registers but can be reviewed rapidly using digital records and AI-supported analysis.",
            "Body",
        )
    )
    question_rows = [
        ["Administrative / clinical question", "AI-supported interpretation"],
        [
            "At what time do most NICU/PICU admissions occur?",
            "Identifies peak hours and peak days so staffing and emergency readiness can be adjusted.",
        ],
        [
            "Which diagnoses are causing the highest admission burden?",
            "Ranks common diagnoses and detects clusters such as sepsis, respiratory distress, pneumonia, shock, jaundice, birth asphyxia, prematurity, or neurological illness.",
        ],
        [
            "Which diagnosis groups have longer length of stay?",
            "Links diagnosis and outcome with admission duration to identify prolonged-stay and high-resource groups.",
        ],
        [
            "What are the common referral causes and referral sources?",
            "Maps referral reasons, hospitals and districts, allowing targeted improvement in peripheral stabilization and transport.",
        ],
        [
            "Are outborn neonates showing different outcomes from inborn neonates?",
            "Compares inborn/outborn admissions, referrals, mortality, and duration of stay.",
        ],
        [
            "What antibiotic patterns are being used?",
            "Summarizes common antibiotics, combinations, escalation patterns and diagnosis-wise usage for stewardship review.",
        ],
        [
            "Which diagnosis patterns are linked to mortality?",
            "Connects death outcomes with diagnosis, timing after admission, referral status, and clinical course.",
        ],
        [
            "Where are records incomplete?",
            "Flags missing diagnosis, missing referral cause, absent discharge date, draft records, or inconsistent outcome fields.",
        ],
        [
            "Is the unit repeatedly reaching full bed occupancy?",
            "Correlates admission load, discharge delays, long-stay cases, step-down status and referral pressure to identify when service expansion may be justified.",
        ],
        [
            "What should be expanded first?",
            "Uses trends in occupancy, diagnosis burden, respiratory support need, antibiotic use and referral load to guide decisions on beds, staff, monitors, ventilators, CPAP/HFNC devices, oxygen points and data support.",
        ],
    ]
    story.append(make_table(question_rows, [65 * mm, 107 * mm]))
    story.append(Spacer(1, 8))
    story.append(
        p(
            "Thus, AI analysis in NeoLink is not only for clinical assistance; it is a departmental intelligence tool that supports audit, stewardship, referral review, quality improvement, and administrative decision-making.",
            "Callout",
        )
    )
    story.append(PageBreak())

    story.append(p("Real-Time Bed Occupancy and Expansion Planning", "H1"))
    story.append(
        p(
            "One of the most important administrative uses of NeoLink is real-time bed occupancy monitoring. In a PICU/NICU, the number of currently admitted patients, step-down patients, discharges, referrals and deaths changes rapidly. A live digital dashboard can show the present burden of the unit and can also preserve historical occupancy patterns for future planning.",
            "Body",
        )
    )
    bed_rows = [
        ["AI/analytics input", "What NeoLink can show", "Decision it supports"],
        [
            "Current admitted patients",
            "Real-time occupancy by NICU/PICU and active patient status.",
            "Immediate bed allocation, transfer planning and escalation decisions.",
        ],
        [
            "Admission pressure",
            "Days or hours when admissions repeatedly increase.",
            "Duty roster strengthening and emergency preparedness.",
        ],
        [
            "Discharge delay / long stay",
            "Patients or diagnosis groups occupying beds for longer duration.",
            "Step-down planning, early discharge planning and bed-turnover review.",
        ],
        [
            "Referral overflow",
            "Outborn/referral load from specific hospitals or districts.",
            "Need for referral coordination, transport improvement and peripheral training.",
        ],
        [
            "Respiratory and critical-care burden",
            "Diagnosis patterns likely to need oxygen, CPAP/HFNC, ventilators, monitors or infusion pumps.",
            "Evidence for equipment expansion and procurement planning.",
        ],
        [
            "Mortality and severity pattern",
            "High-risk diagnoses, early deaths and poor-outcome groups.",
            "Targeted protocols, staff training and quality-improvement initiatives.",
        ],
        [
            "Centralised dashboard for higher authority",
            "Live statistics on admissions, discharge, referral, mortality, bed occupancy, diagnosis burden and unit-wise workload.",
            "Real-time monitoring for administrative decisions, resource allocation, service expansion and accountability.",
        ],
    ]
    story.append(make_table(bed_rows, [43 * mm, 65 * mm, 64 * mm]))
    story.append(Spacer(1, 8))
    story.append(
        p(
            "With regular data entry, NeoLink can provide objective evidence for expansion decisions: whether more NICU/PICU beds are required, whether additional nursing/medical manpower is needed, whether more monitors or respiratory-support devices are justified, and whether a dedicated step-down/observation pathway can reduce ICU congestion.",
            "Callout",
        )
    )
    story.append(PageBreak())

    story.append(p("Charts: Feature Strength and Analytics Coverage", "H1"))
    chart_table = Table(
        [
            [
                HorizontalScoreChart(
                    [
                        ("Admission and patient registry", 5, BLUE),
                        ("Outcome tracking", 5, GREEN),
                        ("Analytics and dashboards", 5, CYAN),
                        ("AI documentation support", 4, PURPLE),
                        ("Role-based governance", 4, NAVY),
                        ("Mobile usability", 4, AMBER),
                        ("Workflow adoption readiness", 3, RED),
                    ],
                    width=305,
                    height=224,
                    title="Pilot feature assessment",
                ),
                CoverageDonut(
                    [
                        ("Admissions", 16, BLUE),
                        ("Discharge", 16, GREEN),
                        ("Referral", 16, AMBER),
                        ("Mortality", 16, RED),
                        ("Diagnosis", 14, PURPLE),
                        ("Handoff", 12, CYAN),
                        ("Reports", 10, NAVY),
                    ],
                    width=170,
                    height=210,
                ),
            ]
        ],
        colWidths=[320, 170],
    )
    chart_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(chart_table)
    story.append(
        p(
            "Figure 4. Feature and analytics coverage charts. These are capability assessment charts, not patient-count charts.",
            "Caption",
        )
    )
    story.append(Spacer(1, 10))
    story.append(p("Interpretation", "H2"))
    story.append(
        bullet_list(
            [
                "NeoLink performs strongly as a structured digital registry and outcome tracking system.",
                "Dashboard and report generation are major advantages because they convert routine records into actionable summaries.",
                "AI-assisted documentation is useful for handover, discharge advice, risk review, and mortality analysis, but final clinical decisions must remain with doctors.",
                "Workflow adoption is the main area requiring operational support because routine data entry may be difficult during high workload periods.",
            ]
        )
    )
    story.append(PageBreak())

    story.append(p("Detailed Analysis of Admission, Discharge and Referral", "H1"))
    story.append(p("Admission Analysis", "H2"))
    story.append(
        p(
            "NeoLink allows systematic capture of all PICU and NICU admissions. It records unit, admission date, patient demographics, diagnosis, admission type, and referral details where applicable. For NICU, the inborn/outborn distinction is highly valuable because it separates babies delivered within the institution from referred neonates arriving from peripheral facilities.",
            "Body",
        )
    )
    story.append(
        bullet_list(
            [
                "Helps identify monthly patient load and peak admission periods.",
                "Supports bed, ventilator, CPAP, oxygen, staff, and medicine planning.",
                "Allows comparison between NICU and PICU workload.",
                "Identifies common diagnoses and disease burden for future preparedness.",
            ],
            BLUE,
        )
    )
    story.append(p("Discharge Analysis", "H2"))
    story.append(
        p(
            "Discharge tracking helps the department understand successful outcomes and patient turnover. NeoLink can link discharge status with diagnosis, duration of stay, progress notes, and final advice, making discharge documentation more consistent and easier to audit.",
            "Body",
        )
    )
    story.append(
        bullet_list(
            [
                "Calculates discharge rate and supports bed turnover review.",
                "Improves discharge summary preparation by keeping diagnosis, course, and advice in one place.",
                "Helps compare outcomes across diagnosis categories and patient groups.",
                "Supports follow-up planning and continuity of care after discharge.",
            ],
            GREEN,
        )
    )
    story.append(p("Referral Analysis", "H2"))
    story.append(
        p(
            "Referral analysis is especially important in NICU and PICU because critical patients often arrive from outside facilities or are transferred for higher-level care. NeoLink can capture referring hospital, district, referral reason, and final outcome.",
            "Body",
        )
    )
    story.append(
        bullet_list(
            [
                "Identifies high-referral hospitals and districts.",
                "Highlights common referral reasons such as prematurity, birth asphyxia, sepsis, respiratory distress, shock, or severe pneumonia.",
                "Supports strengthening of peripheral stabilization and transport protocols.",
                "Allows review of outcomes among referred patients, especially outborn NICU babies.",
            ],
            AMBER,
        )
    )
    story.append(PageBreak())

    story.append(p("Advantages and Expected Achievements", "H1"))
    advantage_rows = [
        ["Area", "What NeoLink can achieve"],
        [
            "Clinical documentation",
            "More complete, structured, searchable and standardized patient records.",
        ],
        [
            "Handover quality",
            "Better shift-to-shift continuity through progress notes, AI summaries, and smart handoff.",
        ],
        [
            "Audit readiness",
            "Admissions, discharge, referral and mortality data can be reviewed without manually checking multiple registers.",
        ],
        [
            "Mortality review",
            "Deaths can be analyzed by unit, diagnosis, admission type, and timing for M&M meetings.",
        ],
        [
            "Referral system improvement",
            "Referral source, referral reason, district and outcome analysis can guide outreach, peripheral training, transport improvement and referral protocol strengthening.",
        ],
        [
            "Resource planning",
            "Unit-wise workload and outcome trends can support decisions about beds, equipment and staffing.",
        ],
        [
            "Research and academic work",
            "Structured de-identified datasets can support audits, thesis work, posters, and publications.",
        ],
        [
            "Administrative reporting",
            "Monthly and period-wise reports can be prepared faster and with more consistency.",
        ],
        [
            "Centralised higher-authority dashboard",
            "Real-time visibility of bed occupancy, admissions, discharges, referrals, mortality and unit-wise workload can support faster administrative decisions.",
        ],
    ]
    story.append(make_table(advantage_rows, [47 * mm, 125 * mm]))
    story.append(Spacer(1, 8))
    story.append(
        p(
            "The most important administrative advantage is that NeoLink shifts the department from retrospective manual counting to prospective digital recording and automatic analysis.",
            "Callout",
        )
    )
    story.append(PageBreak())

    story.append(p("Operational Finding: Data Entry Requirement", "H1"))
    story.append(
        p(
            "During a pilot in a busy NICU/PICU environment, one practical limitation must be clearly recognized: nursing sisters are often occupied with bedside monitoring, medication administration, procedures, feeding support, documentation, emergency response, and family communication. Expecting them to enter detailed digital data every time may lead to delayed or incomplete records.",
            "Body",
        )
    )
    story.append(
        p(
            "Similarly, AI voice scribe should be introduced with realistic expectations. During busy rounds in a hectic and resource-limited NICU/PICU, doctors may not be able to dictate or verify AI-generated notes for every patient. The practical approach is to use voice scribe selectively for critical patients, complex clinical notes, handovers, discharge summaries, and mortality review documentation.",
            "Body",
        )
    )
    story.append(
        p(
            "<b>Recommendation:</b> A designated data entry person or medical record assistant should be appointed for NeoLink. This person should update admissions, discharges, referrals, deaths, missing fields, and daily corrections under the supervision of doctors and nursing staff.",
            "Callout",
        )
    )
    story.append(RoleWorkflow(width=PAGE_W - 2 * MARGIN_X, height=178))
    story.append(p("Figure 5. Recommended workflow ownership model.", "Caption"))
    story.append(Spacer(1, 8))
    story.append(p("Proposed Responsibilities of the Designated Data Person", "H2"))
    story.append(
        bullet_list(
            [
                "Enter new admissions and update missing demographic fields.",
                "Verify discharge, referral, death and step-down outcomes daily.",
                "Ensure referral hospital, district and reason are completed for referred/outborn cases.",
                "Prepare monthly dashboard exports for doctors and administrators.",
                "Maintain a missing-data list for doctor/nurse verification.",
            ],
            GREEN,
        )
    )
    story.append(PageBreak())

    story.append(p("Limitations and Mitigation Plan", "H1"))
    limitation_rows = [
        ["Limitation / risk", "Possible effect", "Recommended mitigation"],
        [
            "High workload in NICU/PICU",
            "Incomplete or delayed data entry.",
            "Appoint a designated data entry/medical record assistant.",
        ],
        [
            "Variable digital familiarity",
            "Initial resistance or inconsistent use.",
            "Short hands-on training, simple SOP, and periodic refresher sessions.",
        ],
        [
            "Incomplete clinical fields",
            "Reduced accuracy of AI analysis and reports.",
            "Daily missing-field review and doctor validation of diagnosis/outcome.",
        ],
        [
            "Internet/device dependency",
            "Temporary access difficulty.",
            "Dedicated device, stable Wi-Fi, backup data-entry workflow.",
        ],
        [
            "AI over-reliance",
            "Risk of accepting AI output without clinical review.",
            "Mandatory statement that AI assists documentation and review but does not replace clinical judgment.",
        ],
        [
            "Doctor workflow during rounds",
            "In a hectic and resource-limited NICU/PICU, it may be difficult for doctors to use AI voice scribe for every patient during rounds.",
            "Use voice scribe selectively for critical cases, complex notes, discharge summaries, handovers and mortality reviews rather than making it compulsory for every patient.",
        ],
        [
            "Privacy and governance",
            "Sensitive patient information requires controlled access.",
            "Role-based access, user approval, audit logs, and de-identified reports.",
        ],
    ]
    story.append(make_table(limitation_rows, [43 * mm, 51 * mm, 78 * mm]))
    story.append(Spacer(1, 8))
    story.append(p("Suggested Scale-Up Roadmap", "H2"))
    roadmap_rows = [
        ["Phase", "Action", "Output"],
        ["Phase 1", "Finalize SOP, appoint data person, train doctors/nurses.", "Stable daily workflow."],
        ["Phase 2", "Use NeoLink for all admissions, outcomes and referral fields.", "Complete registry."],
        ["Phase 3", "Start monthly dashboard review and mortality/referral audit.", "Routine departmental analytics."],
        ["Phase 4", "Expand to multi-institution reporting if required.", "State or network-level comparison."],
    ]
    story.append(make_table(roadmap_rows, [28 * mm, 87 * mm, 57 * mm]))
    story.append(PageBreak())

    story.append(p("Conclusion", "H1"))
    story.append(
        p(
            "The two-month pilot project of NeoLink during February-March 2026 demonstrates that a dedicated digital PICU/NICU medical records system can significantly improve documentation, patient tracking, analytics, and clinical audit readiness. Its strongest value lies in structured patient records, role-based workflows, outcome monitoring, AI-assisted summaries, referral analysis, mortality review, and dashboard-based reporting.",
            "Body",
        )
    )
    story.append(
        p(
            "NeoLink can help the department achieve better continuity of care, faster retrieval of patient information, improved handover, reduced manual register work, better monthly reporting, stronger mortality and referral audits, and more reliable data for quality improvement and research.",
            "Body",
        )
    )
    story.append(
        p(
            "For successful implementation, however, the system must be supported by a practical workflow. In a hectic NICU, it may not be feasible for nursing sisters to enter detailed data every time along with bedside responsibilities. Therefore, appointing a designated data entry person/medical record assistant is strongly recommended. With this support, NeoLink can become a scalable and high-value digital health tool for PICU/NICU services.",
            "Callout",
        )
    )
    story.append(
        p(
            "A further <b>six-month maturation phase</b> is recommended. This phase is not the final large-scale rollout; it is a strengthening period to make NeoLink more <b>secure, reliable and feasible</b> for routine NICU use. During this period, data completeness can be improved, AI analytics can be tested over a more realistic dataset, bed-occupancy monitoring can be refined, antibiotic and mortality-pattern analysis can be strengthened, and a sustainable daily workflow can be established. After this maturation phase, NeoLink can be considered for larger-scale pilot implementation.",
            "Body",
        )
    )
    story.append(
        p(
            "<b>Funding support is also essential</b> to make NeoLink stronger and more dependable. Funding will help provide a dedicated data-entry/medical-record assistant, stable devices, secure hosting, technical maintenance, staff training, data backup, AI-analysis support, a centralised dashboard for higher-authority monitoring, and further development of dashboards for bed occupancy, referral tracking, antibiotic stewardship, mortality review, and expansion planning.",
            "Callout",
        )
    )
    story.append(p("Final Recommendation", "H2"))
    story.append(
        bullet_list(
            [
                "Continue NeoLink through a six-month maturation phase to make the system more secure, reliable, feasible and clinically useful.",
                "Provide funding support for data-entry manpower, technical strengthening, training, secure hosting, devices and maintenance.",
                "Assign one designated data entry/medical record assistant for daily completeness.",
                "Use the dashboard for monthly admission, discharge, referral and mortality review.",
                "Develop a centralised real-time dashboard for higher authority to monitor bed occupancy, admissions, discharge, referral, mortality and unit-wise workload.",
                "Conduct monthly quality meetings using NeoLink-generated reports.",
                "Plan larger-scale pilots only after the six-month maturation phase confirms security, reliability, feasibility, workflow stability, data completeness and AI-analytics usefulness.",
            ],
            BLUE,
        )
    )

    return story


class ReportDocTemplate(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(
            filename,
            pagesize=A4,
            rightMargin=MARGIN_X,
            leftMargin=MARGIN_X,
            topMargin=MARGIN_Y,
            bottomMargin=18 * mm,
            title="NeoLink Two-Month Pilot Project Report",
            author="NeoLink PICU/NICU Project",
        )
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates(
            [
                PageTemplate(
                    id="Report",
                    frames=[frame],
                    onPage=draw_footer,
                )
            ]
        )


def main():
    doc = ReportDocTemplate(str(PDF_PATH))
    story = build_story()
    doc.build(story)
    print(PDF_PATH)


if __name__ == "__main__":
    main()
