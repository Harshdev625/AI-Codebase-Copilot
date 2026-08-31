"""JWT authentication and authorization for the AI Codebase Copilot backend."""

import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from passlib.context import CryptContext
from jose import JWTError, jwt_decode

from app.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = settings.secret_key if hasattr(settings, "secret_key") else "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
ADMIN_ROLE = "ADMIN"
USER_ROLE = "USER"


class TokenData:
    """Data class to hold decoded token information."""
    
    def __init__(self, scopes: List[str] = None, sub: str = None):
        self.scopes = scopes or []
        self.sub = sub


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Authenticate a user with email and password.
    
    Args:
        email: User's email address
        password: User's plaintext password
        
    Returns:
        Dict with user info if authentication succeeds, None otherwise
    """
    from app.db.database import SessionLocal
    from app.db.models import User
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user and pwd_context.verify(password, user.password_hash):
            return {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
            }
        return None
    finally:
        db.close()


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Payload data to encode
        expires_delta: Optional timedelta for expiration
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Create a JWT refresh token.
    
    Args:
        data: Payload data to encode
        
    Returns:
        Encoded refresh JWT token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> Optional[TokenData]:
    """
    Verify a JWT token and return its payload.
    
    Args:
        token: JWT token string
        token_type: Expected token type ("access" or "refresh")
        
    Returns:
        TokenData if valid, None if invalid
    """
    try:
        payload = jwt_decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Check token type
        if payload.get("type") != token_type:
            return None
        
        # Check expiration
        exp = payload.get("exp")
        if exp is None or datetime.utcnow() > datetime.utcfromtimestamp(exp):
            return None
        
        scopes = payload.get("scopes", [])
        sub = payload.get("sub")
        
        return TokenData(scopes=scopes, sub=sub)
    except JWTError:
        return None


def get_password_hash(password: str) -> str:
    """Generate password hash using bcrypt."""
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(password, hashed)


def get_user_role(role: str) -> bool:
    """Check if role has admin privileges."""
    return role == ADMIN_ROLE


# Role-based access decorator helpers
def get_current_user_scopes(token: str) -> Optional[List[str]]:
    """Extract scopes from JWT token."""
    token_data = verify_token(token)
    if token_data is None:
        return None
    return token_data.scopes


def is_token_valid(token: str) -> bool:
    """Quick check if token is valid without full decoding."""
    return verify_token(token) is not None


# Predefined scope constants
SCOPE_READ = "read"
SCOPE_WRITE = "write"
SCOPE_ADMIN = "admin"
SCOPE_INDEX = "index"
SCOPE_SEARCH = "search"
SCOPE_DOCS = "docs"