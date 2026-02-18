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
