import pytest

from onyx.configs.app_configs import parse_postgres_url


def test_full_url() -> None:
    assert parse_postgres_url("postgresql://onyx:p%40ss@db.example.com:6543/onyx") == {
        "POSTGRES_USER": "onyx",
        "POSTGRES_PASSWORD": "p@ss",
        "POSTGRES_HOST": "db.example.com",
        "POSTGRES_PORT": "6543",
        "POSTGRES_DB": "onyx",
    }


def test_missing_parts_are_left_out() -> None:
    assert parse_postgres_url("postgresql://relational_db") == {
        "POSTGRES_HOST": "relational_db"
    }
    assert parse_postgres_url("postgresql://") == {}


def test_wrong_scheme() -> None:
    with pytest.raises(ValueError):
        parse_postgres_url("mysql://root@localhost/db")
