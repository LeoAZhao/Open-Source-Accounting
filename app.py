"""
Crania Accounting System - Flask app with SQLite persistence.
Run from source or as a PyInstaller-built Windows .exe.
"""
import os
import sys
import webbrowser
from threading import Timer

from flask import Flask, render_template_string, request, jsonify, redirect

from database import db

# -----------------------------------------------------------------------------
# Paths: development (source) vs frozen (PyInstaller bundle)
# -----------------------------------------------------------------------------
if getattr(sys, "frozen", False):
    # Running as compiled .exe: resources are in _MEIPASS, DB next to exe
    _MEIPASS = sys._MEIPASS
    basedir = os.path.dirname(sys.executable)  # folder containing the .exe
    template_folder = os.path.join(_MEIPASS, "templates")
    static_folder = os.path.join(_MEIPASS, "static")
    if not os.path.isdir(template_folder):
        template_folder = None  # use default (no templates dir in bundle)
    if not os.path.isdir(static_folder):
        static_folder = None
    app = Flask(
        __name__,
        template_folder=template_folder,
        static_folder=static_folder,
    )
else:
    # Running from source
    basedir = os.path.abspath(os.path.dirname(__file__))
    app = Flask(__name__)

# -----------------------------------------------------------------------------
# Database: SQLite file in basedir (project root in dev, exe folder when frozen)
# -----------------------------------------------------------------------------
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(basedir, "accounting.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

# Import models after db is bound to app
from models import Account, Transaction  # noqa: E402


def init_db():
    """Create tables and seed default accounts if missing."""
    db.create_all()
    if Account.query.count() == 0:
        defaults = [
            Account(name="Cash", type="asset", description="Cash on hand and bank"),
            Account(name="Income", type="income", description="Revenue and income"),
            Account(name="Expenses", type="expense", description="Operating expenses"),
        ]
        for acc in defaults:
            db.session.add(acc)
        db.session.commit()


# Run at startup (first request or on import if we call it from main)
with app.app_context():
    init_db()


# -----------------------------------------------------------------------------
# Routes (preserve existing URLs and behavior)
# -----------------------------------------------------------------------------

DASHBOARD_HTML = """
<!DOCTYPE html><html><head><title>Local Accounting</title>
<style>body{font-family:Arial;margin:40px;background:#f5f5f5;}h1{color:#333;}.stats{display:flex;gap:20px;margin:20px 0;}
.stat{background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}.form-group{margin:20px 0;}
input,select{padding:10px;margin:5px;font-size:16px;border:1px solid #ddd;border-radius:4px;}button{padding:10px 20px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;}
table{width:100%;border-collapse:collapse;margin-top:20px;}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd;}
th{background:#f8f9fa;}.income{ color: green; }.expense{ color: red; }</style></head>
<body><h1>💰 Crania Accounting System</h1>
<div class="stats"><div class="stat"><h2>${{ "%.2f"|format(total) }}</h2><p>Balance</p></div></div>
<div class="form-group"><form id="transForm">
  <input name="description" placeholder="Description" required style="width:200px;">
  <input name="amount" type="number" step="0.01" placeholder="Amount" required style="width:120px;">
  <select name="type"><option>expense</option><option>income</option></select>
  <button type="submit">Add Transaction</button>
</form></div>
<table><tr><th>Description</th><th>Amount</th><th>Type</th></tr>
{% for t in transactions %}
<tr><td>{{ t.description }}</td><td class="{{ 'income' if t.type=='income' else 'expense' }}">${{ "%.2f"|format(t.amount) }}</td><td>{{ t.type.title() }}</td></tr>
{% endfor %}</table>
<script>
document.getElementById('transForm').onsubmit = async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.amount = parseFloat(data.amount);
  const res = await fetch('/add', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
  if (res.ok) location.reload();
  else alert('Error adding transaction');
};
</script></body></html>"""


@app.route("/")
def dashboard():
    """List recent transactions and show balance (from DB)."""
    transactions = (
        Transaction.query
        .order_by(Transaction.id.desc())
        .limit(20)
        .all()
    )
    # Balance = sum(income) - sum(expense)
    from sqlalchemy import func
    income_total = db.session.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == "income"
    ).scalar() or 0
    expense_total = db.session.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == "expense"
    ).scalar() or 0
    total = float(income_total) - float(expense_total)
    # Pass model objects; template uses t.description, t.amount, t.type
    return render_template_string(DASHBOARD_HTML, transactions=transactions, total=total)


@app.route("/add", methods=["POST"])
def add_transaction():
    """Create a new transaction and link to default accounts (CRUD create)."""
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

    cash = Account.query.filter_by(name="Cash", type="asset").first()
    income = Account.query.filter_by(name="Income", type="income").first()
    expenses = Account.query.filter_by(name="Expenses", type="expense").first()
    if not all([cash, income, expenses]):
        return jsonify({"success": False, "error": "Default accounts missing"}), 500

    if txn_type == "income":
        debit_account_id = cash.id
        credit_account_id = income.id
    else:
        debit_account_id = expenses.id
        credit_account_id = cash.id

    txn = Transaction(
        description=description,
        amount=amount,
        type=txn_type,
        debit_account_id=debit_account_id,
        credit_account_id=credit_account_id,
    )
    db.session.add(txn)
    db.session.commit()
    return jsonify({"success": True})


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
# Entry point (dev and PyInstaller)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    Timer(1, lambda: webbrowser.open("http://127.0.0.1:5000/?welcome")).start()
    print("💰 Local Accounting: http://127.0.0.1:5000")
    print("   Data stored in:", os.path.join(basedir, "accounting.db"))
    print("   Press Ctrl+C to quit")
    app.run(debug=False, host="127.0.0.1", port=5000, threaded=True)
