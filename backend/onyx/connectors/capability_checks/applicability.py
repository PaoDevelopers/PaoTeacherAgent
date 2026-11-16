"""Which capabilities exist per source on this build.

Kept apart from the check registry, on both the OSS and EE sides, so
applicability resolution never imports a per-connector check module: the
blocking-validation recorder resolves applicability on hot paths, and a check
module's import failure or weight must not reach it.
"""

from onyx.configs.constants import DocumentSource
from onyx.connectors.capabilities import CredentialCapability


def get_applicable_capabilities(source: DocumentSource) -> set[CredentialCapability]:  # noqa: ARG001
    """Returns the capabilities that exist for this source on this build.

    Capabilities outside this set aggregate to a NOT_APPLICABLE verdict. On OSS
    builds only INDEXING applies, which is correct since perm sync does not
    exist there.
    """
    return {CredentialCapability.INDEXING}
