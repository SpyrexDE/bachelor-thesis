from collections.abc import Iterator
from sqlite3 import Connection

from fastapi import Request

from grain.store.db import connect


def get_conn(request: Request) -> Iterator[Connection]:
    conn = connect(request.app.state.settings.data_dir)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
