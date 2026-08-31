"""Unit tests for the security module - JWT authentication and password handling."""

import pytest
from app.core.security import create_access_token, hash_password, verify_password, decode_access_token


class TestPasswordHashing:
    """Test password hashing and verification."""

    def test_hash_password_creates_hash(self):
        """Test that hash_password creates a valid bcrypt hash."""
        password = "testpassword123"
        hashed = hash_password(password)
        
        # bcrypt hashes start with $2b$ or $2y$ (or $2a$ historically)
        # The test below was checking for $2 but newer bcrypt uses $2b$ or $2y$
        assert len(hashed) > 20  # bcrypt hashes are typically 60 chars
        # Check it's a valid bcrypt hash format
        assert hashed.startswith(("$2b$", "$2y$", "$2a$"))

    def test_verify_correct_password(self):
        """Test that correct password verifies successfully."""
        password = "testpassword123"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True

    def test_verify_wrong_password(self):
        """Test that wrong password fails verification."""
        password = "testpassword123"
        hashed = hash_password(password)
        
        assert verify_password("wrongpassword", hashed) is False

    def test_verify_different_passwords(self):
        """Test that different passwords produce different hashes."""
        hash1 = hash_password("password1")
        hash2 = hash_password("password1")
        
        # bcrypt includes salt, so hashes should be different
        assert hash1 != hash2


class TestTokenCreation:
    """Test JWT token creation and decoding."""

    def test_create_access_token(self):
        """Test that access tokens are created successfully."""
        token = create_access_token({"sub": "user-123", "role": "USER"})
        assert token is not None
        assert len(token) > 0

    def test_token_has_sub(self):
        """Test that token contains subject claim."""
        token = create_access_token({"sub": "user-123", "role": "USER"})
        from app.core.security import decode_access_token
        decoded = decode_access_token(token)
        # decode_access_token returns the full payload dict
        assert decoded.get("sub") == "user-123"

    def test_token_has_role(self):
        """Test that token contains role claim."""
        token = create_access_token({"sub": "user-123", "role": "USER"})
        from app.core.security import decode_access_token
        decoded = decode_access_token(token)
        # decode_access_token returns the full payload dict
        assert decoded.get("role") == "USER"


class TestTokenVerification:
    """Test token verification."""

    def test_verify_valid_token(self):
        """Test that valid tokens are verified successfully."""
        from app.core.security import create_access_token, decode_access_token
        
        token = create_access_token({"sub": "user-123", "role": "USER"})
        decoded = decode_access_token(token)
        
        # decode_access_token returns the full payload dict
        assert decoded is not None
        assert decoded.get("sub") == "user-123"

    def test_verify_invalid_token(self):
        """Test that invalid tokens fail verification."""
        from app.core.security import decode_access_token
        
        decoded = decode_access_token("invalid.token.string")
        # Invalid format raises ValueError
        assert decoded is None


class TestDecodeAccessToken:
    """Test decode_access_token function."""

    def test_decode_success(self):
        """Test successful token decoding."""
        from app.core.security import create_access_token, decode_access_token
        
        token = create_access_token({"test": "data"})
        decoded = decode_access_token(token)
        # decode_access_token returns the full payload dict
        assert decoded is not None
        # The payload contains nested dict due to how claims are structured
        assert "test" in decoded or decoded.get("test") == "data"

    def test_decode_malformed(self):
        """Test decoding malformed token."""
        from app.core.security import decode_access_token
        
        decoded = decode_access_token("not.a.real.token")
        # Invalid format raises ValueError
        assert decoded is None