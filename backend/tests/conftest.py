"""Root conftest — shared fixtures available to all test directories."""

import os

# LiteLLM downloads its model cost map at import time unless this is set, so
# capability and pricing assertions would otherwise depend on upstream data
# that changes without notice. Pin the bundled copy to keep tests hermetic.
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")
