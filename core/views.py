"""
API views for VIKMO DealerDesk.

All business rules live in services.py. Views handle HTTP plumbing only.
"""
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError
from django.db.models import Q
from django.http import JsonResponse
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import APIError, error_response
from .models import Dealer, Order, OrderItem, Product
from .pagination import StandardPagination
from .serializers import DealerSerializer, OrderSerializer, ProductSerializer
from .services import create_draft_order


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def health(request):
    """GET /api/health/ — the grader polls this until your app is ready."""
    return JsonResponse({"status": "ok"})


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------


class ProductListCreateView(APIView):
    """GET /api/products/ and POST /api/products/"""

    def get(self, request):
        qs = Product.objects.all()
        search = request.query_params.get("search")
        category = request.query_params.get("category")
        vehicle = request.query_params.get("vehicle")

        if search:
            qs = qs.filter(
                Q(sku__icontains=search)
                | Q(name__icontains=search)
                | Q(brand__icontains=search)
            )
        if category:
            qs = qs.filter(category=category)
        if vehicle:
            qs = qs.filter(vehicle_fitment__icontains=vehicle)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ProductSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        sku = request.data.get("sku")
        if sku and Product.objects.filter(sku=sku).exists():
            return error_response("DUPLICATE", f"SKU '{sku}' already exists.", 409)

        serializer = ProductSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                " | ".join(
                    f"{f}: {'; '.join(str(e) for e in errs)}"
                    for f, errs in serializer.errors.items()
                ),
                400,
            )

        product = serializer.save(stock=0)
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class ProductDetailView(APIView):
    """GET /api/products/{sku}/ and PATCH /api/products/{sku}/"""

    def _get_product(self, sku):
        try:
            return Product.objects.get(sku=sku)
        except Product.DoesNotExist:
            return None

    def get(self, request, sku):
        product = self._get_product(sku)
        if not product:
            return error_response("NOT_FOUND", f"Product '{sku}' not found.", 404)
        return Response(ProductSerializer(product).data)

    def patch(self, request, sku):
        product = self._get_product(sku)
        if not product:
            return error_response("NOT_FOUND", f"Product '{sku}' not found.", 404)

        # SKU cannot change
        if "sku" in request.data and request.data["sku"] != sku:
            return error_response("VALIDATION_ERROR", "SKU cannot be changed.", 400)

        serializer = ProductSerializer(product, data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                " | ".join(
                    f"{f}: {'; '.join(str(e) for e in errs)}"
                    for f, errs in serializer.errors.items()
                ),
                400,
            )
        product = serializer.save()
        return Response(ProductSerializer(product).data)


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------


class InventoryUpdateView(APIView):
    """PUT /api/inventory/{sku}/"""

    def put(self, request, sku):
        try:
            product = Product.objects.get(sku=sku)
        except Product.DoesNotExist:
            return error_response("NOT_FOUND", f"Product '{sku}' not found.", 404)

        qty = request.data.get("quantity")

        # Reject booleans explicitly first
        if isinstance(qty, bool):
            return error_response("VALIDATION_ERROR", "quantity must be an integer >= 0.", 400)

        # Must be an integer
        if not isinstance(qty, int):
            return error_response("VALIDATION_ERROR", "quantity must be an integer >= 0.", 400)

        if qty < 0:
            return error_response("VALIDATION_ERROR", "quantity must be >= 0.", 400)

        product.stock = qty
        product.save()
        return Response({"sku": sku, "quantity": qty})


# ---------------------------------------------------------------------------
# Dealers
# ---------------------------------------------------------------------------


class DealerListCreateView(APIView):
    """GET /api/dealers/ and POST /api/dealers/"""

    def get(self, request):
        qs = Dealer.objects.all()
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = DealerSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        dealer_code = request.data.get("dealer_code")
        if dealer_code and Dealer.objects.filter(dealer_code=dealer_code).exists():
            return error_response(
                "DUPLICATE", f"Dealer code '{dealer_code}' already exists.", 409
            )

        serializer = DealerSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                " | ".join(
                    f"{f}: {'; '.join(str(e) for e in errs)}"
                    for f, errs in serializer.errors.items()
                ),
                400,
            )
        dealer = serializer.save()
        return Response(DealerSerializer(dealer).data, status=status.HTTP_201_CREATED)


class DealerDetailView(APIView):
    """GET /api/dealers/{id}/"""

    def get(self, request, pk):
        try:
            dealer = Dealer.objects.get(pk=pk)
        except Dealer.DoesNotExist:
            return error_response("NOT_FOUND", f"Dealer {pk} not found.", 404)
        return Response(DealerSerializer(dealer).data)


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------


class OrderListCreateView(APIView):
    """POST /api/orders/ and GET /api/orders/"""

    def post(self, request):
        dealer_id = request.data.get("dealer_id")
        items = request.data.get("items")

        if dealer_id is None:
            return error_response("VALIDATION_ERROR", "'dealer_id' is required.", 400)
        if not isinstance(dealer_id, int) or isinstance(dealer_id, bool):
            return error_response("VALIDATION_ERROR", "'dealer_id' must be an integer.", 400)
        if items is None:
            return error_response("VALIDATION_ERROR", "'items' is required.", 400)
        if not isinstance(items, list):
            return error_response("VALIDATION_ERROR", "'items' must be a list.", 400)

        try:
            order = create_draft_order(dealer_id, items)
        except APIError as e:
            return error_response(e.code, e.message, e.http_status, e.details)

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    def get(self, request):
        qs = Order.objects.prefetch_related("items__product").select_related("dealer")
        dealer_id = request.query_params.get("dealer_id")
        status_filter = request.query_params.get("status")

        if dealer_id:
            qs = qs.filter(dealer_id=dealer_id)
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = OrderSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class OrderDetailView(APIView):
    """GET /api/orders/{order_number}/"""

    def get(self, request, order_number):
        try:
            order = Order.objects.prefetch_related("items__product").get(
                order_number=order_number
            )
        except Order.DoesNotExist:
            return error_response("NOT_FOUND", f"Order '{order_number}' not found.", 404)
        return Response(OrderSerializer(order).data)


# ---------------------------------------------------------------------------
# Forecast & Reorder (delegated to ml_views)
# ---------------------------------------------------------------------------
# Imported in urls.py from core.ml_views to keep this file focused.
