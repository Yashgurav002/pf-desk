"""Builds docs/PF_Desk_Papa_Template.xlsx — Hinglish fill-in sheet for the consultant's past claims + rejection remarks.
Labels here are the import contract: ml/ importers map them back via LABELS / REASONS below."""
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = Path(__file__).parent / "PF_Desk_Papa_Template.xlsx"
ROWS = 500  # fillable rows per sheet

# Hinglish dropdown label -> category code (ml/decoder/labels.json)
REASONS = {
    "Naam match nahi (member ka naam)": "name_mismatch",
    "Pita / Pati ka naam match nahi": "father_name_mismatch",
    "Janam tithi (DOB) match nahi": "dob_mismatch",
    "Bank A/c ya IFSC galat / khata band": "bank_details_invalid",
    "Bank A/c verify nahi hua": "bank_not_verified",
    "Cheque / passbook photo saaf nahi": "cheque_image_unclear",
    "Employer ne KYC approve nahi kiya": "kyc_not_approved",
    "Aadhaar UAN se link / verify nahi": "aadhaar_not_linked",
    "Exit date (DOE) mark nahi": "exit_date_missing",
    "Service kam hai (eligible nahi)": "service_ineligible",
    "Naukri chhodne ke baad wait period poora nahi": "waiting_period",
    "Advance ka purpose / limit sahi nahi": "purpose_ineligible",
    "Claim pehle se laga hai / settle ho chuka": "duplicate_claim",
    "Sign ya photo ki problem": "signature_or_photo",
    "Pension (EPS) ki problem": "pension_eps_issue",
    "Contribution nahi aaya / ECR reconcile nahi": "contribution_missing",
    "Purani naukri ka transfer pending": "transfer_pending",
    "PAN / Form 15G / TDS": "tax_pan_15g",
    "Employer ka confirmation / genuineness letter": "employer_confirmation",
    "Kuch aur (Note me likhein)": "other",
}
FORMS = ["19", "10C", "31", "13", "10D", "5IF"]
YES_NO = ["Haan", "Nahi", "Pata nahi"]
AGE = ["18-25", "26-35", "36-45", "46-57", "58+"]
SIZE = ["20 se kam", "20-49", "50-99", "100+"]
RESULT = ["Settle hua", "Reject hua"]

# (header, help comment, width, dropdown list or None, kind)
CLAIM_COLS = [
    ("Form", "Kaunsa form: 19, 10C, 31, 13 ...", 9, FORMS, "text"),
    ("Claim kab daala (date)", "Portal pe submit ki date. Format: 15-03-2025", 16, None, "date"),
    ("Result", "Settle hua ya Reject hua", 13, RESULT, "text"),
    ("Kitne din lage", "Submit se settle/reject hone tak kitne din", 11, None, "int"),
    ("Reject ka reason", "Sirf reject hua ho tab. List me se chunein", 34, list(REASONS), "text"),
    ("Naam match tha?", "UAN, bank aur Aadhaar me member ka naam same tha?", 12, YES_NO, "text"),
    ("Pita/Pati ka naam match tha?", "UAN aur bank me pita/pati ka naam same tha?", 14, YES_NO, "text"),
    ("DOB match tha?", "UAN aur Aadhaar me janam tithi same thi?", 11, YES_NO, "text"),
    ("Bank verified tha?", "UAN pe bank account verified dikh raha tha?", 12, YES_NO, "text"),
    ("KYC employer ne approve kiya tha?", "Employer ne KYC approve (DSC) kiya tha?", 15, YES_NO, "text"),
    ("Aadhaar UAN se link tha?", "Aadhaar seeded / verified tha?", 13, YES_NO, "text"),
    ("Exit date mark thi?", "Date of exit (DOE) portal pe thi?", 12, YES_NO, "text"),
    ("Kitne mahine naukri (lagbhag)", "Total service, mahino me. Jaise 3 saal = 36", 13, None, "int"),
    ("Naukri chhode kitne mahine hue the", "Claim daalte waqt exit ko kitne mahine hue. Naukri chalu ho to khaali chhodein", 15, None, "int"),
    ("Umar (lagbhag)", "Member ki umar ka group", 10, AGE, "text"),
    ("Company kitni badi", "Us employer ke paas kitne log", 12, SIZE, "text"),
    ("PF office", "Kaunsa regional office: Vasai, Thane, Bandra, Kandivali ...", 13, None, "text"),
    ("Note (optional)", "Kuch bhi khaas baat — par naam, UAN, Aadhaar, bank no. mat likhein", 30, None, "text"),
]
CLAIM_EXAMPLE = ["19", date(2025, 3, 15), "Reject hua", 21, "Pita / Pati ka naam match nahi", "Haan", "Nahi", "Haan", "Haan",
                 "Haan", "Haan", "Haan", 44, 3, "26-35", "20-49", "Vasai", "Bank me 'Ramesh K' tha"]

REMARK_COLS = [
    ("Remark (jaisa portal pe likha tha)", "Portal ka remark bilkul waisa hi copy karein — spelling, short form sab same", 60, None, "text"),
    ("Asli reason kya tha", "Aapke hisaab se asli problem kya thi — list me se chunein", 36, list(REASONS), "text"),
    ("Kaise theek kiya (optional)", "Kya document / correction se claim nikla", 40, None, "text"),
]
REMARK_EXAMPLE = ["F/H NAME NOT MATCHING WITH BANK A/C. PL SUBMIT CORRECTED CHQ", "Pita / Pati ka naam match nahi",
                  "Joint declaration + naya cancelled cheque"]

ARIAL = "Arial"
HEAD = PatternFill("solid", fgColor="1F4E78")
INPUT = PatternFill("solid", fgColor="FFF9DB")
EXAMPLE = PatternFill("solid", fgColor="E7E6E6")
thin = Side(style="thin", color="BFBFBF")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)


def build_sheet(wb, title, cols, example, intro):
    ws = wb.create_sheet(title)
    ws["A1"] = intro
    ws["A1"].font = Font(name=ARIAL, size=11, bold=True, color="C00000")
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(cols))
    ws.row_dimensions[1].height = 30
    ws["A1"].alignment = Alignment(wrap_text=True, vertical="center")
    for c, (head, help_, width, options, kind) in enumerate(cols, start=1):
        cell = ws.cell(row=2, column=c, value=head)
        cell.font = Font(name=ARIAL, size=11, bold=True, color="FFFFFF")
        cell.fill, cell.border = HEAD, BOX
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        cell.comment = Comment(help_, "PF Desk")
        ws.column_dimensions[cell.column_letter].width = width
        ex = ws.cell(row=3, column=c, value=example[c - 1])
        ex.font = Font(name=ARIAL, size=10, italic=True, color="595959")
        ex.fill, ex.border = EXAMPLE, BOX
        ex.alignment = Alignment(wrap_text=True, vertical="top")
        if kind == "date":
            ex.number_format = "DD-MM-YYYY"
        for r in range(4, ROWS + 4):
            cell = ws.cell(row=r, column=c)
            cell.font, cell.fill, cell.border = Font(name=ARIAL, size=11), INPUT, BOX
            cell.alignment = Alignment(wrap_text=kind == "text" and width > 25, vertical="top")
            if kind == "date":
                cell.number_format = "DD-MM-YYYY"
        rng = f"{ws.cell(row=4, column=c).coordinate}:{ws.cell(row=ROWS + 3, column=c).coordinate}"
        if options:
            src = f"'Lists'!${chr(64 + LIST_COL[head])}$2:${chr(64 + LIST_COL[head])}${len(options) + 1}"
            dv = DataValidation(type="list", formula1=f"={src}", allow_blank=True, showErrorMessage=True,
                                errorTitle="List se chunein", error="Neeche ke arrow se list me se chunein.")
        elif kind == "int":
            dv = DataValidation(type="whole", operator="between", formula1="0", formula2="1000", allow_blank=True,
                                showErrorMessage=True, errorTitle="Sirf number", error="Sirf number likhein, jaise 21")
        elif kind == "date":
            dv = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True,
                                showErrorMessage=True, errorTitle="Date", error="Date likhein, jaise 15-03-2025")
        else:
            continue
        ws.add_data_validation(dv)
        dv.add(rng)
    ws.cell(row=3, column=len(cols) + 1, value="← UDAHARAN (example) — is line ko mat badlein").font = Font(name=ARIAL, size=10, bold=True, color="595959")
    ws.column_dimensions[ws.cell(row=3, column=len(cols) + 1).column_letter].width = 40
    ws.row_dimensions[2].height = 48
    ws.freeze_panes = "B4"
    return ws


wb = Workbook()
guide = wb.active
guide.title = "Kaise Bharein"

lists = wb.create_sheet("Lists")
LIST_COL = {}
for i, (head, options) in enumerate([(h, o) for h, _, _, o, _ in CLAIM_COLS + REMARK_COLS if o], start=1):
    LIST_COL[head] = i
    lists.cell(row=1, column=i, value=head).font = Font(name=ARIAL, bold=True)
    for r, opt in enumerate(options, start=2):
        lists.cell(row=r, column=i, value=opt).font = Font(name=ARIAL)
lists.sheet_state = "hidden"

build_sheet(wb, "Purane Claims", CLAIM_COLS,
            CLAIM_EXAMPLE, "Ek line = ek purana claim. Member ka NAAM, UAN, AADHAAR, BANK NO., PHONE bilkul mat likhein.")
build_sheet(wb, "Rejection Remarks", REMARK_COLS,
            REMARK_EXAMPLE, "Ek line = ek reject remark. Remark me agar naam ya number ho to use XXXX kar dein.")
wb.move_sheet("Lists", offset=len(wb.sheetnames) - 1 - wb.sheetnames.index("Lists"))

lines = [
    ("PF Desk — Papa ke liye form", 16, True),
    ("", 11, False),
    ("Ye file kis liye hai?", 13, True),
    ("PF Desk aapke purane claims se seekhta hai — kaunsa claim reject ho sakta hai, aur paisa kitne din me aayega.", 11, False),
    ("Aur EPFO ke reject remarks padh kar batata hai ki asli problem kya hai.", 11, False),
    ("", 11, False),
    ("Kya bharna hai?", 13, True),
    ("1.  'Purane Claims' sheet — jitne ho sakein utne purane claims (kam se kam 150). Settle aur reject dono.", 11, False),
    ("2.  'Rejection Remarks' sheet — portal ke reject remarks, bilkul jaisa likha tha, aur asli reason (kam se kam 150).", 11, False),
    ("", 11, False),
    ("Kaise bharein?", 13, True),
    ("•  Sirf PEELE (yellow) khaane bharein. Grey line sirf udaharan (example) hai.", 11, False),
    ("•  Jahan arrow aaye wahan list me se chunein. Heading pe mouse le jaayein to madad dikhegi.", 11, False),
    ("•  Koi baat yaad na ho to khaali chhod dein ya 'Pata nahi' chunein — chalega.", 11, False),
    ("•  Ek saath sab bharne ki zaroorat nahi — roz 20-30 bhi kaafi hai.", 11, False),
    ("", 11, False),
    ("ZAROORI — privacy", 13, True),
    ("Member ka naam, UAN, Aadhaar, PAN, bank account number, phone — KUCH BHI mat likhein.", 11, False),
    ("Is file me sirf haan/nahi, dates aur reasons chahiye. Ye data sirf aapke laptop pe rahega.", 11, False),
    ("", 11, False),
    ("Bhar ke Yash ko de dein — woh ise PF Desk me daal dega.", 11, True),
]
for i, (text, size, bold) in enumerate(lines, start=1):
    c = guide.cell(row=i, column=1, value=text)
    c.font = Font(name=ARIAL, size=size, bold=bold, color="C00000" if text.startswith(("ZAROORI", "Member ka naam")) else "000000")
guide.column_dimensions["A"].width = 110
guide.sheet_view.showGridLines = False

wb.save(OUT)
print("wrote", OUT)
