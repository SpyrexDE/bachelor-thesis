from enum import StrEnum


class Topology(StrEnum):
    MONOLITHIC = "monolithic"
    INDEPENDENT = "independent"
    COARSE = "coarse"
    FINE = "fine"


# The three adjacent comparison steps the RQ is split into: concept/01, Topologies.
STEPS: tuple[tuple[Topology, Topology], ...] = (
    (Topology.MONOLITHIC, Topology.INDEPENDENT),
    (Topology.INDEPENDENT, Topology.COARSE),
    (Topology.COARSE, Topology.FINE),
)
