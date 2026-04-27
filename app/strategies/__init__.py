from app.strategies.base_strategy import BaseStrategy
from app.strategies.moon_strategy import MoonStrategy
from app.strategies.satellite_strategy import SatelliteStrategy
from app.core.config import get_mission_config, MissionConfig


def get_strategy(mission_type: str) -> BaseStrategy:
    """
    Factory: resolves mission_type → MissionConfig → concrete Strategy.
    Single point of dispatch — no if-else scattered across the codebase.
    """
    config: MissionConfig = get_mission_config(mission_type)

    registry: dict[str, type[BaseStrategy]] = {
        "moon": MoonStrategy,
        "satellite": SatelliteStrategy,
    }

    strategy_cls = registry.get(mission_type.lower())
    if not strategy_cls:
        raise ValueError(f"No strategy registered for mission_type '{mission_type}'")

    return strategy_cls(config)


__all__ = [
    "BaseStrategy",
    "MoonStrategy",
    "SatelliteStrategy",
    "get_strategy",
]