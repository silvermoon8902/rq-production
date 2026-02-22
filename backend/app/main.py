from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import get_settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.modules.auth.routes import router as auth_router
from app.modules.clients.routes import router as clients_router
from app.modules.team.routes import router as team_router
from app.modules.demands.routes import router as demands_router
from app.modules.financial.routes import router as financial_router
from app.shared.dashboard import router as dashboard_router
from app.modules.meetings.routes import router as meetings_router
from app.modules.design.routes import router as design_router

# Import all models so they're registered with Base
from app.modules.auth.models import User, ModulePermission  # noqa
from app.modules.clients.models import Client  # noqa
from app.modules.team.models import Squad, TeamMember, TeamAllocation, MemberSquad  # noqa
from app.modules.demands.models import Demand, KanbanColumn, DemandHistory, DemandComment  # noqa
from app.modules.meetings.models import ClientMeeting  # noqa
from app.modules.financial.models import MonthlyFinancials, ExtraExpense  # noqa
from app.modules.design.models import (  # noqa
    DesignColumn, DesignDemand, DesignAttachment, DesignComment as DesignCommentModel,
    DesignHistory, DesignPayment,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed defaults
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrate: add new columns to existing tables (safe - IF NOT EXISTS)
        migrations = [
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20)",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255)",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram VARCHAR(255)",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS website VARCHAR(500)",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS start_date DATE",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS end_date DATE",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_value NUMERIC(10,2)",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS min_contract_months INTEGER",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS operational_cost NUMERIC(10,2)",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS health_score FLOAT",
            # Enable financial read for non-admins (personal view)
            "UPDATE module_permissions SET can_read = true WHERE module = 'financial' AND role::text IN ('gerente', 'colaborador')",
            # Seed design module permissions if missing
            "INSERT INTO module_permissions (role, module, can_read, can_write) SELECT 'admin'::userrole, 'design', true, true WHERE NOT EXISTS (SELECT 1 FROM module_permissions WHERE role::text='admin' AND module='design')",
            "INSERT INTO module_permissions (role, module, can_read, can_write) SELECT 'gerente'::userrole, 'design', true, true WHERE NOT EXISTS (SELECT 1 FROM module_permissions WHERE role::text='gerente' AND module='design')",
            "INSERT INTO module_permissions (role, module, can_read, can_write) SELECT 'colaborador'::userrole, 'design', true, true WHERE NOT EXISTS (SELECT 1 FROM module_permissions WHERE role::text='colaborador' AND module='design')",
        ]
        for stmt in migrations:
            await conn.execute(text(stmt))

    # Seed default kanban columns
    from app.modules.demands.services import seed_default_columns
    from app.modules.design.services import seed_default_design_columns

    async with AsyncSessionLocal() as session:
        await seed_default_columns(session)

    async with AsyncSessionLocal() as session:
        await seed_default_design_columns(session)

    # Seed default admin user
    from app.modules.auth.models import User, UserRole, ModulePermission
    from app.core.security import get_password_hash
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.role == UserRole.ADMIN)
        )
        if not result.scalar_one_or_none():
            admin = User(
                email="digitalrqmarketing@gmail.com",
                name="Admin RQ",
                hashed_password=get_password_hash("Admin@2026"),
                role=UserRole.ADMIN,
            )
            session.add(admin)
            await session.commit()

    # Seed default module permissions (skip if already seeded)
    _DEFAULT_PERMISSIONS = [
        # (role,          module,      can_read, can_write)
        ("admin",        "dashboard",  True,  True),
        ("gerente",      "dashboard",  True,  False),
        ("colaborador",  "dashboard",  True,  False),
        ("admin",        "clients",    True,  True),
        ("gerente",      "clients",    True,  True),
        ("colaborador",  "clients",    True,  False),
        ("admin",        "team",       True,  True),
        ("gerente",      "team",       True,  False),
        ("colaborador",  "team",       True,  False),
        ("admin",        "demands",    True,  True),
        ("gerente",      "demands",    True,  True),
        ("colaborador",  "demands",    True,  True),
        ("admin",        "financial",  True,  True),
        ("gerente",      "financial",  False, False),
        ("colaborador",  "financial",  False, False),
        ("admin",        "daily",      True,  True),
        ("gerente",      "daily",      True,  True),
        ("colaborador",  "daily",      True,  True),
        ("admin",        "users",      True,  True),
        ("gerente",      "users",      False, False),
        ("colaborador",  "users",      False, False),
        ("admin",        "design",     True,  True),
        ("gerente",      "design",     True,  True),
        ("colaborador",  "design",     True,  True),
    ]
    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(ModulePermission))
        if not existing.scalars().first():
            for role, module, can_read, can_write in _DEFAULT_PERMISSIONS:
                session.add(ModulePermission(
                    role=role, module=module,
                    can_read=can_read, can_write=can_write,
                ))
            await session.commit()

    yield

    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="RQ. Performance — Gestão Operacional da Agência RQ",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
API_PREFIX = "/api/v1"
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(clients_router, prefix=API_PREFIX)
app.include_router(team_router, prefix=API_PREFIX)
app.include_router(demands_router, prefix=API_PREFIX)
app.include_router(financial_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(meetings_router, prefix=API_PREFIX)
app.include_router(design_router, prefix=API_PREFIX)


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
