from grain.providers.base import Provider
from grain.providers.mock import MockProvider


def get_provider(name: str) -> Provider:
    # Adding a real provider (Azure at Henkel) means one new module and one entry here.
    factories = {"mock": MockProvider}
    if name not in factories:
        raise ValueError(f"unknown provider '{name}', available: {sorted(factories)}")
    return factories[name]()
