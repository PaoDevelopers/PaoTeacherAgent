from onyx.feature_flags.interface import FeatureFlagProvider, NoOpFeatureFlagProvider


def get_default_feature_flag_provider() -> FeatureFlagProvider:
    """The feature flag provider. Always the no-op provider, so every flag is off."""
    return NoOpFeatureFlagProvider()
