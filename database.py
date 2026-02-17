"""
Flask-SQLAlchemy instance. Initialized with app in app.py.
Models import db from here to avoid circular imports.
"""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
