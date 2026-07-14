from sqlite3 import Connection

from fastapi import APIRouter, Depends

from grain.analysis.machine import distributions, effect_steps, matrix_cells
from grain.analysis.pareto import frontier
from grain.analysis.rounds import round_curve
from grain.api.deps import get_conn

router = APIRouter(prefix="/api/analysis")


@router.get("/machine")
def machine(conn: Connection = Depends(get_conn)) -> dict:
    cells = matrix_cells(conn)
    return {
        "cells": len(cells),
        "distributions": distributions(conn, cells),
        "steps": effect_steps(conn, cells),
    }


@router.get("/pareto")
def pareto(conn: Connection = Depends(get_conn)) -> dict:
    return frontier(conn, matrix_cells(conn))


@router.get("/rounds")
def rounds(conn: Connection = Depends(get_conn)) -> dict:
    return {"curves": round_curve(conn, matrix_cells(conn))}
