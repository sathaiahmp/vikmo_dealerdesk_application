"""Standard pagination for list endpoints.

Page size default=20, max=100 per the API contract.
"""
from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
