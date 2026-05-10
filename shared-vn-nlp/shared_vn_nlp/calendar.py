"""Vietnamese calendar events and lunar date conversion.

Provides access to Vietnamese cultural events, holidays, and seasonal dates.
Supports both solar and lunar calendar events with date range queries.
"""

import json
from datetime import date, timedelta
from pathlib import Path
from typing import List
from dataclasses import dataclass

from lunardate import LunarDate

_DATA_DIR = Path(__file__).parent / "data"
_events_data: List[dict] | None = None


@dataclass
class VNEvent:
    """A Vietnamese cultural event or holiday."""

    name: str
    date_solar: date
    date_lunar: str | None  # e.g., "1/1" (lunar month/day)
    event_type: str         # "holiday", "cultural", "seasonal"
    description: str


def _load_events() -> List[dict]:
    """Load events data from JSON file."""
    global _events_data
    if _events_data is not None:
        return _events_data

    events_path = _DATA_DIR / "vn_events.json"
    with open(events_path, "r", encoding="utf-8") as f:
        _events_data = json.load(f)
    return _events_data


def lunar_to_solar(lunar_month: int, lunar_day: int, year: int) -> date:
    """Convert a lunar date to solar date for a given year.

    Args:
        lunar_month: Lunar month (1-12).
        lunar_day: Lunar day (1-30).
        year: Solar year for conversion context.

    Returns:
        Corresponding solar date.

    Raises:
        ValueError: If the lunar date is invalid for the given year.
    """
    try:
        lunar = LunarDate(year, lunar_month, lunar_day)
        return lunar.toSolarDate()
    except Exception as e:
        raise ValueError(
            f"Invalid lunar date: month={lunar_month}, day={lunar_day}, year={year}. {e}"
        )


def _resolve_event_date(event: dict, year: int) -> date | None:
    """Resolve an event's solar date for a given year."""
    if "solar_date" in event:
        # Format: "MM-DD"
        parts = event["solar_date"].split("-")
        month = int(parts[0])
        day = int(parts[1])
        try:
            return date(year, month, day)
        except ValueError:
            return None
    elif "lunar_date" in event:
        # Format: "month/day"
        parts = event["lunar_date"].split("/")
        lunar_month = int(parts[0])
        lunar_day = int(parts[1])
        try:
            return lunar_to_solar(lunar_month, lunar_day, year)
        except ValueError:
            return None
    return None


def _event_to_vnevent(event: dict, solar_date: date) -> VNEvent:
    """Convert raw event dict to VNEvent dataclass."""
    return VNEvent(
        name=event["name"],
        date_solar=solar_date,
        date_lunar=event.get("lunar_date"),
        event_type=event["type"],
        description=event["description"],
    )


def get_events(target_date: date, days_range: int = 3) -> List[VNEvent]:
    """Get Vietnamese events on or near a target date.

    Args:
        target_date: The date to search around.
        days_range: Number of days before and after to include (default ±3).

    Returns:
        List of VNEvent objects within the date range.
    """
    start = target_date - timedelta(days=days_range)
    end = target_date + timedelta(days=days_range)
    return get_events_in_range(start, end)


def get_events_in_range(start: date, end: date) -> List[VNEvent]:
    """Get all Vietnamese events within a date range (inclusive).

    Args:
        start: Start date (inclusive).
        end: End date (inclusive).

    Returns:
        List of VNEvent objects whose solar dates fall within [start, end].
    """
    events_data = _load_events()
    results = []

    # Check events for each year in the range
    years = set()
    years.add(start.year)
    years.add(end.year)

    for year in sorted(years):
        for event in events_data:
            solar_date = _resolve_event_date(event, year)
            if solar_date and start <= solar_date <= end:
                results.append(_event_to_vnevent(event, solar_date))

    # Sort by date
    results.sort(key=lambda e: e.date_solar)
    return results
