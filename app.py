import os
import sys
import webbrowser
import sqlite3
from threading import Timer
from flask import Flask, render_template_string, request, jsonify

app = Flask(__name__)

# Bundle-aware path
def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# SQLite DB path (bundled)
DB_PATH = resource_path('accounting.db')

# Init DB
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS transactions 
                 (id INTEGER PRIMARY KEY, description TEXT, amount REAL, type TEXT)''')
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def dashboard():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT description, amount, type FROM transactions ORDER BY id DESC LIMIT 20')
    transactions = [{'description': row[0], 'amount': row[1], 'type': row[2]} for row in c.fetchall()]
    c.execute('SELECT SUM(CASE WHEN type="income" THEN amount ELSE 0 END) - SUM(CASE WHEN type="expense" THEN amount ELSE 0 END) FROM transactions')
    total = c.fetchone()[0] or 0
    conn.close()
    
    html = """
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
    return render_template_string(html, transactions=transactions, total=total)

@app.route('/add', methods=['POST'])
def add_transaction():
    data = request.json
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('INSERT INTO transactions (description, amount, type) VALUES (?, ?, ?)',
              (data['description'], data['amount'], data['type']))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/clear')
def clear_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('DELETE FROM transactions')
    conn.commit()
    conn.close()
    return redirect('/')

if __name__ == '__main__':
    Timer(1, lambda: webbrowser.open('http://127.0.0.1:5000/?welcome')).start()
    print("💰 Local Accounting Exe: http://127.0.0.1:5000")
    print("Press Ctrl+C to quit")
    app.run(debug=False, host='127.0.0.1', port=5000, threaded=True)
