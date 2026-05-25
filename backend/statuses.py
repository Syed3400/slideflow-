from enum import Enum


class PresentationStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PARSED = "PARSED"
    ERROR = "ERROR"
