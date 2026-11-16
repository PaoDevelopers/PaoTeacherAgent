from onyx.server.settings import tier_order
from onyx.server.settings.models import Tier


def test_current_tier_is_community() -> None:
    assert tier_order.get_current_tier() is Tier.COMMUNITY
