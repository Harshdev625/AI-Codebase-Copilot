import os
import psycopg

conn_str = "postgresql://postgres:mypassword@localhost:5432/aicc"

def add_is_deleted_column():
    try:
        with psycopg.connect(conn_str) as conn:
            with conn.cursor() as cursor:
                cursor.execute("ALTER TABLE repositories ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;")
                conn.commit()
                print("Successfully added is_deleted column to repositories table.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    add_is_deleted_column()
