from unittest.mock import patch

import pytest

from onyx.utils.encryption import decrypt_bytes_to_string, encrypt_string_to_bytes

KEY = "pao-teacher-agent-test-key-0123456789"
# Written by the Enterprise Edition encryption this deployment used before.
STORED = bytes.fromhex(
    "f098ad975cbc4c9b143d996998a719f68e69803ec5f5da25f91ead7e4ff5c8e9"
    "c4ce36c30f6130ea0f51ab0b4192d0dd"
)


def test_decrypts_previously_stored_secret() -> None:
    assert decrypt_bytes_to_string(STORED, key=KEY) == "sk-deepseek-test"


def test_round_trip_is_encrypted() -> None:
    encrypted = encrypt_string_to_bytes("hello", key=KEY)
    assert b"hello" not in encrypted
    assert decrypt_bytes_to_string(encrypted, key=KEY) == "hello"


def test_wrong_explicit_key_raises() -> None:
    with pytest.raises(ValueError):
        decrypt_bytes_to_string(STORED, key="another-key-0123456789")


def test_plaintext_written_without_a_key_still_reads() -> None:
    with patch("onyx.utils.encryption.ENCRYPTION_KEY_SECRET", KEY):
        assert decrypt_bytes_to_string(b"legacy plaintext") == "legacy plaintext"
