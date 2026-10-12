"""Custom exception handler that normalises all errors to the contract shape:

    {"error": {"code": "...", "message": "...", "details": []}}
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class APIError(Exception):
    """Raise this to return a structured error response."""

    def __init__(self, code: str, message: str, http_status: int = 400, details: list = None):
        self.code = code
        self.message = message
        self.http_status = http_status
        self.details = details or []
        super().__init__(message)


def error_response(code: str, message: str, http_status: int = 400, details: list = None):
    """Return a DRF Response with the contract error shape."""
    return Response(
        {"error": {"code": code, "message": message, "details": details or []}},
        status=http_status,
    )


def custom_exception_handler(exc, context):
    """Map framework exceptions and our APIError to the contract shape."""
    if isinstance(exc, APIError):
        return error_response(exc.code, exc.message, exc.http_status, exc.details)

    response = exception_handler(exc, context)
    if response is None:
        return None

    # Wrap DRF's default response in the contract error envelope
    data = response.data
    if isinstance(data, dict) and "error" in data:
        return response  # already wrapped

    # Build a readable message from DRF validation errors
    if isinstance(data, dict):
        msgs = []
        for field, errs in data.items():
            if isinstance(errs, list):
                msgs.append(f"{field}: {'; '.join(str(e) for e in errs)}")
            else:
                msgs.append(str(errs))
        message = " | ".join(msgs) if msgs else str(data)
    elif isinstance(data, list):
        message = "; ".join(str(d) for d in data)
    else:
        message = str(data)

    code = "VALIDATION_ERROR" if response.status_code == 400 else "NOT_FOUND"
    response.data = {"error": {"code": code, "message": message, "details": []}}
    return response
