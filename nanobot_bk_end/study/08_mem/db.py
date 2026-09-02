# init a sqlite db
import sqlite3

conn = sqlite3.connect('mem_db.db')
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
)
""")

conn.commit()
conn.close()
