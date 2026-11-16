"""
Unit tests for the user registration workflow in UserManager.create().

Tests cover:
1. Disposable email validation (before tenant provisioning)
2. Multi-tenant vs single-tenant invite logic
3. Empty whitelist vs populated whitelist scenarios
4. Case-insensitive email matching for existing user checks
"""

from collections.abc import Iterator
from types import SimpleNamespace, TracebackType
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi_users import exceptions

from onyx.auth.schemas import UserCreate
from onyx.auth.users import UserManager, _upgrade_placeholder_to_web_login__no_commit
from onyx.db.enums import AccountType
from onyx.error_handling.error_codes import OnyxErrorCode
from onyx.error_handling.exceptions import OnyxError

# Note: Only async test methods are marked with @pytest.mark.asyncio individually
# to avoid warnings on synchronous tests


@pytest.fixture
def mock_user_create() -> UserCreate:
    """Create a mock UserCreate object for testing."""
    return UserCreate(
        email="newuser@example.com",
        password="SecurePassword123!",
        is_verified=False,
    )


@pytest.fixture
def mock_async_session() -> MagicMock:
    """Create a mock async database session."""
    session = MagicMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.run_sync = AsyncMock(return_value=None)
    session.get = AsyncMock(return_value=None)
    return session


class _AsyncSessionContextManager:
    def __init__(self, session: MagicMock) -> None:
        self._session = session
        # oauth_callback awaits session.get on the placeholder upgrade path.
        if not isinstance(session.get, AsyncMock):
            session.get = AsyncMock(return_value=None)

    async def __aenter__(self) -> MagicMock:
        return self._session

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> bool:
        return False


@pytest.fixture(autouse=True)
def _no_pinned_persona_seeding() -> Iterator[None]:
    """Seeding needs a real session; these tests only cover registration logic."""
    with patch(
        "onyx.auth.users.seed_pinned_personas_from_featured", new_callable=AsyncMock
    ):
        yield


def _mock_user_manager_methods(user_manager: UserManager) -> None:
    user_manager.validate_password = AsyncMock()


def _bind_sqlalchemy_user_db_cls(
    mock_user_db_cls: MagicMock, mock_user_db: MagicMock
) -> None:
    # SQLAlchemyUserDatabase[User, uuid.UUID](...) hits __getitem__, then call.
    mock_user_db_cls.return_value = mock_user_db
    mock_user_db_cls.__getitem__.return_value = mock_user_db_cls


class TestDisposableEmailValidation:
    """Test disposable email validation before tenant provisioning."""


class TestMultiTenantInviteLogic:
    """Test invite logic for multi-tenant environments."""


class TestSingleTenantInviteLogic:
    """Test invite logic for single-tenant environments."""


class TestWhitelistBehavior:
    """Test invite whitelist scenarios."""

    @patch("onyx.auth.users.workspace_invite_only_enabled", return_value=False)
    @patch("onyx.auth.users.get_invited_users")
    def test_empty_whitelist_allows_all(
        self,
        mock_get_invited: MagicMock,
        _mock_invite_only: MagicMock,
    ) -> None:
        """Empty whitelist should allow all users."""
        from onyx.auth.users import verify_email_is_invited

        # Setup: Empty whitelist
        mock_get_invited.return_value = []

        # Execute - should not raise
        verify_email_is_invited("anyone@example.com")

    @patch("onyx.auth.users.workspace_invite_only_enabled", return_value=False)
    @patch("onyx.auth.users.get_invited_users")
    def test_invite_only_disabled_allows_non_invited_users(
        self,
        mock_get_invited: MagicMock,
        _mock_invite_only: MagicMock,
    ) -> None:
        from onyx.auth.users import verify_email_is_invited

        mock_get_invited.return_value = ["allowed@example.com"]

        verify_email_is_invited("notallowed@example.com")

    @patch("onyx.auth.users.workspace_invite_only_enabled", return_value=True)
    @patch("onyx.auth.users.get_invited_users")
    def test_whitelist_blocks_non_invited(
        self,
        mock_get_invited: MagicMock,
        _mock_invite_only: MagicMock,
    ) -> None:
        """Populated whitelist should block non-invited users."""
        from onyx.auth.users import verify_email_is_invited

        # Setup
        mock_get_invited.return_value = ["allowed@example.com"]

        # Execute & Assert
        with pytest.raises(OnyxError) as exc:
            verify_email_is_invited("notallowed@example.com")

        assert exc.value.status_code == 403

    @patch("onyx.auth.users.workspace_invite_only_enabled", return_value=True)
    @patch("onyx.auth.users.get_invited_users")
    def test_whitelist_allows_invited_case_insensitive(
        self,
        mock_get_invited: MagicMock,
        _mock_invite_only: MagicMock,
    ) -> None:
        """Whitelist should match emails case-insensitively."""
        from onyx.auth.users import verify_email_is_invited

        # Setup
        mock_get_invited.return_value = ["allowed@example.com"]

        # Execute - should not raise (case-insensitive match)
        verify_email_is_invited("ALLOWED@EXAMPLE.COM")
        verify_email_is_invited("Allowed@Example.Com")


class TestCaseInsensitiveEmailMatching:
    """Test case-insensitive email matching for existing user checks."""


class TestOAuthDottedGmail:
    """OAuth account creation must not apply the dotted-Gmail signup block.

    Regression guard for the redirect loop where a dotted-Gmail Google account
    could never be created (verify_email_domain(is_registration=True) rejected
    it on every first login), so the user never became "existing".
    """


class TestOAuthNoAutoLinkExemptions:
    """With auto-link off, a web-login row refuses a same-email login once it is
    spoken for: a linked IdP (a second provider must not attach), a rename (a moved
    address stops proving whose row it is), or deactivation. A row with none of
    those is claimed. Placeholders skip the checks and are promoted instead. A
    stale link under the same provider is rewritten, but only inside the
    admin-opened relink window for an IdP client change."""

    @staticmethod
    def _unclaimed(**attrs: object) -> MagicMock:
        """A row provisioned ahead of its owner: no IdP, original address, active.

        Every attribute the guard reads is set explicitly. A bare MagicMock
        attribute is truthy, which would silently invert the assertions here.
        """
        return MagicMock(
            **{  # ty: ignore[invalid-argument-type]
                "id": "user-id",
                "email": "provisioned@corp.com",
                "oauth_accounts": [],
                "prior_emails": [],
                "is_active": True,
                "account_type": AccountType.STANDARD,
                # Read by the offboarding tail of oauth_callback, not the guard.
                "oidc_expiry": None,
                **attrs,
            }
        )

    @staticmethod
    def _manager_with_existing(
        existing_user: MagicMock, mock_user_db_cls: MagicMock | None = None
    ) -> UserManager:
        user_manager = UserManager(MagicMock())
        _mock_user_manager_methods(user_manager)
        user_manager.on_after_register = AsyncMock()
        user_manager.get_by_oauth_account = AsyncMock(
            side_effect=exceptions.UserNotExists()
        )
        mock_user_db = MagicMock()
        mock_user_db.get_by_email = AsyncMock(return_value=existing_user)
        mock_user_db.get = AsyncMock(return_value=existing_user)
        mock_user_db.add_oauth_account = AsyncMock(return_value=existing_user)
        mock_user_db.update_oauth_account = AsyncMock(return_value=existing_user)
        mock_user_db.update = AsyncMock(return_value=existing_user)
        mock_user_db.session = MagicMock()
        user_manager.user_db = mock_user_db
        if mock_user_db_cls is not None:
            _bind_sqlalchemy_user_db_cls(mock_user_db_cls, mock_user_db)
        return user_manager


class TestPasswordAuthKillSwitch:
    """Password auth off refuses the public register route (``safe=True``) and
    password login, single-tenant only. SAML/JWT provisioning uses the default
    ``safe=False`` and OAuth bypasses create(), so SSO users are still created
    through their provider, and SSO login never reaches authenticate().
    """

    @pytest.mark.asyncio
    @patch("onyx.auth.users.get_security_settings")
    async def test_signup_disabled_blocks_public_registration(
        self,
        mock_get_settings: MagicMock,
        mock_user_create: UserCreate,
    ) -> None:
        mock_get_settings.return_value = SimpleNamespace(
            password_auth_enabled=False, valid_email_domains=()
        )
        user_manager = UserManager(MagicMock())

        with pytest.raises(OnyxError) as exc:
            await user_manager.create(mock_user_create, safe=True)

        assert exc.value.error_code is OnyxErrorCode.REGISTRATION_DISABLED
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    @patch("onyx.auth.users.is_disposable_email", return_value=False)
    @patch("onyx.auth.users.verify_email_domain")
    @patch("onyx.auth.users.get_security_settings")
    async def test_signup_disabled_allows_sso_provisioning(
        self,
        mock_get_settings: MagicMock,
        mock_verify_domain: MagicMock,
        mock_is_disposable: MagicMock,  # noqa: ARG002
        mock_user_create: UserCreate,
    ) -> None:
        """SSO-driven create() (safe=False) must NOT be blocked when signup is
        off, otherwise SAML/JWT can never onboard a new user."""
        mock_get_settings.return_value = SimpleNamespace(
            password_auth_enabled=False, valid_email_domains=()
        )
        user_manager = UserManager(MagicMock())
        _mock_user_manager_methods(user_manager)

        try:
            await user_manager.create(mock_user_create, safe=False)
        except OnyxError as e:
            assert e.error_code is not OnyxErrorCode.REGISTRATION_DISABLED
        except Exception:
            pass

        # The guard let it through into domain validation instead of blocking.
        mock_verify_domain.assert_called_once_with(
            mock_user_create.email,
            valid_email_domains=(),
            is_registration=True,
        )

    @pytest.mark.asyncio
    @patch("onyx.auth.users.is_disposable_email", return_value=False)
    @patch("onyx.auth.users.verify_email_domain")
    @patch("onyx.auth.users.get_security_settings")
    async def test_signup_enabled_passes_the_guard(
        self,
        mock_get_settings: MagicMock,
        mock_verify_domain: MagicMock,
        mock_is_disposable: MagicMock,  # noqa: ARG002
        mock_user_create: UserCreate,
    ) -> None:
        """With signup on, the public route proceeds past the guard."""
        mock_get_settings.return_value = SimpleNamespace(
            password_auth_enabled=True, valid_email_domains=()
        )
        user_manager = UserManager(MagicMock())
        _mock_user_manager_methods(user_manager)

        try:
            await user_manager.create(mock_user_create, safe=True)
        except Exception:
            pass

        mock_verify_domain.assert_called_once_with(
            mock_user_create.email,
            valid_email_domains=(),
            is_registration=True,
        )

    @pytest.mark.asyncio
    @patch("onyx.auth.users.MULTI_TENANT", True)
    @patch("onyx.auth.users.is_disposable_email", return_value=False)
    @patch("onyx.auth.users.verify_email_domain")
    @patch("onyx.auth.users.get_security_settings")
    async def test_multi_tenant_never_blocks_signup(
        self,
        mock_get_settings: MagicMock,
        mock_verify_domain: MagicMock,
        mock_is_disposable: MagicMock,  # noqa: ARG002
        mock_user_create: UserCreate,
    ) -> None:
        """Multi-tenant reads ambient settings here, so the gate must not fire
        even when the value says signup is off."""
        mock_get_settings.return_value = SimpleNamespace(
            password_auth_enabled=False, valid_email_domains=()
        )
        user_manager = UserManager(MagicMock())
        _mock_user_manager_methods(user_manager)

        try:
            await user_manager.create(mock_user_create, safe=True)
        except OnyxError as e:
            assert e.error_code is not OnyxErrorCode.REGISTRATION_DISABLED
        except Exception:
            pass

        mock_verify_domain.assert_called_once_with(
            mock_user_create.email,
            valid_email_domains=(),
            is_registration=True,
        )


class TestPlaceholderUpgradeRace:
    """The promote decision is made before the row lock, so it is re-checked."""

    @patch("onyx.auth.users.promote_placeholder_to_web_login__no_commit")
    @patch("onyx.auth.users.fetch_user_by_id", return_value=None)
    def test_missing_row_is_a_no_op(
        self,
        mock_fetch_user_by_id: MagicMock,  # noqa: ARG002
        mock_promote: MagicMock,
    ) -> None:
        _upgrade_placeholder_to_web_login__no_commit(uuid4(), True, MagicMock())
        mock_promote.assert_not_called()


class TestStandardUpgradeVerification:
    """Registering over a placeholder row runs the upgrade with the request body.
    On the public register path that body is untrusted, so it cannot self-verify."""

    @pytest.fixture
    def sync_user(self) -> Iterator[MagicMock]:
        """The placeholder row the upgrade rewrites. Seat accounting is stubbed
        off so enforce_seat_limit_locked stays out of these assertions."""
        user: MagicMock = MagicMock(
            is_active=True,
            is_verified=False,
            account_type=AccountType.EXT_PERM_USER,
        )
        sync_db: MagicMock = MagicMock()
        sync_db.query.return_value.filter.return_value.first.return_value = user
        with (
            patch("onyx.auth.users.assign_user_to_default_groups__no_commit"),
            patch("onyx.auth.users.get_session_with_current_tenant") as get_session,
        ):
            get_session.return_value.__enter__.return_value = sync_db
            yield user

    @pytest.mark.parametrize(
        ("safe", "expected_verified"),
        [
            pytest.param(True, False, id="public-register-ignores-client-verified"),
            pytest.param(False, True, id="trusted-caller-keeps-client-verified"),
        ],
    )
    def test_client_verification_honored_only_when_trusted(
        self, sync_user: MagicMock, safe: bool, expected_verified: bool
    ) -> None:
        user_manager: UserManager = UserManager(MagicMock())
        user_manager.password_helper = MagicMock()

        user_manager._upgrade_user_to_standard__sync(
            uuid4(),
            UserCreate(
                email="placeholder@corp.com",
                password="SecurePassword123!",
                is_verified=True,
            ),
            is_admin=False,
            safe=safe,
        )

        assert sync_user.is_verified is expected_verified
        assert sync_user.account_type == AccountType.STANDARD
