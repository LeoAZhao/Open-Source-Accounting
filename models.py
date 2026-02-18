"""
SQLAlchemy models for the accounting system.
All accounting data is stored persistently in SQLite via these models.
"""
from datetime import datetime
from database import db


class TaxRate(db.Model):
    """Tax rates: HST, GST, PST, etc."""
    __tablename__ = "tax_rates"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    rate = db.Column(db.Float, default=0.0)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Account(db.Model):
    """Chart of accounts: Cash, Income, Expenses, etc."""
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    type = db.Column(db.String(32), nullable=False)  # asset, income, expense, liability, equity
    description = db.Column(db.String(256), default="")
    code = db.Column(db.String(32), default="")
    parent_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    debit_transactions = db.relationship(
        "Transaction",
        foreign_keys="Transaction.debit_account_id",
        backref="debit_account",
        lazy="dynamic",
    )
    credit_transactions = db.relationship(
        "Transaction",
        foreign_keys="Transaction.credit_account_id",
        backref="credit_account",
        lazy="dynamic",
    )

    def __repr__(self):
        return f"<Account {self.name} ({self.type})>"


class Transaction(db.Model):
    """Double-entry transactions: each row has debit and credit account."""
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    description = db.Column(db.String(256), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    # For simple UI we keep type (income/expense) so templates work unchanged
    type = db.Column(db.String(32), nullable=False)  # income, expense
    kind = db.Column(db.String(32), default="debit", nullable=True)  # debit/credit for line context
    debit_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    credit_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reference = db.Column(db.String(64), default="")
    tax_rate_id = db.Column(db.Integer, db.ForeignKey("tax_rates.id"), nullable=True)
    status = db.Column(db.String(32), default="posted")  # posted, void
    voided_at = db.Column(db.DateTime, nullable=True)
    voided_reason = db.Column(db.String(256), default="")

    def __repr__(self):
        return f"<Transaction {self.description} {self.amount} {self.type}>"


class JournalEntry(db.Model):
    """Multi-line journal entry header."""
    __tablename__ = "journal_entries"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    description = db.Column(db.String(256), nullable=False)
    reference = db.Column(db.String(64), default="")
    status = db.Column(db.String(32), default="posted")  # posted, void
    voided_at = db.Column(db.DateTime, nullable=True)
    voided_reason = db.Column(db.String(256), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    lines = db.relationship("JournalLine", backref="journal_entry", lazy="dynamic", cascade="all, delete-orphan")


class JournalLine(db.Model):
    """Single line in a journal entry."""
    __tablename__ = "journal_lines"

    id = db.Column(db.Integer, primary_key=True)
    journal_entry_id = db.Column(db.Integer, db.ForeignKey("journal_entries.id"), nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    debit = db.Column(db.Float, default=0.0)
    credit = db.Column(db.Float, default=0.0)
    memo = db.Column(db.String(256), default="")
    tax_rate_id = db.Column(db.Integer, db.ForeignKey("tax_rates.id"), nullable=True)
    tax_amount = db.Column(db.Float, default=0.0)
