"""
DRF Serializers for all contract resources.
"""
import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from rest_framework import serializers

from .models import Dealer, Order, OrderItem, Product

MONEY_RE = re.compile(r"^\d+(\.\d{1,2})?$")


class MoneyField(serializers.DecimalField):
    """Serialiser field that outputs money as a 2-decimal string."""

    def __init__(self, **kwargs):
        kwargs.setdefault("max_digits", 14)
        kwargs.setdefault("decimal_places", 2)
        kwargs.setdefault("coerce_to_string", True)
        super().__init__(**kwargs)

    def to_representation(self, value):
        value = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return str(value)


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------


class ProductSerializer(serializers.ModelSerializer):
    price = MoneyField()

    class Meta:
        model = Product
        fields = [
            "sku",
            "name",
            "category",
            "brand",
            "vehicle_fitment",
            "price",
            "stock",
            "description",
        ]
        read_only_fields = ["stock"]
        extra_kwargs = {
            "sku": {"validators": []},
        }

    def validate_price(self, value):
        """Price must be positive with at most 2 decimal places."""
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        # Check decimal places
        quantized = value.quantize(Decimal("0.01"))
        if quantized != value:
            raise serializers.ValidationError(
                "Price must have at most 2 decimal places."
            )
        return value

    def validate_sku(self, value):
        if self.instance and self.instance.sku != value:
            raise serializers.ValidationError("SKU cannot be changed.")
        return value


class ProductCreateSerializer(ProductSerializer):
    """Validates and creates a new product. SKU uniqueness checked in the view."""

    class Meta(ProductSerializer.Meta):
        # stock is not accepted on create
        read_only_fields = ["stock"]


# ---------------------------------------------------------------------------
# Dealer
# ---------------------------------------------------------------------------


class DealerSerializer(serializers.ModelSerializer):
    credit_limit = MoneyField(required=False, default=Decimal("0.00"))

    class Meta:
        model = Dealer
        fields = [
            "id",
            "dealer_code",
            "name",
            "city",
            "phone",
            "email",
            "gstin",
            "credit_limit",
        ]
        extra_kwargs = {
            "dealer_code": {"validators": []},
            "city": {"required": False, "allow_blank": True},
            "phone": {"required": False, "allow_blank": True},
            "email": {"required": False, "allow_blank": True},
            "gstin": {"required": False, "allow_blank": True},
        }


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------


class OrderItemSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(source="product.sku", read_only=True)
    name = serializers.CharField(source="product.name", read_only=True)
    unit_price = MoneyField(read_only=True)
    line_subtotal = MoneyField(read_only=True)
    line_tax = MoneyField(read_only=True)
    line_total = MoneyField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ["sku", "name", "quantity", "unit_price", "line_subtotal", "line_tax", "line_total"]


class OrderSerializer(serializers.ModelSerializer):
    dealer_id = serializers.IntegerField(source="dealer.id", read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    subtotal = MoneyField(read_only=True)
    tax_total = MoneyField(read_only=True)
    grand_total = MoneyField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Order
        fields = [
            "order_number",
            "dealer_id",
            "status",
            "items",
            "subtotal",
            "tax_total",
            "grand_total",
            "created_at",
            "updated_at",
        ]
