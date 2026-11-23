import pytest

from onyx.configs.app_configs import parse_email_list


@pytest.mark.parametrize(
    "raw, expected",
    [
        (None, []),
        ("", []),
        ("   ", []),
        ("dean@school.org", ["dean@school.org"]),
        ("Dean@School.org", ["dean@school.org"]),
        (
            "a@school.org, B@school.org;c@school.org  d@school.org",
            ["a@school.org", "b@school.org", "c@school.org", "d@school.org"],
        ),
        (",,a@school.org,", ["a@school.org"]),
    ],
)
def test_parse_email_list(raw: str | None, expected: list[str]) -> None:
    assert parse_email_list(raw) == expected
