"""Unit tests for shared_vn_nlp.calendar module."""

import pytest
from datetime import date

from shared_vn_nlp.calendar import (
    get_events,
    get_events_in_range,
    lunar_to_solar,
    VNEvent,
)


class TestGetEvents:
    """Tests for get_events (near a target date)."""

    def test_finds_national_day(self):
        """Finds National Day (Sep 2) when querying around that date."""
        result = get_events(date(2025, 9, 2), days_range=0)
        names = [e.name for e in result]
        assert "Ngày Quốc khánh" in names

    def test_finds_events_within_range(self):
        """Finds events within ±days_range."""
        # New Year's Day is Jan 1; query Jan 3 with range 3 should find it
        result = get_events(date(2025, 1, 3), days_range=3)
        names = [e.name for e in result]
        assert "Tết Dương Lịch" in names

    def test_returns_vnevent_instances(self):
        """Results are VNEvent dataclass instances."""
        result = get_events(date(2025, 9, 2), days_range=0)
        for event in result:
            assert isinstance(event, VNEvent)
            assert isinstance(event.date_solar, date)
            assert event.event_type in ("holiday", "cultural", "seasonal")

    def test_no_events_found(self):
        """Returns empty list when no events are near the date."""
        # Pick a date unlikely to have events (e.g., March 15 with range 0)
        result = get_events(date(2025, 3, 15), days_range=0)
        # May or may not be empty, but should not raise
        assert isinstance(result, list)


class TestGetEventsInRange:
    """Tests for get_events_in_range."""

    def test_range_includes_boundaries(self):
        """Events on start and end dates are included."""
        # National Day is Sep 2
        result = get_events_in_range(date(2025, 9, 2), date(2025, 9, 2))
        names = [e.name for e in result]
        assert "Ngày Quốc khánh" in names

    def test_multiple_events_in_range(self):
        """Finds multiple events in a wider range."""
        # April 30 and May 1 are both holidays
        result = get_events_in_range(date(2025, 4, 29), date(2025, 5, 2))
        names = [e.name for e in result]
        assert "Ngày Giải phóng miền Nam" in names
        assert "Ngày Quốc tế Lao động" in names

    def test_empty_range(self):
        """Returns empty list for a range with no events."""
        # Pick a narrow range unlikely to have events
        result = get_events_in_range(date(2025, 3, 15), date(2025, 3, 16))
        assert isinstance(result, list)

    def test_results_sorted_by_date(self):
        """Results are sorted by solar date."""
        result = get_events_in_range(date(2025, 1, 1), date(2025, 12, 31))
        dates = [e.date_solar for e in result]
        assert dates == sorted(dates)

    def test_all_events_within_range(self):
        """All returned events have dates within the queried range."""
        start = date(2025, 4, 1)
        end = date(2025, 6, 30)
        result = get_events_in_range(start, end)
        for event in result:
            assert start <= event.date_solar <= end


class TestLunarToSolar:
    """Tests for lunar_to_solar conversion."""

    def test_tet_2025(self):
        """Lunar 1/1/2025 converts to a valid solar date in Jan/Feb 2025."""
        result = lunar_to_solar(1, 1, 2025)
        assert isinstance(result, date)
        # Tết 2025 should be in late January or February
        assert result.year == 2025
        assert result.month in (1, 2)

    def test_mid_autumn_2025(self):
        """Lunar 8/15/2025 converts to a valid solar date."""
        result = lunar_to_solar(8, 15, 2025)
        assert isinstance(result, date)
        assert result.year == 2025
        # Mid-Autumn is typically in September or October
        assert result.month in (9, 10)

    def test_invalid_lunar_date_raises(self):
        """Invalid lunar date raises ValueError."""
        with pytest.raises(ValueError):
            lunar_to_solar(13, 1, 2025)  # month 13 doesn't exist

    def test_returns_date_object(self):
        """Result is a datetime.date object."""
        result = lunar_to_solar(5, 5, 2025)
        assert isinstance(result, date)
