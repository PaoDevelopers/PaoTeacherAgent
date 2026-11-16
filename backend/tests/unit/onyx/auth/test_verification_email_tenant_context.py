"""Unit tests for tenant binding in UserManager.on_after_request_verify.

The hook serves an unauthenticated request, so it names the workspace itself.
Everything it touches (the user count, the branding the email body is built
from, the audit event) is per-tenant, and the binding is undone even when the
send fails.
"""

TENANT_ID = "tenant_0d1c9d5e"
