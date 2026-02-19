from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import require_role
from app.modules.auth.models import User
from app.modules.financial import schemas, services

router = APIRouter(prefix="/financial", tags=["Financeiro"])


@router.get("/dashboard", response_model=schemas.FinancialDashboard)
async def financial_dashboard(
    month: int = Query(default=None),
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    today = date.today()
    m = month or today.month
    y = year or today.year
    return await services.get_financial_dashboard(db, m, y)


@router.patch("/monthly/{month}/{year}", response_model=schemas.MonthlyFinancialsResponse)
async def update_monthly_financials(
    month: int,
    year: int,
    data: schemas.MonthlyFinancialsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await services.upsert_monthly_financials(db, month, year, data)


@router.get("/extras", response_model=list[schemas.ExtraExpenseResponse])
async def get_extra_expenses(
    month: int = Query(...),
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await services.get_extra_expenses(db, month, year)


@router.post("/extras", response_model=schemas.ExtraExpenseResponse)
async def create_extra_expense(
    data: schemas.ExtraExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await services.create_extra_expense(db, data, current_user.id)


@router.patch("/extras/{expense_id}", response_model=schemas.ExtraExpenseResponse)
async def update_extra_expense(
    expense_id: int,
    data: schemas.ExtraExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await services.update_extra_expense(db, expense_id, data)


@router.delete("/extras/{expense_id}", status_code=204)
async def delete_extra_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    await services.delete_extra_expense(db, expense_id)


@router.get("/clients/{client_id}", response_model=schemas.ClientCostSummary)
async def client_costs(
    client_id: int,
    month: int = Query(default=None),
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    today = date.today()
    m = month or today.month
    y = year or today.year
    return await services.get_client_costs(db, client_id, m, y)
