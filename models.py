"""
SQLAlchemy models for the accounting system.
All accounting data is stored persistently in SQLite via these models.
"""
from datetime import datetime
from database import db


class Account(db.Model):
    """Chart of accounts: Cash, Income, Expenses, etc."""
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    type = db.Column(db.String(32), nullable=False)  # asset, income, expense, liability, equity
    description = db.Column(db.String(256), default="")
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
    debit_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    credit_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Transaction {self.description} {self.amount} {self.type}>"
