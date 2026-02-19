from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user, require_role, decode_token
from app.modules.auth import schemas, services
from app.modules.auth.models import User, ModulePermission

router = APIRouter(prefix="/auth", tags=["Autenticação"])


@router.post("/login", response_model=schemas.TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = await services.authenticate_user(db, form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )
    return services.generate_tokens(user)


@router.post("/refresh", response_model=schemas.TokenResponse)
async def refresh_token(data: schemas.RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token inválido")
    user = await services.get_user_by_id(db, int(payload["sub"]))
    return services.generate_tokens(user)


@router.post("/register", response_model=schemas.TokenResponse)
async def register(data: schemas.RegisterRequest, db: AsyncSession = Depends(get_db)):
    user_data = schemas.UserCreate(
        email=data.email,
        name=data.name,
        password=data.password,
    )
    user = await services.create_user(db, user_data)
    return services.generate_tokens(user)


@router.get("/me", response_model=schemas.UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/users", response_model=schemas.UserResponse)
async def create_user(
    data: schemas.UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await services.create_user(db, data)


@router.get("/users", response_model=list[schemas.UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.get_all_users(db)


@router.get("/users/{user_id}", response_model=schemas.UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.get_user_by_id(db, user_id)


@router.patch("/users/{user_id}", response_model=schemas.UserResponse)
async def update_user(
    user_id: int,
    data: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await services.update_user(db, user_id, data)


# === Module Permissions ===

class PermissionUpdate(BaseModel):
    can_read: bool
    can_write: bool


@router.get("/permissions")
async def get_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return full permissions matrix: {role: {module: {can_read, can_write}}}."""
    result = await db.execute(select(ModulePermission))
    perms = result.scalars().all()
    matrix: dict = {}
    for p in perms:
        role_key = p.role.value if hasattr(p.role, "value") else p.role
        if role_key not in matrix:
            matrix[role_key] = {}
        matrix[role_key][p.module] = {"can_read": p.can_read, "can_write": p.can_write}
    return matrix


@router.put("/permissions/{role}/{module}")
async def update_permission(
    role: str,
    module: str,
    data: PermissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Update read/write permission for a specific role+module (admin only)."""
    result = await db.execute(
        select(ModulePermission).where(
            ModulePermission.role == role,
            ModulePermission.module == module,
        )
    )
    perm = result.scalar_one_or_none()
    if not perm:
        perm = ModulePermission(
            role=role, module=module,
            can_read=data.can_read, can_write=data.can_write,
        )
        db.add(perm)
    else:
        perm.can_read = data.can_read
        perm.can_write = data.can_write
    await db.commit()
    return {"role": role, "module": module, "can_read": perm.can_read, "can_write": perm.can_write}
