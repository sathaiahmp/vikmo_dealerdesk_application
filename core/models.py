"""
Core data models for VIKMO DealerDesk.

Schema decisions documented in DECISIONS.md.
"""
import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Product(models.Model):
    """Spare-parts catalogue entry.

    Inventory is stored directly as `stock` (integer) rather than a separate
    Inventory model, because the contract describes a single quantity value per
    product with no warehouse splits. This keeps queries simple and avoids a
    one-to-one join on every product read.
    """

    sku = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    brand = models.CharField(max_length=100)
    vehicle_fitment = models.CharField(max_length=255, default="Universal")
    price = models.DecimalField(max_digits=12, decimal_places=2)
    stock = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sku"]

    def __str__(self):
        return f"{self.sku} — {self.name}"


class Dealer(models.Model):
    """Registered dealer (spare-parts buyer).

    dealer_code is the business identifier (e.g. DLR-007). The auto `id` is the
    PK used in API paths.
    """

    dealer_code = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=100, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    gstin = models.CharField(max_length=20, blank=True, default="")
    credit_limit = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00")
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["dealer_code"]

    def __str__(self):
        return f"{self.dealer_code} — {self.name}"


class Order(models.Model):
    """A dealer's purchase order.

    Statuses: DRAFT → CONFIRMED → DISPATCHED → DELIVERED (or CANCELLED).
    For the AI/ML track only DRAFT creation is mandatory; advanced status flow
    is optional.
    """

    STATUS_DRAFT = "DRAFT"
    STATUS_CONFIRMED = "CONFIRMED"
    STATUS_DISPATCHED = "DISPATCHED"
    STATUS_DELIVERED = "DELIVERED"
    STATUS_CANCELLED = "CANCELLED"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_DISPATCHED, "Dispatched"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    order_number = models.CharField(max_length=32, unique=True, db_index=True)
    dealer = models.ForeignKey(
        Dealer,
        on_delete=models.PROTECT,  # prevent accidental deletion of a dealer with orders
        related_name="orders",
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    # Money totals — computed at save time from line items
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order_number} [{self.status}]"


class OrderItem(models.Model):
    """One line of an Order.

    unit_price is stored at draft creation (current catalogue price). On
    confirm it becomes locked; price changes never affect confirmed lines.
    """

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,  # keep history even if product is later removed
        related_name="order_items",
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    line_tax = models.DecimalField(max_digits=14, decimal_places=2)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        unique_together = [("order", "product")]  # no duplicate SKU per order

    def __str__(self):
        return f"{self.order.order_number} / {self.product.sku} x{self.quantity}"


class AssistantSession(models.Model):
    """Conversation session for the dealer assistant.

    Each session_id carries isolated history. dealer is stored for
    authorisation validation on each request.
    """

    session_id = models.CharField(max_length=128, unique=True, db_index=True)
    dealer = models.ForeignKey(
        Dealer,
        on_delete=models.SET_NULL,  # losing a dealer shouldn't destroy history
        null=True,
        related_name="sessions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Session {self.session_id}"


class AssistantMessage(models.Model):
    """One persisted message in an assistant session.

    role: 'user', 'assistant', 'tool'
    content: JSON-serialisable text or structured payload.
    """

    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"
    ROLE_TOOL = "tool"

    session = models.ForeignKey(
        AssistantSession, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=16)
    content = models.TextField()
    tool_name = models.CharField(max_length=64, blank=True, default="")
    tool_call_id = models.CharField(max_length=128, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}"
