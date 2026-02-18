"""
Crania Accounting System - Flask app with SQLite persistence.
Run from source or as a PyInstaller-built Windows .exe.
Self-contained UI: Tailwind/Shadcn-like styling, sidebar, dashboard, reports.
"""
import os
import sys
import webbrowser
from threading import Timer

from flask import Flask, render_template_string, request, jsonify, redirect, Response
from sqlalchemy import func, text

from database import db

# -----------------------------------------------------------------------------
# Paths: development (source) vs frozen (PyInstaller bundle)
# -----------------------------------------------------------------------------
if getattr(sys, "frozen", False):
    _MEIPASS = sys._MEIPASS
    basedir = os.path.dirname(sys.executable)
    template_folder = os.path.join(_MEIPASS, "templates")
    static_folder = os.path.join(_MEIPASS, "static")
    if not os.path.isdir(template_folder):
        template_folder = None
    if not os.path.isdir(static_folder):
        static_folder = None
    app = Flask(
        __name__,
        template_folder=template_folder,
        static_folder=static_folder,
    )
else:
    basedir = os.path.abspath(os.path.dirname(__file__))
    app = Flask(__name__)

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(basedir, "accounting.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

from models import Account, Transaction, TaxRate, JournalEntry, JournalLine  # noqa: E402


def run_safe_migrations():
    """Safe migrations: ADD COLUMN, CREATE TABLE IF NOT EXISTS. Never drop data."""
    migrations = [
        "ALTER TABLE transactions ADD COLUMN debit_account_id INTEGER REFERENCES accounts(id)",
        "ALTER TABLE transactions ADD COLUMN credit_account_id INTEGER REFERENCES accounts(id)",
        "ALTER TABLE transactions ADD COLUMN kind TEXT DEFAULT 'debit'",
        "ALTER TABLE transactions ADD COLUMN reference TEXT DEFAULT ''",
        "ALTER TABLE transactions ADD COLUMN tax_rate_id INTEGER",
        "ALTER TABLE accounts ADD COLUMN code TEXT DEFAULT ''",
        "ALTER TABLE accounts ADD COLUMN parent_id INTEGER",
        "ALTER TABLE accounts ADD COLUMN active INTEGER DEFAULT 1",
        """CREATE TABLE IF NOT EXISTS tax_rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(64) NOT NULL,
            rate REAL DEFAULT 0,
            active INTEGER DEFAULT 1,
            created_at TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS journal_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TIMESTAMP NOT NULL,
            description VARCHAR(256) NOT NULL,
            reference VARCHAR(64) DEFAULT '',
            created_at TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS journal_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            journal_entry_id INTEGER NOT NULL,
            account_id INTEGER NOT NULL,
            debit REAL DEFAULT 0,
            credit REAL DEFAULT 0,
            memo VARCHAR(256) DEFAULT '',
            tax_rate_id INTEGER,
            tax_amount REAL DEFAULT 0,
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
            FOREIGN KEY (account_id) REFERENCES accounts(id),
            FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id)
        )""",
        "ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'posted'",
        "ALTER TABLE transactions ADD COLUMN voided_at TIMESTAMP",
        "ALTER TABLE transactions ADD COLUMN voided_reason TEXT DEFAULT ''",
        "ALTER TABLE journal_entries ADD COLUMN status TEXT DEFAULT 'posted'",
        "ALTER TABLE journal_entries ADD COLUMN voided_at TIMESTAMP",
        "ALTER TABLE journal_entries ADD COLUMN voided_reason TEXT DEFAULT ''",
        "ALTER TABLE journal_lines ADD COLUMN tax_amount REAL DEFAULT 0",
    ]
    with db.engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()


def init_db():
    """Create tables, run migrations, seed defaults if missing."""
    db.create_all()
    run_safe_migrations()
    # Seed default tax rates
    if TaxRate.query.count() == 0:
        for tr in [
            TaxRate(name="No Tax", rate=0, active=True),
            TaxRate(name="HST (13%)", rate=13, active=True),
            TaxRate(name="GST (5%)", rate=5, active=True),
            TaxRate(name="PST (7%)", rate=7, active=True),
        ]:
            db.session.add(tr)
        db.session.commit()
    if Account.query.count() == 0:
        DEFAULT_ACCOUNTS = [
            ("1000", "Cash", "asset", "Cash on hand"),
            ("1010", "Checking Account", "asset", "Primary checking account"),
            ("1020", "Savings Account", "asset", "Savings account"),
            ("1100", "Accounts Receivable", "asset", "Money owed by customers"),
            ("1200", "Inventory", "asset", "Goods for sale"),
            ("1300", "Prepaid Expenses", "asset", "Expenses paid in advance"),
            ("1500", "Equipment", "asset", "Office and business equipment"),
            ("1510", "Accumulated Depreciation - Equipment", "asset", "Accumulated depreciation on equipment"),
            ("2000", "Accounts Payable", "liability", "Money owed to suppliers"),
            ("2100", "Credit Card Payable", "liability", "Credit card balances"),
            ("2200", "Accrued Expenses", "liability", "Expenses incurred but not yet paid"),
            ("2300", "Sales Tax Payable", "liability", "Sales tax collected to be remitted"),
            ("2400", "Payroll Liabilities", "liability", "Wages and payroll taxes owed"),
            ("2500", "Loan Payable", "liability", "Long-term loans"),
            ("3000", "Owner's Equity", "equity", "Owner's investment in the business"),
            ("3100", "Retained Earnings", "equity", "Accumulated profits"),
            ("3200", "Owner's Draws", "equity", "Owner withdrawals"),
            ("4000", "Sales Revenue", "income", "Revenue from product sales"),
            ("4100", "Service Revenue", "income", "Revenue from services"),
            ("4200", "Interest Income", "income", "Interest earned"),
            ("4300", "Other Income", "income", "Miscellaneous income"),
            ("5000", "Cost of Goods Sold", "expense", "Direct cost of products sold"),
            ("5100", "Purchases", "expense", "Inventory purchases"),
            ("6000", "Advertising & Marketing", "expense", "Marketing expenses"),
            ("6100", "Bank Charges", "expense", "Bank fees and charges"),
            ("6200", "Insurance", "expense", "Business insurance"),
            ("6300", "Office Supplies", "expense", "Office supplies and materials"),
            ("6400", "Professional Fees", "expense", "Legal, accounting, consulting fees"),
            ("6500", "Rent Expense", "expense", "Office or facility rent"),
            ("6600", "Repairs & Maintenance", "expense", "Equipment and facility repairs"),
            ("6700", "Telephone & Internet", "expense", "Communication expenses"),
            ("6800", "Travel & Entertainment", "expense", "Business travel and meals"),
            ("6900", "Utilities", "expense", "Electricity, water, gas"),
            ("7000", "Wages & Salaries", "expense", "Employee wages"),
            ("7100", "Payroll Taxes", "expense", "Employer payroll taxes"),
            ("7200", "Employee Benefits", "expense", "Health insurance, retirement, etc."),
            ("7500", "Depreciation Expense", "expense", "Depreciation of fixed assets"),
            ("7600", "Interest Expense", "expense", "Interest on loans"),
            ("7700", "Income Tax Expense", "expense", "Income taxes"),
            ("7800", "Miscellaneous Expense", "expense", "Other expenses"),
        ]
        for code, name, acc_type, desc in DEFAULT_ACCOUNTS:
            db.session.add(Account(name=name, type=acc_type, description=desc, code=code))
        db.session.commit()


with app.app_context():
    init_db()


# -----------------------------------------------------------------------------
# API routes (JSON for SPA)
# -----------------------------------------------------------------------------

def _to_date_str(dt):
    """Normalize date to YYYY-MM-DD for filtering."""
    if dt is None:
        return None
    s = dt.isoformat()[:10] if hasattr(dt, "isoformat") else str(dt)[:10]
    return s if s and len(s) >= 10 else None


def _collect_all_lines(date_from=None, date_to=None, as_of=None):
    """Collect (date_str, account_id, debit, credit) from transactions + journal_lines.
    Schema: transactions has debit_account_id, credit_account_id, amount.
    Schema: journal_lines has account_id, debit, credit. Excludes void."""
    lines = []
    df = (date_from or "").strip() or None
    dt = (date_to or "").strip() or None
    ao = (as_of or "").strip() or None
    for t in Transaction.query.all():
        if getattr(t, "status", "posted") == "void":
            continue
        ds = _to_date_str(t.date)
        if not ds:
            continue
        if df and ds < df:
            continue
        if dt and ds > dt:
            continue
        if ao and ds > ao:
            continue
        amt = float(t.amount or 0)
        if t.debit_account_id:
            lines.append((ds, int(t.debit_account_id), amt, 0.0))
        if t.credit_account_id:
            lines.append((ds, int(t.credit_account_id), 0.0, amt))
    for jl in db.session.query(JournalLine).join(JournalEntry).order_by(JournalEntry.date, JournalEntry.id, JournalLine.id):
        je = jl.journal_entry
        if getattr(je, "status", "posted") == "void":
            continue
        ds = _to_date_str(je.date)
        if not ds:
            continue
        if df and ds < df:
            continue
        if dt and ds > dt:
            continue
        if ao and ds > ao:
            continue
        d = float(jl.debit or 0)
        c = float(jl.credit or 0)
        if d or c:
            lines.append((ds, int(jl.account_id), d, c))
    return lines


def _account_balances(lines, account_ids=None):
    """Compute balance per account from lines. Returns {account_id: balance}.
    asset/expense: debit-credit. liability/equity/income: credit-debit."""
    from collections import defaultdict
    acc_map = {a.id: a for a in Account.query.all()}
    debits = defaultdict(float)
    credits = defaultdict(float)
    for _, aid, d, c in lines:
        if account_ids is not None and aid not in account_ids:
            continue
        debits[aid] += d
        credits[aid] += c
    result = {}
    for aid in set(debits) | set(credits):
        acc = acc_map.get(aid)
        atype = acc.type if acc else "asset"
        if atype in ("asset", "expense"):
            result[aid] = debits[aid] - credits[aid]
        else:
            result[aid] = credits[aid] - debits[aid]
    return result


@app.route("/api/accounts")
def api_accounts():
    """List all accounts (optionally active only), sorted by code, grouped by type."""
    active_only = request.args.get("active", "true").lower() == "true"
    q = Account.query
    try:
        if active_only:
            q = q.filter(Account.active != False)
    except Exception:
        pass
    accounts = sorted(q.all(), key=lambda a: ((a.type, getattr(a, "code", "") or "9999", a.name)))
    return jsonify([{
        "id": a.id,
        "name": a.name,
        "type": a.type,
        "description": a.description or "",
        "code": getattr(a, "code", "") or "",
        "parent_id": getattr(a, "parent_id", None),
        "active": getattr(a, "active", True) if hasattr(a, "active") else True,
    } for a in accounts])


@app.route("/api/transactions")
def api_transactions():
    """List transactions and journal entries (recent first)."""
    limit = min(int(request.args.get("limit", 100)), 500)
    txns = []
    for t in Transaction.query.order_by(Transaction.id.desc()).limit(limit * 2).all():
        txns.append({
            "id": "T-" + str(t.id),
            "description": t.description,
            "amount": float(t.amount),
            "type": t.type,
            "date": t.date.isoformat() if t.date else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "source": "transaction",
            "status": getattr(t, "status", "posted"),
            "reference": getattr(t, "reference", "") or "",
        })
    for je in JournalEntry.query.order_by(JournalEntry.id.desc()).limit(limit * 2).all():
        total_d = sum(float(jl.debit or 0) for jl in je.lines)
        total_c = sum(float(jl.credit or 0) for jl in je.lines)
        total = max(total_d, total_c)
        txns.append({
            "id": "JE-" + str(je.id),
            "description": je.description,
            "amount": total,
            "type": "journal",
            "date": je.date.isoformat() if je.date else None,
            "created_at": je.created_at.isoformat() if je.created_at else None,
            "source": "journal",
            "status": getattr(je, "status", "posted"),
            "reference": je.reference or "",
        })
    txns.sort(key=lambda x: (x["date"] or "")[::-1], reverse=True)
    return jsonify(txns[:limit])


@app.route("/api/dashboard")
def api_dashboard():
    """Dashboard: all values from double-entry. Assets/liabilities all-time; revenue/expenses current month."""
    from datetime import datetime
    today = datetime.utcnow().strftime("%Y-%m-%d")
    first = datetime.utcnow().replace(day=1).strftime("%Y-%m-%d")
    bs_lines = _collect_all_lines(as_of=today)
    is_lines = _collect_all_lines(date_from=first, date_to=today)
    bs_bal = _account_balances(bs_lines)
    is_bal = _account_balances(is_lines)
    acc_map = {a.id: a for a in Account.query.all()}
    total_assets = sum(b for aid, b in bs_bal.items() if acc_map.get(aid) and acc_map[aid].type == "asset")
    total_liabilities = sum(b for aid, b in bs_bal.items() if acc_map.get(aid) and acc_map[aid].type == "liability")
    total_equity = sum(b for aid, b in bs_bal.items() if acc_map.get(aid) and acc_map[aid].type == "equity")
    total_revenue = sum(b for aid, b in is_bal.items() if acc_map.get(aid) and acc_map[aid].type == "income")
    total_expenses = sum(b for aid, b in is_bal.items() if acc_map.get(aid) and acc_map[aid].type == "expense")
    cash_acc = next((a for a in Account.query.filter(Account.type == "asset") if (getattr(a, "code", "") or "") == "1000"), None)
    cash_balance = bs_bal.get(cash_acc.id, 0) if cash_acc else total_assets
    txns = []
    for t in Transaction.query.order_by(Transaction.id.desc()).limit(20).all():
        if getattr(t, "status", "posted") == "void":
            continue
        txns.append({"id": "T-" + str(t.id), "description": t.description, "amount": float(t.amount), "type": t.type, "date": t.date.isoformat() if t.date else None})
    for je in JournalEntry.query.order_by(JournalEntry.id.desc()).limit(20).all():
        if getattr(je, "status", "posted") == "void":
            continue
        total_d = sum(float(jl.debit or 0) for jl in je.lines)
        total_c = sum(float(jl.credit or 0) for jl in je.lines)
        amt = max(total_d, total_c)
        txns.append({"id": "JE-" + str(je.id), "description": je.description, "amount": amt, "type": "journal", "date": je.date.isoformat() if je.date else None})
    txns.sort(key=lambda x: (x["date"] or "")[::-1], reverse=True)
    return jsonify({
        "cash_balance": round(cash_balance, 2),
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "equity": round(total_equity, 2),
        "net_income": round(total_revenue - total_expenses, 2),
        "total_revenue": round(total_revenue, 2),
        "total_expenses": round(total_expenses, 2),
        "total": round(cash_balance, 2),
        "income_total": round(total_revenue, 2),
        "expense_total": round(total_expenses, 2),
        "transactions": txns[:20],
    })


def _balance_sheet_data(date_from=None, date_to=None):
    """Compute balance sheet from double-entry lines for date range."""
    lines = _collect_all_lines(date_from=date_from, date_to=date_to)
    balances = _account_balances(lines)
    acc_map = {a.id: a for a in Account.query.all()}
    assets = []
    liabilities = []
    equity = []
    for aid, bal in sorted(balances.items(), key=lambda x: (acc_map.get(x[0]).type if acc_map.get(x[0]) else "", getattr(acc_map.get(x[0]), "code", "") or "9999")):
        acc = acc_map.get(aid)
        if not acc or abs(bal) < 0.01:
            continue
        row = {"id": aid, "code": getattr(acc, "code", "") or "", "name": acc.name, "balance": round(bal, 2)}
        if acc.type == "asset":
            assets.append(row)
        elif acc.type == "liability":
            liabilities.append(row)
        elif acc.type == "equity":
            equity.append(row)
    total_assets = sum(a["balance"] for a in assets)
    total_liabilities = sum(a["balance"] for a in liabilities)
    total_equity = sum(a["balance"] for a in equity)
    return {
        "date_from": date_from,
        "date_to": date_to,
        "assets": assets,
        "total_assets": round(total_assets, 2),
        "liabilities": liabilities,
        "total_liabilities": round(total_liabilities, 2),
        "equity": equity,
        "total_equity": round(total_equity, 2),
    }


@app.route("/api/reports/balance-sheet")
def api_balance_sheet():
    """Balance sheet: assets, liabilities, equity. ?from=YYYY-MM-DD&to=YYYY-MM-DD"""
    date_from = request.args.get("from") or None
    date_to = request.args.get("to") or None
    return jsonify(_balance_sheet_data(date_from, date_to))


def _income_statement_data(date_from=None, date_to=None):
    """Income statement from double-entry lines for date range."""
    lines = _collect_all_lines(date_from=date_from, date_to=date_to)
    balances = _account_balances(lines)
    acc_map = {a.id: a for a in Account.query.all()}
    revenue_rows = []
    expense_rows = []
    total_revenue = 0.0
    total_expenses = 0.0
    tax_collected = 0.0
    tax_paid = 0.0
    for aid, bal in balances.items():
        acc = acc_map.get(aid)
        if not acc:
            continue
        if acc.type == "income" and bal > 0:
            revenue_rows.append({"code": getattr(acc, "code", "") or "", "name": acc.name, "balance": round(bal, 2)})
            total_revenue += bal
        elif acc.type == "expense" and bal > 0:
            expense_rows.append({"code": getattr(acc, "code", "") or "", "name": acc.name, "balance": round(bal, 2)})
            total_expenses += bal
    revenue_rows.sort(key=lambda x: (x["code"], x["name"]))
    expense_rows.sort(key=lambda x: (x["code"], x["name"]))
    return {
        "revenue_accounts": revenue_rows,
        "expense_accounts": expense_rows,
        "total_revenue": round(total_revenue, 2),
        "total_expenses": round(total_expenses, 2),
        "net_income": round(total_revenue - total_expenses, 2),
        "tax_collected": tax_collected,
        "tax_paid": tax_paid,
    }


@app.route("/api/reports/income-statement")
def api_income_statement():
    """Income statement. ?from=YYYY-MM-DD&to=YYYY-MM-DD (omit both for all-time)"""
    date_from = request.args.get("from") or None
    date_to = request.args.get("to") or None
    return jsonify(_income_statement_data(date_from, date_to))


@app.route("/add", methods=["POST"])
def add_transaction():
    """Create a new transaction."""
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "JSON required"}), 400
    description = data.get("description", "").strip()
    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Invalid amount"}), 400
    txn_type = (data.get("type") or "expense").lower()
    if txn_type not in ("income", "expense"):
        txn_type = "expense"

    cash = Account.query.filter(Account.code == "1000").first() or Account.query.filter(Account.type == "asset").first()
    income = Account.query.filter(Account.type == "income").first()
    expenses = Account.query.filter(Account.type == "expense").first()
    if not all([cash, income, expenses]):
        return jsonify({"success": False, "error": "Default accounts missing"}), 500

    if txn_type == "income":
        debit_account_id, credit_account_id = cash.id, income.id
    else:
        debit_account_id, credit_account_id = expenses.id, cash.id

    txn = Transaction(
        description=description,
        amount=amount,
        type=txn_type,
        debit_account_id=debit_account_id,
        credit_account_id=credit_account_id,
    )
    db.session.add(txn)
    db.session.commit()
    return jsonify({"success": True, "id": txn.id})


@app.route("/api/accounts", methods=["POST"])
def api_create_account():
    """Create account."""
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "error": "Name required"}), 400
    acc = Account(
        name=name,
        type=data.get("type", "asset"),
        description=(data.get("description") or "").strip(),
        code=(data.get("code") or "").strip(),
        parent_id=data.get("parent_id"),
        active=data.get("active", True),
    )
    db.session.add(acc)
    db.session.commit()
    return jsonify({"success": True, "id": acc.id})


@app.route("/api/accounts/<int:aid>", methods=["PUT"])
def api_update_account(aid):
    """Update account."""
    acc = Account.query.get_or_404(aid)
    data = request.get_json() or {}
    if "name" in data:
        acc.name = str(data["name"]).strip()
    if "type" in data:
        acc.type = str(data["type"])
    if "description" in data:
        acc.description = str(data["description"])
    if "code" in data:
        acc.code = str(data["code"])
    if "parent_id" in data:
        acc.parent_id = data["parent_id"]
    if "active" in data:
        acc.active = bool(data["active"])
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/tax-rates")
def api_tax_rates():
    """List tax rates with in-use count."""
    rates = TaxRate.query.order_by(TaxRate.name).all()
    in_use = db.session.query(JournalLine.tax_rate_id, db.func.count(JournalLine.id)).filter(
        JournalLine.tax_rate_id.isnot(None)
    ).group_by(JournalLine.tax_rate_id).all()
    in_use_map = {rid: cnt for rid, cnt in in_use}
    try:
        txn_use = db.session.query(Transaction.tax_rate_id, db.func.count(Transaction.id)).filter(
            Transaction.tax_rate_id.isnot(None)
        ).group_by(Transaction.tax_rate_id).all()
        for rid, cnt in txn_use:
            in_use_map[rid] = in_use_map.get(rid, 0) + cnt
    except Exception:
        pass
    return jsonify([{
        "id": r.id,
        "name": r.name,
        "rate": float(r.rate),
        "active": r.active,
        "in_use": in_use_map.get(r.id, 0),
    } for r in rates])


@app.route("/api/tax-rates", methods=["POST"])
def api_create_tax_rate():
    """Create tax rate."""
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "error": "Name required"}), 400
    r = TaxRate(name=name, rate=float(data.get("rate", 0)), active=data.get("active", True))
    db.session.add(r)
    db.session.commit()
    return jsonify({"success": True, "id": r.id})


@app.route("/api/tax-rates/<int:rid>", methods=["PUT", "DELETE"])
def api_tax_rate(rid):
    """Update or delete tax rate."""
    r = TaxRate.query.get_or_404(rid)
    if request.method == "DELETE":
        db.session.delete(r)
        db.session.commit()
        return jsonify({"success": True})
    data = request.get_json() or {}
    if "name" in data:
        r.name = str(data["name"]).strip()
    if "rate" in data:
        r.rate = float(data["rate"])
    if "active" in data:
        r.active = bool(data["active"])
    db.session.commit()
    return jsonify({"success": True})


def _general_ledger_data(account_id, date_from=None, date_to=None):
    """General ledger entries for account. Returns {account, entries}."""
    if not account_id:
        return {"entries": [], "account": None}
    acc = Account.query.get(account_id)
    if not acc:
        return {"entries": [], "account": None}
    raw = []
    for t in Transaction.query.filter(
        (Transaction.debit_account_id == account_id) | (Transaction.credit_account_id == account_id)
    ).order_by(Transaction.date, Transaction.id):
        if getattr(t, "status", "posted") == "void":
            continue
        dt = t.date
        if date_from and (dt and dt.isoformat()[:10] < date_from):
            continue
        if date_to and (dt and dt.isoformat()[:10] > date_to):
            continue
        debit = float(t.amount) if t.debit_account_id == account_id else 0.0
        credit = float(t.amount) if t.credit_account_id == account_id else 0.0
        raw.append({"date": t.date.isoformat() if t.date else None, "txn_id": f"TXN-{t.id:06d}", "description": t.description, "debit": debit, "credit": credit})
    for jl in db.session.query(JournalLine).join(JournalEntry).filter(JournalLine.account_id == account_id).order_by(JournalEntry.date, JournalEntry.id, JournalLine.id):
        je = jl.journal_entry
        if getattr(je, "status", "posted") == "void":
            continue
        dt = je.date
        if date_from and (dt and dt.isoformat()[:10] < date_from):
            continue
        if date_to and (dt and dt.isoformat()[:10] > date_to):
            continue
        raw.append({"date": je.date.isoformat() if je.date else None, "txn_id": f"JE-{je.id:06d}", "description": jl.memo or je.description, "debit": float(jl.debit or 0), "credit": float(jl.credit or 0)})
    raw.sort(key=lambda e: (e["date"] or "", e["txn_id"]))
    norm = "debit" if acc.type in ("asset", "expense") else "credit"
    entries = []
    running = 0.0
    for e in raw:
        running += (e["debit"] - e["credit"]) if norm == "debit" else (e["credit"] - e["debit"])
        entries.append({**e, "balance": round(running, 2)})
    return {
        "account": {"id": acc.id, "name": acc.name, "code": getattr(acc, "code", "") or "", "type": acc.type},
        "entries": entries,
    }


@app.route("/api/general-ledger")
@app.route("/api/ledger/<int:account_id>")
def api_general_ledger(account_id=None):
    """General ledger: transactions for an account with running balance."""
    if account_id is None:
        account_id = request.args.get("account_id", type=int)
    date_from = request.args.get("from")
    date_to = request.args.get("to")
    return jsonify(_general_ledger_data(account_id, date_from, date_to))


@app.route("/api/transactions/journal", methods=["POST"])
def api_journal_post():
    """Create multi-line journal entry. Validate user lines balanced, then auto-add tax."""
    data = request.get_json() or {}
    desc = (data.get("description") or "").strip()
    if not desc:
        return jsonify({"success": False, "error": "Description required"}), 400
    ref = (data.get("reference") or "").strip()
    date_str = data.get("date")
    tax_rate_id = data.get("tax_rate_id")
    from datetime import datetime
    try:
        txn_date = datetime.fromisoformat(date_str.replace("Z", "+00:00")) if date_str else datetime.utcnow()
        if txn_date.tzinfo:
            txn_date = txn_date.replace(tzinfo=None)
    except Exception:
        txn_date = datetime.utcnow()
    lines = []
    for l in data.get("lines") or []:
        aid = l.get("account_id")
        if not aid:
            continue
        lines.append({
            "account_id": int(aid),
            "debit": float(l.get("debit", 0) or 0),
            "credit": float(l.get("credit", 0) or 0),
            "memo": (l.get("memo") or "").strip(),
        })
    if len(lines) < 2:
        return jsonify({"success": False, "error": "At least 2 lines required"}), 400
    total_d = sum(l["debit"] for l in lines)
    total_c = sum(l["credit"] for l in lines)
    if abs(total_d - total_c) > 0.01:
        return jsonify({"success": False, "error": "Debits must equal credits"}), 400
    tax_account = Account.query.filter(Account.code == "2300").first()
    cash_account = Account.query.filter(Account.code == "1000").first() or Account.query.filter(Account.type == "asset").first()
    acc_map = {a.id: a for a in Account.query.all()}
    if tax_rate_id and tax_account and cash_account:
        tr = TaxRate.query.get(tax_rate_id)
        if tr:
            rate = float(tr.rate or 0) / 100
            income_taxable = 0.0
            expense_taxable = 0.0
            for l in lines:
                acc = acc_map.get(l["account_id"])
                if acc and acc.type == "income":
                    income_taxable += l["credit"]
                elif acc and acc.type == "expense":
                    expense_taxable += l["debit"]
            inc_tax = round(income_taxable * rate, 2)
            exp_tax = round(expense_taxable * rate, 2)
            if inc_tax > 0.01:
                lines.append({"account_id": tax_account.id, "debit": 0, "credit": inc_tax, "memo": f"{tr.name}"})
                lines.append({"account_id": cash_account.id, "debit": inc_tax, "credit": 0, "memo": f"{tr.name}"})
            if exp_tax > 0.01:
                lines.append({"account_id": tax_account.id, "debit": exp_tax, "credit": 0, "memo": f"{tr.name}"})
                lines.append({"account_id": cash_account.id, "debit": 0, "credit": exp_tax, "memo": f"{tr.name}"})
    je = JournalEntry(description=desc, reference=ref, date=txn_date)
    db.session.add(je)
    db.session.flush()
    for l in lines:
        aid = l.get("account_id")
        if not aid:
            continue
        jl = JournalLine(
            journal_entry_id=je.id,
            account_id=aid,
            debit=float(l.get("debit", 0) or 0),
            credit=float(l.get("credit", 0) or 0),
            memo=(l.get("memo") or "").strip(),
        )
        db.session.add(jl)
    db.session.commit()
    return jsonify({"success": True, "id": je.id})


def _scan_pdf_file(pdf_path):
    """Embedded PDF scanner logic (from Scanner.py). Returns list of {account, debit, credit}.
    Works in both dev and PyInstaller exe - no subprocess."""
    def parse_num(s):
        if not s:
            return 0.0
        s = str(s).replace(",", "").replace("$", "").strip()
        try:
            return float(s)
        except ValueError:
            return 0.0

    rows = []
    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in (tables or []):
                    for raw_row in table:
                        if raw_row and any(cell and str(cell).strip() for cell in raw_row):
                            rows.append([(c or "").strip() for c in raw_row])
    except ImportError:
        return None, "pdfplumber not installed. Run: pip install pdfplumber"
    except Exception as e:
        return None, str(e)

    result = []
    for row in rows:
        if len(row) < 2:
            continue
        account = row[0] if row else ""
        debit = 0.0
        credit = 0.0
        if len(row) >= 4:
            debit = parse_num(row[1])
            credit = parse_num(row[2])
        elif len(row) >= 2:
            net = parse_num(row[1])
            if net >= 0:
                debit = net
            else:
                credit = abs(net)
        result.append({"account": account, "debit": debit, "credit": credit})
    if not result:
        result.append({"account": "Uncategorized", "debit": 0.0, "credit": 0.0})
    return result, None


@app.route("/api/scan-pdf", methods=["POST"])
def api_scan_pdf():
    """Upload PDF, scan via embedded logic (no subprocess). Returns parsed rows."""
    import tempfile
    from datetime import datetime
    f = request.files.get("file")
    if not f or not f.filename.lower().endswith(".pdf"):
        return jsonify({"success": False, "error": "PDF file required"}), 400
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            f.save(tmp.name)
            tmp_path = tmp.name
        rows, err = _scan_pdf_file(tmp_path)
        if err:
            return jsonify({"success": False, "error": err}), 500
        today = datetime.utcnow().strftime("%Y-%m-%d")
        result = []
        for r in rows:
            if (r.get("debit") or 0) == 0 and (r.get("credit") or 0) == 0 and r.get("account") == "Uncategorized":
                continue
            result.append({
                "account": r.get("account", ""),
                "debit": float(r.get("debit", 0) or 0),
                "credit": float(r.get("credit", 0) or 0),
                "description": f"PDF Import: {r.get('account', '')}",
                "date": today,
            })
        if not result:
            return jsonify({"success": False, "error": "No transactions found in PDF"}), 400
        return jsonify({"success": True, "rows": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


@app.route("/api/transactions/import", methods=["POST"])
def api_import_transactions():
    """Import scanned rows as journal entries (one per row, or batch)."""
    data = request.get_json() or {}
    rows = data.get("rows") or []
    from datetime import datetime
    imported = 0
    for r in rows:
        account_id = r.get("account_id")
        if not account_id:
            continue
        debit = float(r.get("debit", 0) or 0)
        credit = float(r.get("credit", 0) or 0)
        if debit == 0 and credit == 0:
            continue
        desc = (r.get("description") or "").strip() or "PDF Import"
        date_str = r.get("date")
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00").split("T")[0]) if date_str else datetime.utcnow()
            if hasattr(dt, "tzinfo") and dt.tzinfo:
                dt = dt.replace(tzinfo=None)
        except Exception:
            dt = datetime.utcnow()
        # Create 2-line journal: one for this account, one for balancing (e.g. Cash or Uncategorized)
        cash = Account.query.filter(Account.type == "asset").first()
        other = cash or Account.query.first()
        if not other:
            continue
        lines = [
            {"account_id": account_id, "debit": debit, "credit": credit, "memo": desc},
            {"account_id": other.id, "debit": credit, "credit": debit, "memo": desc},
        ]
        total_d = lines[0]["debit"] + lines[1]["debit"]
        total_c = lines[0]["credit"] + lines[1]["credit"]
        if abs(total_d - total_c) > 0.01:
            continue
        je = JournalEntry(description=desc, date=dt if hasattr(dt, "isoformat") else datetime.utcnow())
        db.session.add(je)
        db.session.flush()
        for ln in lines:
            db.session.add(JournalLine(
                journal_entry_id=je.id,
                account_id=ln["account_id"],
                debit=ln["debit"],
                credit=ln["credit"],
                memo=ln["memo"],
            ))
        imported += 1
    db.session.commit()
    return jsonify({"success": True, "imported": imported})


@app.route("/api/export/<export_type>")
def api_export(export_type):
    """CSV export. all|general-ledger|income-statement|balance-sheet"""
    from datetime import datetime
    today = datetime.utcnow().strftime("%Y-%m-%d")
    csv_rows = []
    filename = f"export-{today}.csv"
    if export_type == "all":
        filename = f"all-data-{today}.csv"
        csv_rows.append(["ACCOUNTS"])
        csv_rows.append(["id","name","type","code","description","active"])
        for a in Account.query.all():
            csv_rows.append([a.id, a.name, a.type, getattr(a, "code", "") or "", a.description or "", getattr(a, "active", True)])
        csv_rows.append([])
        csv_rows.append(["TRANSACTIONS"])
        csv_rows.append(["id","date","description","amount","type","status"])
        for t in Transaction.query.order_by(Transaction.date, Transaction.id).all():
            csv_rows.append([t.id, t.date.isoformat() if t.date else "", t.description, t.amount, t.type, getattr(t, "status", "posted")])
        csv_rows.append([])
        csv_rows.append(["JOURNAL_ENTRIES"])
        csv_rows.append(["id","date","description","reference","status"])
        for je in JournalEntry.query.order_by(JournalEntry.date, JournalEntry.id).all():
            csv_rows.append([je.id, je.date.isoformat() if je.date else "", je.description, je.reference or "", getattr(je, "status", "posted")])
        csv_rows.append([])
        csv_rows.append(["JOURNAL_LINES"])
        csv_rows.append(["id","journal_entry_id","account_id","debit","credit","memo"])
        for jl in JournalLine.query.order_by(JournalLine.journal_entry_id, JournalLine.id).all():
            csv_rows.append([jl.id, jl.journal_entry_id, jl.account_id, jl.debit, jl.credit, jl.memo or ""])
        csv_rows.append([])
        csv_rows.append(["TAX_RATES"])
        csv_rows.append(["id","name","rate","active"])
        for r in TaxRate.query.all():
            csv_rows.append([r.id, r.name, r.rate, r.active])
    elif export_type == "general-ledger":
        aid = request.args.get("account_id", type=int)
        date_from = request.args.get("from", "")
        date_to = request.args.get("to", "")
        filename = f"general-ledger-{today}.csv"
        if not aid:
            csv_rows = [["No account selected"]]
        else:
            acc = Account.query.get(aid)
            if not acc:
                csv_rows = [["Account not found"]]
            else:
                data = _general_ledger_data(aid, date_from or None, date_to or None)
                csv_rows.append([f"General Ledger: {data['account']['code']} {data['account']['name']}"])
                csv_rows.append(["Date","Transaction","Description","Debit","Credit","Balance"])
                for e in data.get("entries", []):
                    csv_rows.append([e.get("date",""), e.get("txn_id",""), e.get("description",""), e.get("debit",0), e.get("credit",0), e.get("balance",0)])
    elif export_type == "income-statement":
        date_from = request.args.get("from", "")
        date_to = request.args.get("to", "")
        filename = f"income-statement-{today}.csv"
        data = _income_statement_data(date_from or None, date_to or None)
        csv_rows.append([f"Income Statement {date_from or 'start'} to {date_to or 'end'}"])
        csv_rows.append(["Total Revenue", data["total_revenue"]])
        csv_rows.append(["Total Expenses", data["total_expenses"]])
        csv_rows.append(["Net Income", data["net_income"]])
    elif export_type == "transactions":
        filename = f"transactions-{today}.csv"
        csv_rows.append(["Reference","Date","Description","Amount","Type","Status"])
        for t in Transaction.query.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(500).all():
            csv_rows.append([f"T-{t.id:06d}", t.date.isoformat()[:10] if t.date else "", t.description, t.amount, t.type, getattr(t, "status", "posted")])
        for je in JournalEntry.query.order_by(JournalEntry.date.desc(), JournalEntry.id.desc()).limit(500).all():
            total_d = sum(float(jl.debit or 0) for jl in je.lines)
            total_c = sum(float(jl.credit or 0) for jl in je.lines)
            total = max(total_d, total_c)
            csv_rows.append([f"JE-{je.id:06d}", je.date.isoformat()[:10] if je.date else "", je.description, total, "journal", getattr(je, "status", "posted")])
    elif export_type == "balance-sheet":
        date_from = request.args.get("from") or ""
        date_to = request.args.get("to") or today
        filename = f"balance-sheet-{date_from or 'start'}-{date_to}.csv"
        data = _balance_sheet_data(date_from or None, date_to or None)
        csv_rows.append([f"Balance Sheet {date_from or 'start'} to {date_to}"])
        csv_rows.append(["Assets"])
        for a in data["assets"]:
            csv_rows.append([a["name"], a["balance"]])
        csv_rows.append(["Total Assets", data["total_assets"]])
        csv_rows.append([])
        csv_rows.append(["Liabilities"])
        for a in data["liabilities"]:
            csv_rows.append([a["name"], a["balance"]])
        csv_rows.append(["Total Liabilities", data["total_liabilities"]])
        csv_rows.append([])
        csv_rows.append(["Equity"])
        for a in data["equity"]:
            csv_rows.append([a["name"], a["balance"]])
        csv_rows.append(["Total Equity", data["total_equity"]])
    else:
        return jsonify({"error": "Unknown export type"}), 400
    import io
    import csv as csv_mod
    buf = io.StringIO()
    w = csv_mod.writer(buf)
    for row in csv_rows:
        w.writerow(row)
    return Response(buf.getvalue(), mimetype="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})


@app.route("/api/transactions/<txn_type>-<int:txn_id>/void", methods=["POST"])
def api_void_transaction(txn_type, txn_id):
    """Void a transaction or journal entry. POST body: { reason?: string }"""
    from datetime import datetime
    reason = (request.get_json() or {}).get("reason", "")
    if txn_type == "T":
        t = Transaction.query.get_or_404(txn_id)
        try:
            t.status = "void"
            t.voided_at = datetime.utcnow()
            t.voided_reason = reason
        except Exception:
            db.session.rollback()
            return jsonify({"success": False, "error": "Status column may not exist"}), 500
    elif txn_type == "JE":
        je = JournalEntry.query.get_or_404(txn_id)
        try:
            je.status = "void"
            je.voided_at = datetime.utcnow()
            je.voided_reason = reason
        except Exception:
            db.session.rollback()
            return jsonify({"success": False, "error": "Status column may not exist"}), 500
    else:
        return jsonify({"success": False, "error": "Invalid type"}), 400
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/transactions/detail")
def api_transaction_detail():
    """Get full transaction detail (lines) for display. ?id=T-123 or ?id=JE-456"""
    txn_id = request.args.get("id", "")
    if txn_id.startswith("T-"):
        tid = int(txn_id[2:])
        t = Transaction.query.get(tid)
        if not t:
            return jsonify({"error": "Not found"}), 404
        acc_map = {a.id: a for a in Account.query.all()}
        deb = t.debit_account
        cred = t.credit_account
        lines = []
        if deb:
            lines.append({"account": f"{getattr(deb,'code','')} {deb.name}", "type": "debit", "debit": float(t.amount), "credit": 0, "tax": ""})
        if cred:
            lines.append({"account": f"{getattr(cred,'code','')} {cred.name}", "type": "credit", "debit": 0, "credit": float(t.amount), "tax": ""})
        return jsonify({
            "id": f"T-{t.id}",
            "reference": getattr(t, "reference", "") or "",
            "date": t.date.isoformat() if t.date else None,
            "description": t.description,
            "status": getattr(t, "status", "posted"),
            "lines": lines,
        })
    elif txn_id.startswith("JE-"):
        jid = int(txn_id[3:])
        je = JournalEntry.query.get(jid)
        if not je:
            return jsonify({"error": "Not found"}), 404
        acc_map = {a.id: a for a in Account.query.all()}
        tax_acc = Account.query.filter(Account.code == "2300").first()
        lines = []
        tax_amt = 0.0
        for jl in je.lines:
            acc = acc_map.get(jl.account_id)
            amt = float(jl.debit or 0) + float(jl.credit or 0)
            if tax_acc and jl.account_id == tax_acc.id:
                tax_amt += amt
            lines.append({
                "account": f"{getattr(acc,'code','') if acc else ''} {acc.name if acc else 'Unknown'}",
                "type": "debit" if (jl.debit or 0) > 0 else "credit",
                "debit": float(jl.debit or 0),
                "credit": float(jl.credit or 0),
                "tax": "",
            })
        total = max(sum(float(jl.debit or 0) for jl in je.lines), sum(float(jl.credit or 0) for jl in je.lines))
        subtotal = round(total - tax_amt, 2)
        return jsonify({
            "id": f"JE-{je.id}",
            "reference": je.reference or "",
            "date": je.date.isoformat() if je.date else None,
            "description": je.description,
            "status": getattr(je, "status", "posted"),
            "lines": lines,
            "subtotal": subtotal,
            "tax_amount": round(tax_amt, 2),
            "total": round(total, 2),
        })
    return jsonify({"error": "Invalid id"}), 400


@app.route("/clear")
def clear_db():
    """Delete all transactions (keeps accounts)."""
    try:
        Transaction.query.delete()
        db.session.commit()
    except Exception:
        db.session.rollback()
    return redirect("/")


# -----------------------------------------------------------------------------
# SPA HTML (self-contained Tailwind/Shadcn-like styling)
# -----------------------------------------------------------------------------

SPA_HTML = r'''<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crania Accounting</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    :root{
      --bg: #0f172a; --bg-card: #1e293b; --border: #334155; --text: #f1f5f9;
      --text-muted: #94a3b8; --accent: #10b981; --accent-hover: #059669;
      --income: #22c55e; --expense: #ef4444; --radius: 0.5rem; --radius-lg: 0.75rem;
    }
    body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;}
    .flex{display:flex;} .flex-1{flex:1;} .gap-2{gap:0.5rem;} .gap-3{gap:0.75rem;} .gap-4{gap:1rem;} .gap-6{gap:1.5rem;}
    .items-center{align-items:center;} .justify-between{justify-content:space-between;} .flex-col{flex-direction:column;}
    .h-screen{height:100vh;} .w-64{width:16rem;} .w-16{width:4rem;} .shrink-0{flex-shrink:0;}
    .min-h-\[400px\]{min-height:400px;} .overflow-hidden{overflow:hidden;}
    .overflow-y-auto{overflow-y:auto;} .overflow-x-auto{overflow-x:auto;} .p-4{padding:1rem;} .p-6{padding:1.5rem;}
    .px-4{padding-left:1rem;padding-right:1rem;} .py-2{padding-top:0.5rem;padding-bottom:0.5rem;}
    .py-3{padding-top:0.75rem;padding-bottom:0.75rem;} .py-4{padding-top:1rem;padding-bottom:1rem;}
    .mb-2{margin-bottom:0.5rem;} .mb-4{margin-bottom:1rem;} .mb-6{margin-bottom:1.5rem;} .mb-8{margin-bottom:2rem;}
    .mt-1{margin-top:0.25rem;} .mt-2{margin-top:0.5rem;} .mt-4{margin-top:1rem;}
    .rounded{border-radius:var(--radius);} .rounded-lg{border-radius:var(--radius-lg);} .rounded-xl{border-radius:1rem;}
    .border{border:1px solid var(--border);} .border-b{border-bottom:1px solid var(--border);}
    .border-t{border-top:1px solid var(--border);} .border-r{border-right:1px solid var(--border);}
    .bg-sidebar{background:#0f172a;} .bg-card{background:var(--bg-card);}
    .bg-accent{background:var(--accent);} .text-muted{color:var(--text-muted);}
    .text-accent{color:var(--accent);} .text-income{color:var(--income);} .text-expense{color:var(--expense);}
    .text-sm{font-size:0.875rem;} .text-xs{font-size:0.75rem;} .text-2xl{font-size:1.5rem;} .text-lg{font-size:1.125rem;}
    .font-medium{font-weight:500;} .font-semibold{font-weight:600;} .font-bold{font-weight:700;}
    .font-mono{font-family:ui-monospace,monospace;}
    input,select,button{font-family:inherit;font-size:0.875rem;}
    input,select{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:0.5rem 0.75rem;}
    input:focus,select:focus{outline:none;border-color:var(--accent);}
    button{cursor:pointer;border:none;border-radius:var(--radius);padding:0.5rem 1rem;font-weight:500;}
    .btn-primary{background:var(--accent);color:white;} .btn-primary:hover{background:var(--accent-hover);}
    .btn-ghost{background:transparent;color:var(--text-muted);} .btn-ghost:hover{background:rgba(255,255,255,0.05);color:var(--text);}
    .btn-outline{background:transparent;border:1px solid var(--border);color:var(--text);}
    .btn-outline:hover{background:rgba(255,255,255,0.05);}
    .btn-preset-active{background:rgba(16,185,129,0.2);border-color:var(--accent);color:var(--accent);}
    .card{padding:1.25rem;border-radius:var(--radius-lg);border:1px solid var(--border);background:var(--bg-card);}
    .nav-item{padding:0.5rem 0.75rem;border-radius:var(--radius);margin:1px 0;cursor:pointer;}
    .nav-item:hover{background:rgba(255,255,255,0.05);color:var(--text);}
    .nav-item.active{background:rgba(16,185,129,0.15);color:var(--accent);border:1px solid rgba(16,185,129,0.3);}
    .section-label{font-size:0.625rem;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:0.5rem;padding:0 0.5rem;}
    table{width:100%;border-collapse:collapse;} th,td{padding:0.75rem 1rem;text-align:left;border-bottom:1px solid var(--border);}
    th{font-weight:500;color:var(--text-muted);font-size:0.75rem;} td{font-size:0.875rem;}
    .empty-state{text-align:center;padding:3rem 2rem;color:var(--text-muted);}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;}
    .modal{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);max-width:90vw;max-height:90vh;overflow-y:auto;padding:1.5rem;}
    .modal-light{background:#1e293b;}
    .debit-col{color:#f59e0b;} .credit-col{color:#22c55e;}
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1rem;}
    .badge{font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:999px;font-weight:500;}
    .badge-posted{background:rgba(34,197,94,0.2);color:#22c55e;}
    .badge-void{background:rgba(239,68,68,0.2);color:#ef4444;}
    .badge-draft{background:rgba(148,163,184,0.2);color:#94a3b8;}
    .scan-unmatched{background:rgba(239,68,68,0.08);} .border-expense{border-color:#ef4444;}
    .space-y-2>*+*{margin-top:0.5rem;}
    .hidden{display:none !important;}
    .line-through{text-decoration:line-through;}
    label{display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:0.25rem;}
  </style>
</head>
<body>
  <div class="flex h-screen">
    <!-- Sidebar -->
    <aside class="flex flex-col w-64 bg-sidebar border-r overflow-hidden shrink-0">
      <div class="flex items-center gap-2 p-4 border-b">
        <div class="w-8 h-8 rounded-lg bg-accent flex items-center justify-center" style="color:white">&#128196;</div>
        <div>
          <h1 class="font-semibold text-sm font-mono">LocalHost</h1>
          <p class="text-xs text-muted" style="font-size:10px;letter-spacing:0.1em">ACCOUNTING</p>
        </div>
      </div>
      <nav class="flex-1 overflow-y-auto p-4">
        <p class="section-label">Main</p>
        <div class="nav-item active" data-section="dashboard">&#128202; Dashboard</div>
        <div class="nav-item" data-section="accounts">&#128214; Chart of Accounts</div>
        <div class="nav-item" data-section="transactions">&#128221; Transactions</div>
        <p class="section-label mt-4">Reports</p>
        <div class="nav-item" data-section="general-ledger">&#128210; General Ledger</div>
        <div class="nav-item" data-section="balance-sheet">&#9881; Balance Sheet</div>
        <div class="nav-item" data-section="income-statement">&#128202; Income Statement</div>
        <p class="section-label mt-4">System</p>
        <div class="nav-item" data-section="settings">&#9881; Settings</div>
      </nav>
    </aside>
    <!-- Main content -->
    <main class="flex-1 overflow-y-auto p-6">
      <div id="content" class="card p-6 min-h-[400px]"></div>
    </main>
  </div>

  <script>
    const fmt = (n) => (typeof n === 'number' ? n : parseFloat(n || 0)).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const fmtDate = (s) => s ? new Date(s).toLocaleDateString() : '-';

    let section = 'dashboard';
    let accounts = [], transactions = [], dashboard = null, taxRates = [];

    function qs(s) { return document.querySelector(s); }
    function qsa(s) { return document.querySelectorAll(s); }

    async function fetchJSON(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    }

    async function load() {
      const res = await Promise.all([
        fetchJSON('/api/accounts?active=false'),
        fetchJSON('/api/transactions'),
        fetchJSON('/api/dashboard'),
        fetchJSON('/api/tax-rates'),
      ]);
      accounts = res[0]; transactions = res[1]; dashboard = res[2]; taxRates = res[3];
      await render();
    }

    async function setSection(s) {
      section = s;
      qsa('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.section === section);
      });
      await render();
    }

    async function render() {
      const c = qs('#content');
      if (section === 'dashboard') {
        c.innerHTML = `
          <div class="flex justify-between items-center mb-8">
            <div>
              <h2 class="text-2xl font-semibold font-mono">Dashboard</h2>
              <p class="text-sm text-muted mt-1">Financial overview</p>
            </div>
            <button class="btn-primary" onclick="showJournalModal()">+ New Transaction</button>
          </div>
          <div class="flex gap-4 mb-8" style="flex-wrap:wrap">
            <div class="card flex-1 min-w-[180px]">
              <p class="text-sm text-muted">Balance</p>
              <p class="text-2xl font-bold font-mono ${dashboard.total >= 0 ? 'text-income' : 'text-expense'}">${fmt(dashboard.total)}</p>
              <p class="text-xs text-muted mt-1">Cash position</p>
            </div>
            <div class="card flex-1 min-w-[180px]">
              <p class="text-sm text-muted">Income (Total)</p>
              <p class="text-2xl font-bold font-mono text-income">${fmt(dashboard.income_total)}</p>
              <p class="text-xs text-muted mt-1">Revenue</p>
            </div>
            <div class="card flex-1 min-w-[180px]">
              <p class="text-sm text-muted">Expenses (Total)</p>
              <p class="text-2xl font-bold font-mono text-expense">${fmt(dashboard.expense_total)}</p>
              <p class="text-xs text-muted mt-1">Outflows</p>
            </div>
          </div>
          <div class="card">
            <div class="flex justify-between items-center mb-4">
              <h3 class="font-semibold">Recent Transactions</h3>
              <button class="btn-outline text-sm" onclick="setSection('transactions')">View All</button>
            </div>
            ${dashboard.transactions.length === 0 ? '<div class="empty-state">No transactions yet. <button class="btn-primary mt-2" onclick="showJournalModal()">Add first transaction</button></div>' : `
            <table><thead><tr><th>Description</th><th>Date</th><th>Amount</th><th>Type</th></tr></thead><tbody>
            ${dashboard.transactions.map(t => '<tr><td>'+t.description+'</td><td>'+fmtDate(t.date)+'</td><td class="'+(t.type==='income'?'text-income':t.type==='expense'?'text-expense':'')+' font-mono">'+fmt(t.amount)+'</td><td>'+t.type+'</td></tr>').join('')}
            </tbody></table>`}
          </div>
        `;
      } else if (section === 'accounts') {
        const activeCount = accounts.filter(a=>a.active!==false).length;
        const types = ['asset','liability','equity','income','expense'];
        const typeLabel = {asset:'Assets',liability:'Liabilities',equity:'Equity',income:'Income',expense:'Expenses'};
        let tbl = '';
        types.forEach(ty => {
          const accs = accounts.filter(a=>a.type===ty);
          if (accs.length) {
            tbl += '<tr class="border-t-2"><td colspan="5" class="font-semibold text-muted py-2 uppercase text-xs">'+typeLabel[ty]+'</td></tr>';
            tbl += accs.map(a => '<tr><td class="font-mono">'+(a.code||'')+'</td><td>'+a.name+'</td><td>'+a.type+'</td><td class="text-muted">'+a.description+'</td><td>'+(a.active!==false?'Yes':'No')+'</td></tr>').join('');
          }
        });
        c.innerHTML = `
          <div class="flex justify-between items-center mb-6">
            <div><h2 class="text-2xl font-semibold font-mono">Chart of Accounts</h2><p class="text-sm text-muted mt-1">${accounts.length} accounts • ${activeCount} active</p></div>
            <button class="btn-primary" onclick="showAddAccount()">+ Add Account</button>
          </div>
          <div class="overflow-x-auto"><table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Description</th><th>Active</th></tr></thead><tbody>
          ${tbl}
          </tbody></table></div>
          <div id="addAccountModal"></div>
        `;
      } else if (section === 'general-ledger') {
        c.innerHTML = '<div class="empty-state">Loading...</div>';
        const accs = await fetchJSON('/api/accounts?active=false');
        c.innerHTML = `
          <div class="flex justify-between items-center mb-6">
            <div><h2 class="text-2xl font-semibold font-mono">General Ledger</h2><p class="text-sm text-muted mt-1">Account activity and running balance</p></div>
            <button class="btn-outline" onclick="exportGL()">Export CSV</button>
          </div>
          <div class="flex gap-4 flex-wrap mb-4">
            <div><label>Account</label><select id="glAccount" onchange="loadGL()" class="w-48">${accs.map(a=>'<option value="'+a.id+'">'+(a.code||'')+' '+a.name+'</option>').join('')}</select></div>
            <div><label>From</label><input type="date" id="glFrom" onchange="loadGL()" class="w-36"></div>
            <div><label>To</label><input type="date" id="glTo" onchange="loadGL()" class="w-36"></div>
            <div><label>&nbsp;</label><button class="btn-ghost" onclick="document.getElementById('glFrom').value='';document.getElementById('glTo').value='';loadGL();">Clear Dates</button></div>
          </div>
          <div id="glContent"></div>
        `;
        await loadGL();
      } else if (section === 'settings') {
        c.innerHTML = `
          <div class="mb-6"><h2 class="text-2xl font-semibold font-mono">Settings</h2><p class="text-sm text-muted mt-1">Configure your accounting system</p></div>
          <div class="card mb-6">
            <div class="flex justify-between items-center mb-4"><h3 class="font-semibold">Tax Rates</h3><button class="btn-primary" onclick="showAddTaxRate()">+ Add Tax Rate</button></div>
            <p class="text-sm text-muted mb-4">Configure tax rates for your jurisdiction.</p>
            <table><thead><tr><th>Name</th><th>Rate</th><th>In Use</th><th>Description</th></tr></thead><tbody>
            ${taxRates.map(r=>'<tr><td>'+r.name+'</td><td>'+r.rate+'%</td><td class="font-mono">'+(r.in_use||0)+'</td><td class="text-muted">-</td></tr>').join('')}
            </tbody></table>
          </div>
          <div class="card">
            <h3 class="font-semibold mb-4">Data Management</h3>
            <p class="text-sm text-muted mb-4">Export or reset your accounting data.</p>
            <div class="flex gap-4 flex-wrap">
              <div><p class="font-medium mb-1">Export All Data</p><p class="text-xs text-muted mb-2">Download accounts and transactions as CSV.</p><button class="btn-outline" onclick="exportData()">Export</button></div>
              <div><p class="font-medium mb-1">Reset to Defaults</p><p class="text-xs text-muted mb-2">Delete all data and restore defaults.</p><button class="btn-outline" style="color:var(--expense)" onclick="if(confirm('Delete all transactions?')) fetch('/clear').then(()=>load())">Reset</button></div>
            </div>
          </div>
        `;
      } else if (section === 'transactions') {
        c.innerHTML = `
          <div class="flex justify-between items-center mb-6">
            <div><h2 class="text-2xl font-semibold font-mono">Transactions</h2><p class="text-sm text-muted mt-1">${transactions.length} of ${transactions.length} transactions</p></div>
            <div class="flex gap-2">
              <input type="file" id="pdfInput" accept=".pdf" style="display:none" onchange="handleScanPdf(event)">
              <button class="btn-outline" onclick="document.getElementById('pdfInput').click()">Scan PDF Statement</button>
              <button class="btn-outline" onclick="exportTransactionsCSV()">Export CSV</button>
              <button class="btn-primary" onclick="showJournalModal()">+ New Transaction</button>
            </div>
          </div>
          <div id="scanPreview"></div>
          ${transactions.length === 0 ? '<div class="empty-state">No transactions yet. <button class="btn-primary mt-2" onclick="showJournalModal()">Add first transaction</button></div>' : `
          <div class="space-y-2">${transactions.map((t,i)=>`<div class="card txn-row" data-id="${t.id}">
            <div class="flex items-center gap-2 cursor-pointer txn-summary" onclick="toggleTxnDetail('${t.id.replace(/'/g,"\\'")}')">
              <span class="chevron" id="chev-${t.id.replace(/-/g,'_')}">&#9654;</span>
              <span class="font-mono font-medium">TXN-${String((t.id.match(/\\d+/)||['0'])[0]).padStart(6,'0')}</span>
              <span class="badge badge-${(t.status||'posted')==='void'?'void':'posted'}">${(t.status||'posted')==='void'?'Voided':(t.status||'posted')==='draft'?'Draft':'Posted'}</span>
              <span class="${(t.status||'posted')==='void'?'line-through text-muted':''} flex-1">${t.description||'-'}</span>
              <span class="font-mono font-semibold ${t.type==='income'?'text-income':t.type==='expense'?'text-expense':''}">${fmt(t.amount)}</span>
              <span class="text-muted text-sm">${fmtDate(t.date)}</span>
              <button type="button" class="btn-ghost p-1" onclick="event.stopPropagation();showTxnMenu('${t.id.replace(/'/g,"\\'")}',event)">&#8942;</button>
            </div>
            <div id="detail-${t.id.replace(/-/g,'_')}" class="txn-detail hidden mt-3 pt-3 border-t"><div class="empty-state py-4">Loading...</div></div>
          </div>`).join('')}</div>`}
        `;
        window.expandedTxns = window.expandedTxns || {};
      } else if (section === 'balance-sheet' || section === 'income-statement') {
        c.innerHTML = '<div class="empty-state">Loading...</div>';
        try {
          const toYMD = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
          const today = new Date();
          const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
          const defaultFrom = toYMD(new Date(y, m, 1));
          const defaultTo = toYMD(today);
          const isBS = section === 'balance-sheet';
          const pf = isBS ? 'bsFrom' : 'isFrom', pt = isBS ? 'bsTo' : 'isTo', pp = isBS ? 'bsPreset' : 'isPreset';
          let dateFrom = localStorage.getItem(pf) || defaultFrom;
          let dateTo = localStorage.getItem(pt) || defaultTo;
          let activePreset = localStorage.getItem(pp) || 'month';
          const getPresetRange = (p) => {
            const t = new Date(); const Y = t.getFullYear(); const M = t.getMonth(); const D = t.getDate();
            if (p === 'week') {
              const day = t.getDay();
              const diff = (day === 0) ? -6 : 1 - day;
              return { from: toYMD(new Date(Y, M, D + diff)), to: toYMD(t), preset: 'week' };
            }
            if (p === 'month') return { from: toYMD(new Date(Y, M, 1)), to: toYMD(t), preset: 'month' };
            if (p === 'lastmonth') return { from: toYMD(new Date(Y, M - 1, 1)), to: toYMD(new Date(Y, M, 0)), preset: 'lastmonth' };
            if (p === 'quarter') {
              const qs = Math.floor(M / 3) * 3;
              return { from: toYMD(new Date(Y, qs, 1)), to: toYMD(t), preset: 'quarter' };
            }
            if (p === 'lastquarter') {
              const cqs = Math.floor(M / 3) * 3;
              let lqs = cqs - 3, lqy = Y;
              if (lqs < 0) { lqs = 9; lqy = Y - 1; }
              return { from: toYMD(new Date(lqy, lqs, 1)), to: toYMD(new Date(lqy, lqs + 3, 0)), preset: 'lastquarter' };
            }
            if (p === 'year') return { from: toYMD(new Date(Y, 0, 1)), to: toYMD(t), preset: 'year' };
            if (p === 'lastyear') return { from: toYMD(new Date(Y - 1, 0, 1)), to: toYMD(new Date(Y - 1, 11, 31)), preset: 'lastyear' };
            return { from: dateFrom, to: dateTo, preset: 'custom' };
          };
          const applyPreset = (p) => {
            const r = getPresetRange(p);
            dateFrom = r.from; dateTo = r.to; activePreset = r.preset;
            localStorage.setItem(pf, dateFrom); localStorage.setItem(pt, dateTo); localStorage.setItem(pp, activePreset);
          };
          const presetBtns = (onPreset) => [
            ['week','This Week'],['month','This Month'],['lastmonth','Last Month'],['quarter','This Quarter'],
            ['lastquarter','Last Quarter'],['year','This Year'],['lastyear','Last Year'],['custom','Custom']
          ].map(([k,l]) => '<button type="button" class="btn-outline text-sm preset-btn '+(activePreset===k?'btn-preset-active':'')+'" data-preset="'+k+'" onclick="'+onPreset+'(\''+k+'\')">'+l+'</button>').join('');
          const dateRangeHtml = (exportPath) => `
            <div class="flex gap-4 flex-wrap mb-4 p-4 rounded" style="background:var(--bg)">
              <div><label>From</label><input type="date" id="reportFrom" value="${dateFrom}" onchange="reportDateChange()" class="w-40"></div>
              <div><label>To</label><input type="date" id="reportTo" value="${dateTo}" onchange="reportDateChange()" class="w-40"></div>
              <div class="flex gap-2 items-end flex-wrap"><span class="text-xs text-muted">Quick:</span>${presetBtns('reportSetPreset')}</div>
            </div>`;
          window.reportPf = pf; window.reportPt = pt; window.reportPp = pp; window.reportSection = section;
          window.reportDateChange = () => {
            const f = qs('#reportFrom')?.value; const t = qs('#reportTo')?.value;
            if (f) localStorage.setItem(window.reportPf, f); if (t) localStorage.setItem(window.reportPt, t);
            localStorage.setItem(window.reportPp, 'custom');
            setSection(window.reportSection);
          };
          window.reportSetPreset = (p) => {
            if (p === 'custom') { qs('#reportFrom')?.focus(); localStorage.setItem(window.reportPp, 'custom'); return; }
            const r = getPresetRange(p);
            localStorage.setItem(window.reportPf, r.from); localStorage.setItem(window.reportPt, r.to); localStorage.setItem(window.reportPp, r.preset);
            setSection(window.reportSection);
          };
          if (section === 'balance-sheet') {
            const r = await fetchJSON('/api/reports/balance-sheet?from=' + encodeURIComponent(dateFrom) + '&to=' + encodeURIComponent(dateTo));
            c.innerHTML = `
              <div class="flex justify-between items-center mb-6">
                <div><h2 class="text-2xl font-semibold font-mono">Balance Sheet</h2><p class="text-sm text-muted mt-1">Assets = Liabilities + Equity</p></div>
                <button class="btn-outline" onclick="window.open('/api/export/balance-sheet?from='+encodeURIComponent(document.getElementById('reportFrom')?.value||'')+'&to='+encodeURIComponent(document.getElementById('reportTo')?.value||''))">Export CSV</button>
              </div>
              ${dateRangeHtml('balance-sheet')}
              <div class="card">
                <h4 class="font-semibold text-income mb-4">Assets</h4>
                ${r.assets.length ? r.assets.map(a => '<div class="flex justify-between py-2 border-b"><span>'+(a.code?'<span class="font-mono text-muted">'+a.code+'</span> ':'')+a.name+'</span><span class="font-mono">'+fmt(a.balance)+'</span></div>').join('') : '<p class="text-muted text-sm py-2">No assets</p>'}
                <div class="flex justify-between py-4 mt-4 border-t-2 font-bold"><span>Total Assets</span><span class="font-mono text-income">${fmt(r.total_assets)}</span></div>
                <h4 class="font-semibold mt-6 mb-4" style="color:#a78bfa">Liabilities</h4>
                ${r.liabilities.length ? r.liabilities.map(a => '<div class="flex justify-between py-2 border-b"><span>'+(a.code?'<span class="font-mono text-muted">'+a.code+'</span> ':'')+a.name+'</span><span class="font-mono">'+fmt(a.balance)+'</span></div>').join('') : '<p class="text-muted text-sm py-2">None</p>'}
                <div class="flex justify-between py-4 mt-4 border-t-2 font-bold"><span>Total Liabilities</span><span class="font-mono" style="color:#a78bfa">${fmt(r.total_liabilities)}</span></div>
                <h4 class="font-semibold mt-6 mb-4" style="color:#6366f1">Equity</h4>
                ${r.equity.length ? r.equity.map(a => '<div class="flex justify-between py-2 border-b"><span>'+(a.code?'<span class="font-mono text-muted">'+a.code+'</span> ':'')+a.name+'</span><span class="font-mono">'+fmt(a.balance)+'</span></div>').join('') : '<p class="text-muted text-sm py-2">None</p>'}
                <div class="flex justify-between py-4 mt-4 border-t-2 font-bold"><span>Total Equity</span><span class="font-mono" style="color:#6366f1">${fmt(r.total_equity)}</span></div>
              </div>`;
          } else {
            const r = await fetchJSON('/api/reports/income-statement?from=' + encodeURIComponent(dateFrom) + '&to=' + encodeURIComponent(dateTo));
            c.innerHTML = `
              <div class="flex justify-between items-center mb-6">
                <div><h2 class="text-2xl font-semibold font-mono">Income Statement</h2><p class="text-sm text-muted mt-1">Profit & Loss</p></div>
                <button class="btn-outline" onclick="window.open('/api/export/income-statement?from='+encodeURIComponent(document.getElementById('reportFrom')?.value||'')+'&to='+encodeURIComponent(document.getElementById('reportTo')?.value||''))">Export CSV</button>
              </div>
              ${dateRangeHtml('income-statement')}
              <div class="card">
                <h4 class="font-semibold text-income mb-4">Revenue</h4>
                ${(r.revenue_accounts||[]).length ? (r.revenue_accounts||[]).map(a=>'<div class="flex justify-between py-2 border-b"><span>'+(a.code?'<span class="font-mono text-muted">'+a.code+'</span> ':'')+a.name+'</span><span class="font-mono text-income">'+fmt(a.balance)+'</span></div>').join('') : '<p class="text-muted text-sm py-2">No revenue in period</p>'}
                <div class="flex justify-between py-4 border-t font-bold"><span>Total Revenue</span><span class="font-mono text-income">${fmt(r.total_revenue)}</span></div>
                <h4 class="font-semibold mt-6 mb-4 text-expense">Expenses</h4>
                ${(r.expense_accounts||[]).length ? (r.expense_accounts||[]).map(a=>'<div class="flex justify-between py-2 border-b"><span>'+(a.code?'<span class="font-mono text-muted">'+a.code+'</span> ':'')+a.name+'</span><span class="font-mono text-expense">'+fmt(a.balance)+'</span></div>').join('') : '<p class="text-muted text-sm py-2">No expenses in period</p>'}
                <div class="flex justify-between py-4 border-t font-bold"><span>Total Expenses</span><span class="font-mono text-expense">${fmt(r.total_expenses)}</span></div>
                <div class="flex justify-between py-6 mt-4 border-t-2 font-bold"><span>Net Income</span><span class="font-mono text-lg ${r.net_income>=0?'text-income':'text-expense'}">${fmt(r.net_income)}</span></div>
              </div>`;
          }
        } catch (e) { c.innerHTML = '<p class="text-expense">Error loading report</p>'; }
        return;
      }
    }

    async function loadGL() {
      const aid = qs('#glAccount')?.value;
      if (!aid) return;
      const from = qs('#glFrom')?.value || '';
      const to = qs('#glTo')?.value || '';
      const url = '/api/general-ledger?account_id='+aid+(from?'&from='+from:'')+(to?'&to='+to:'');
      const r = await fetchJSON(url);
      const el = qs('#glContent');
      if (!el) return;
      if (!r.account) { el.innerHTML = '<p class="text-muted">Select an account</p>'; return; }
      const acc = r.account;
      el.innerHTML = `
        <div class="card mb-4"><div class="flex justify-between"><div><strong>${acc.code || ''} ${acc.name}</strong><p class="text-sm text-muted">${acc.type} - NORMAL: ${acc.type==='asset'||acc.type==='expense'?'DEBIT':'CREDIT'}</p></div><div class="font-mono font-bold">${r.entries.length ? fmt(r.entries[r.entries.length-1].balance) : fmt(0)}</div></div></div>
        <div class="card overflow-x-auto"><table><thead><tr><th>Date</th><th>Transaction</th><th>Description</th><th class="text-right debit-col">Debit</th><th class="text-right credit-col">Credit</th><th class="text-right">Balance</th></tr></thead><tbody>
        ${(r.entries||[]).map(e=>'<tr><td>'+fmtDate(e.date)+'</td><td>'+e.txn_id+'</td><td>'+e.description+'</td><td class="text-right debit-col font-mono">'+(e.debit?fmt(e.debit):'')+'</td><td class="text-right credit-col font-mono">'+(e.credit?fmt(e.credit):'')+'</td><td class="text-right font-mono">'+fmt(e.balance)+'</td></tr>').join('')}
        </tbody></table></div>
      `;
    }
    function showAddAccount() {
      document.body.insertAdjacentHTML('beforeend', `<div id="addAccModal" class="modal-overlay"><div class="modal" style="min-width:400px"><h3 class="font-semibold mb-4">Add Account</h3>
        <form id="addAccForm"><div class="mb-4"><label>Code</label><input name="code" class="w-full" placeholder="1000"></div><div class="mb-4"><label>Name</label><input name="name" class="w-full" required placeholder="Cash"></div><div class="mb-4"><label>Type</label><select name="type" class="w-full"><option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option><option value="income">Income</option><option value="expense">Expense</option></select></div><div class="mb-4"><label>Description</label><input name="description" class="w-full" placeholder="Optional"></div>
        <div class="flex gap-2 justify-end"><button type="button" class="btn-ghost" onclick="document.getElementById('addAccModal').remove()">Cancel</button><button type="submit" class="btn-primary">Create</button></div></form></div></div>`);
      qs('#addAccForm').onsubmit = async (e)=>{ e.preventDefault(); const fd=new FormData(e.target); const r=await fetch('/api/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:fd.get('code'),name:fd.get('name'),type:fd.get('type'),description:fd.get('description')})}); if(r.ok){ qs('#addAccModal').remove(); load(); } else alert((await r.json()).error); };
    }
    function showAddTaxRate() {
      document.body.insertAdjacentHTML('beforeend', `<div id="addTaxModal" class="modal-overlay"><div class="modal" style="min-width:360px"><h3 class="font-semibold mb-4">Add Tax Rate</h3>
        <form id="addTaxForm"><div class="mb-4"><label>Name</label><input name="name" class="w-full" required placeholder="HST"></div><div class="mb-4"><label>Rate (%)</label><input type="number" step="0.01" name="rate" value="0" class="w-full"></div>
        <div class="flex gap-2 justify-end"><button type="button" class="btn-ghost" onclick="document.getElementById('addTaxModal').remove()">Cancel</button><button type="submit" class="btn-primary">Create</button></div></form></div></div>`);
      qs('#addTaxForm').onsubmit = async (e)=>{ e.preventDefault(); const fd=new FormData(e.target); const r=await fetch('/api/tax-rates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:fd.get('name'),rate:parseFloat(fd.get('rate'))||0})}); if(r.ok){ document.getElementById('addTaxModal').remove(); taxRates=await fetchJSON('/api/tax-rates'); setSection('settings'); } else alert((await r.json()).error||'Error'); };
    }
    function exportGL() {
      const aid=qs('#glAccount')?.value; if(!aid) return;
      const from=qs('#glFrom')?.value||''; const to=qs('#glTo')?.value||'';
      let url='/api/export/general-ledger?account_id='+aid;
      if(from) url+='&from='+from; if(to) url+='&to='+to;
      window.open(url);
    }
    function exportData() { window.open('/api/export/all'); }
    function exportTransactionsCSV() { window.open('/api/export/transactions'); }
    async function toggleTxnDetail(id) {
      const safeId = id.replace(/-/g,'_');
      const detail = document.getElementById('detail-'+safeId);
      const chev = document.getElementById('chev-'+safeId);
      if (!detail || !chev) return;
      if (detail.classList.contains('hidden')) {
        detail.classList.remove('hidden');
        detail.innerHTML = '<div class="empty-state py-4">Loading...</div>';
        chev.textContent = '\u25BC';
        try {
          const r = await fetchJSON('/api/transactions/detail?id='+encodeURIComponent(id));
          renderTxnDetail(safeId, r);
        } catch (e) {
          detail.innerHTML = '<p class="text-expense">Error loading</p>';
        }
      } else {
        detail.classList.add('hidden');
        detail.innerHTML = '';
        chev.textContent = '\u9654';
      }
    }
    function renderTxnDetail(safeId, r) {
      const detail = document.getElementById('detail-'+safeId);
      if (!detail) return;
      if (r.error) { detail.innerHTML = '<p class="text-expense">Error loading</p>'; return; }
      const rows = (r.lines||[]).map(l=>'<tr><td>'+l.account+'</td><td>'+l.type+'</td><td class="text-right debit-col font-mono">'+(l.debit?fmt(l.debit):'')+'</td><td class="text-right credit-col font-mono">'+(l.credit?fmt(l.credit):'')+'</td></tr>').join('');
      let summary = '<p class="text-sm text-muted mt-2">Entry Date: '+fmtDate(r.date)+'</p>';
      if (r.subtotal != null && r.tax_amount != null && r.total != null && r.tax_amount > 0) {
        summary += '<p class="text-sm mt-2">Subtotal '+fmt(r.subtotal)+' | Tax '+fmt(r.tax_amount)+' | Total '+fmt(r.total)+'</p>';
      }
      summary += (r.status==='void'?'<p class="text-expense text-sm line-through">Voided</p>':'');
      detail.innerHTML = '<table><thead><tr><th>Account</th><th>Type</th><th class="text-right">Debit</th><th class="text-right">Credit</th></tr></thead><tbody>'+rows+'</tbody></table>'+summary;
    }
    function showTxnMenu(id, ev) {
      ev.stopPropagation();
      const row = document.querySelector('[data-id="'+id.replace(/"/g,'\\"')+'"]');
      const isVoid = row && row.querySelector('.badge-void');
      let html = '<div class="card p-2" style="min-width:140px">';
      if (!isVoid) html += '<button type="button" class="block w-full text-left px-3 py-2 rounded hover:bg-white/5 text-sm" onclick="voidTxn(\''+id.replace(/'/g,"\\'")+'\')">Void</button>';
      html += '</div>';
      let m = document.getElementById('txnMenu');
      if (m) m.remove();
      m = document.createElement('div');
      m.id = 'txnMenu';
      m.innerHTML = html;
      m.style.position = 'fixed';
      m.style.left = ev.clientX + 'px';
      m.style.top = ev.clientY + 'px';
      m.style.zIndex = 9999;
      document.body.appendChild(m);
      const close = () => { m.remove(); document.removeEventListener('click', close); };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
    async function voidTxn(apiId) {
      document.getElementById('txnMenu')?.remove();
      if (!confirm('Void this transaction? This cannot be undone.')) return;
      const r = await fetch('/api/transactions/'+apiId+'/void', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (j.success) load();
      else alert(j.error || 'Failed');
    }
    let scanRows = [];
    function fuzzyMatchAccount(hint) {
      if (!hint || !accounts.length) return accounts[0];
      const h = (hint||'').toLowerCase().trim();
      const match = accounts.find(a => (a.name||'').toLowerCase().includes(h) || (a.code||'').toString().includes(h) || h.includes((a.name||'').toLowerCase()) || h.includes((a.code||'').toString()));
      if (match) return match;
      const w = h.split(/\\s+/).filter(Boolean);
      for (const a of accounts) {
        const an = (a.name||'').toLowerCase(); const ac = (a.code||'').toString();
        if (w.some(word => an.includes(word) || ac.includes(word))) return a;
      }
      return null;
    }
    async function handleScanPdf(ev) {
      const f = ev.target.files[0]; if(!f) return;
      const p = qs('#scanPreview');
      if (p) p.innerHTML = '<div class="card mb-4 p-4"><p class="text-muted">Scanning PDF...</p></div>';
      const fd = new FormData(); fd.append('file', f);
      let j;
      try {
        const r = await fetch('/api/scan-pdf', { method: 'POST', body: fd });
        j = await r.json();
      } catch (e) { j = { success: false, error: e.message }; }
      ev.target.value = '';
      if (!p) return;
      if (!j.success) { p.innerHTML = '<div class="card mb-4 p-4"><p class="text-expense">'+j.error+'</p><button class="btn-ghost" onclick="qs(\'#scanPreview\').innerHTML=\'\'">Dismiss</button></div>'; return; }
      scanRows = (j.rows || []).map(row => {
        const match = fuzzyMatchAccount(row.account);
        return { ...row, account_id: match ? match.id : (accounts[0]?.id || 0), matched: !!match };
      });
      p.innerHTML = '<div class="card mb-4 p-4"><h3 class="font-semibold mb-4">Edit & match accounts: '+scanRows.length+' row(s)</h3><table class="mb-4"><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>'+
        scanRows.map((row,i)=>'<tr class="'+(row.matched?'':'scan-unmatched')+'"><td><input type="date" id="scanDate'+i+'" value="'+(row.date||'')+'" class="w-36" onchange="scanRows['+i+'].date=this.value"></td><td><input value="'+(row.description||'').replace(/"/g,'&quot;')+'" onchange="scanRows['+i+'].description=this.value" class="w-48"></td><td class="font-mono">'+fmt(row.debit||row.credit||0)+'</td><td><select id="scanAcc'+i+'" class="w-48 '+(row.matched?'':'border-expense')+'">'+accounts.map(a=>'<option value="'+a.id+'"'+(row.account_id==a.id?' selected':'')+'>'+(a.code||'')+' '+a.name+'</option>').join('')+'</select></td><td><input type="number" step="0.01" id="scanDebit'+i+'" value="'+row.debit+'" class="w-24 text-right" onchange="scanRows['+i+'].debit=parseFloat(this.value)||0"></td><td><input type="number" step="0.01" id="scanCredit'+i+'" value="'+row.credit+'" class="w-24 text-right" onchange="scanRows['+i+'].credit=parseFloat(this.value)||0"></td></tr>').join('')+
        '</tbody></table><button class="btn-primary" onclick="importScanRows()">Import Selected</button> <button class="btn-ghost" onclick="scanRows=[];qs(\'#scanPreview\').innerHTML=\'\'">Cancel</button></div>';
    }
    async function importScanRows() {
      const rows = scanRows.map((r,i)=>({...r, account_id: parseInt(qs('#scanAcc'+i)?.value) || r.account_id, date: qs('#scanDate'+i)?.value || r.date, debit: parseFloat(qs('#scanDebit'+i)?.value)||0, credit: parseFloat(qs('#scanCredit'+i)?.value)||0}));
      const r = await fetch('/api/transactions/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
      const j = await r.json();
      if (j.success) { scanRows = []; qs('#scanPreview') && (qs('#scanPreview').innerHTML = ''); load(); alert('Imported ' + j.imported + ' transactions'); }
      else alert(j.error || 'Import failed');
    }
    let journalLines = [{account_id:'',debit:'',credit:'',memo:''},{account_id:'',debit:'',credit:'',memo:''}];
    function showJournalModal() {
      const today = new Date().toISOString().slice(0,10);
      const taxOpts = '<option value="">None</option>'+taxRates.filter(r=>r.active!==false).map(r=>'<option value="'+r.id+'">'+r.name+' ('+r.rate+'%)</option>').join('');
      document.body.insertAdjacentHTML('beforeend', `<div id="journalModal" class="modal-overlay"><div class="modal" style="min-width:720px;max-width:90vw"><h3 class="font-semibold mb-2">New Journal Entry</h3><p class="text-sm text-muted mb-4">Balance your lines (debits = credits). Tax will be auto-added if selected.</p>
        <form id="journalForm"><div class="grid-2 mb-4"><div><label>Transaction Date</label><input type="date" name="date" value="${today}" class="w-full"></div><div><label>Description</label><input name="description" placeholder="e.g. Office supplies" required class="w-full"></div></div><div class="grid-2 mb-4"><div><label>Reference</label><input name="reference" placeholder="Optional" class="w-full"></div><div><label>Tax Rate (applies to income/expense lines)</label><select name="tax_rate_id" id="journalTaxRate" onchange="updateJournalTotals()" class="w-full">${taxOpts}</select></div></div>
        <div class="mb-2 flex justify-between"><label>Journal Lines</label><button type="button" class="btn-ghost text-sm" onclick="addJournalLine()">+ Add Line</button></div>
        <table class="mb-4"><thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Memo</th></tr></thead><tbody id="journalLinesBody"></tbody></table>
        <div class="mb-4 p-3 rounded" style="background:rgba(16,185,129,0.1)" id="journalBalance">Your lines: $0.00 Dr / $0.00 Cr</div>
        <div class="flex gap-2 justify-end"><button type="button" class="btn-ghost" onclick="document.getElementById('journalModal').remove()">Cancel</button><button type="submit" class="btn-primary" id="journalSubmit" disabled>Post Transaction</button></div></form></div></div>`);
      const renderLines = () => {
        const tb = qs('#journalLinesBody'); if(!tb) return;
        tb.innerHTML = journalLines.map((l,i)=>'<tr><td><select name="account_id" class="w-full"><option value="">Select account</option>'+accounts.filter(a=>a.active!==false).map(a=>'<option value="'+a.id+'"'+(l.account_id==a.id?' selected':'')+'>'+(a.code||'')+' '+a.name+'</option>').join('')+'</select></td><td><input type="number" step="0.01" name="debit" value="'+(l.debit||'')+'" class="w-24 text-right" onchange="updateJournalTotals()"></td><td><input type="number" step="0.01" name="credit" value="'+(l.credit||'')+'" class="w-24 text-right" onchange="updateJournalTotals()"></td><td><input name="memo" value="'+(l.memo||'')+'" class="w-32" placeholder="Optional"></td><td><button type="button" class="btn-ghost remove-line" data-idx="'+i+'">x</button></td></tr>').join('');
        tb.querySelectorAll('.remove-line').forEach(btn=>btn.onclick=()=>{ journalLines.splice(+btn.dataset.idx,1); if(journalLines.length<2)journalLines.push({account_id:'',debit:'',credit:'',memo:''}); renderLines(); updateJournalTotals(); });
      };
      window.addJournalLine = () => { journalLines.push({account_id:'',debit:'',credit:'',memo:''}); renderLines(); };
      window.updateJournalTotals = () => {
        const ds = document.querySelectorAll('#journalForm input[name="debit"]'); const cs = document.querySelectorAll('#journalForm input[name="credit"]');
        let td=0,tc=0; ds.forEach(i=>td+=parseFloat(i.value)||0); cs.forEach(i=>tc+=parseFloat(i.value)||0);
        const taxSel = qs('#journalTaxRate'); const taxLabel = taxSel && taxSel.value ? ' Tax will be auto-added.' : '';
        const el = qs('#journalBalance'); if(el) el.innerHTML = 'Your lines: '+fmt(td)+' Dr / '+fmt(tc)+' Cr'+(Math.abs(td-tc)<0.01 ? ' &#9989; Balanced.'+taxLabel : ' &#10060; Out of balance');
        qs('#journalSubmit').disabled = Math.abs(td-tc) >= 0.01 || td===0;
      };
      renderLines();
      qs('#journalForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const accs = e.target.querySelectorAll('select[name="account_id"]'); const debits = e.target.querySelectorAll('input[name="debit"]'); const credits = e.target.querySelectorAll('input[name="credit"]'); const memos = e.target.querySelectorAll('input[name="memo"]');
        const lines = []; for(let i=0;i<accs.length;i++){ const aid=parseInt(accs[i].value); if(!aid) continue; const d=parseFloat(debits[i]?.value)||0; const c=parseFloat(credits[i]?.value)||0; if(d===0&&c===0) continue; lines.push({account_id:aid,debit:d,credit:c,memo:memos[i]?.value||''}); }
        const taxId = qs('#journalTaxRate')?.value ? parseInt(qs('#journalTaxRate').value) : null;
        const r = await fetch('/api/transactions/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: fd.get('description'), reference: fd.get('reference'), date: fd.get('date'), tax_rate_id: taxId || undefined, lines }) });
        const j = await r.json();
        if (j.success) { document.getElementById('journalModal').remove(); load(); } else alert(j.error || 'Error');
      };
    }

    qsa('.nav-item').forEach(el => el.addEventListener('click', () => setSection(el.dataset.section)));
    load();
  </script>
</body>
</html>
'''

@app.route("/")
def index():
    return render_template_string(SPA_HTML)


# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    Timer(1, lambda: webbrowser.open("http://127.0.0.1:5000/")).start()
    print("Crania Accounting: http://127.0.0.1:5000")
    print("Data:", os.path.join(basedir, "accounting.db"))
    app.run(debug=False, host="127.0.0.1", port=5000, threaded=True)
