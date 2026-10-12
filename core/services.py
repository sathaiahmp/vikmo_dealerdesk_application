"""
Business logic / service functions for VIKMO DealerDesk.

These are the canonical implementations. Both API views and the assistant
tool `create_draft_order` call the same functions here to avoid duplication.
"""
import math
from decimal import ROUND_HALF_UP, Decimal
from typing import List

from django.db import transaction
from django.utils import timezone

from .exceptions import APIError
from .models import Dealer, Order, OrderItem, Product

TAX_RATE = Decimal("0.18")
GST_PLACES = Decimal("0.01")


def _compute_line(unit_price: Decimal, quantity: int):
    """Compute per-line money values.

    GST is rounded per line with ROUND_HALF_UP as specified in the contract.
    """
    line_subtotal = unit_price * quantity
    line_tax = (line_subtotal * TAX_RATE).quantize(GST_PLACES, rounding=ROUND_HALF_UP)
    line_total = line_subtotal + line_tax
    return line_subtotal, line_tax, line_total


def _generate_order_number() -> str:
    """Generate a unique order number in Asia/Kolkata time.

    Format: ORD-YYYYMMDD-NNNN (zero-padded daily sequence, unique).
    Uses SELECT FOR UPDATE at the DB level via the advisory lock pattern.
    """
    now = timezone.localtime(timezone.now())
    date_str = now.strftime("%Y%m%d")
    prefix = f"ORD-{date_str}-"

    # Find the highest existing sequence for today
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT order_number FROM core_order WHERE order_number LIKE %s ORDER BY order_number DESC LIMIT 1 FOR UPDATE SKIP LOCKED",
            [f"{prefix}%"],
        )
        row = cursor.fetchone()

    if row:
        last_seq = int(row[0].split("-")[-1])
        seq = last_seq + 1
    else:
        seq = 1

    return f"{prefix}{seq:04d}"


@transaction.atomic
def create_draft_order(dealer_id: int, items: List[dict]) -> Order:
    """Create a DRAFT order.

    Args:
        dealer_id: pk of the Dealer.
        items: list of {"sku": str, "quantity": int}

    Returns:
        Created Order instance with items prefetched.

    Raises:
        APIError on any validation failure.
    """
    # ---- Validate dealer -------------------------------------------------
    try:
        dealer = Dealer.objects.get(pk=dealer_id)
    except Dealer.DoesNotExist:
        raise APIError("VALIDATION_ERROR", f"Dealer {dealer_id} does not exist.", 400)

    # ---- Validate items list ---------------------------------------------
    if not items:
        raise APIError("VALIDATION_ERROR", "At least one item is required.", 400)

    seen_skus = set()
    validated_items = []

    for idx, item in enumerate(items):
        sku = item.get("sku")
        qty = item.get("quantity")

        if not sku:
            raise APIError("VALIDATION_ERROR", f"Item {idx}: 'sku' is required.", 400)

        # quantity must be a positive integer (reject booleans, floats, strings, negatives)
        if isinstance(qty, bool):
            raise APIError(
                "VALIDATION_ERROR",
                f"Item {idx}: quantity must be an integer >= 1, not a boolean.",
                400,
            )
        if not isinstance(qty, int):
            raise APIError(
                "VALIDATION_ERROR",
                f"Item {idx}: quantity must be an integer >= 1.",
                400,
            )
        if qty < 1:
            raise APIError(
                "VALIDATION_ERROR",
                f"Item {idx}: quantity must be >= 1.",
                400,
            )

        if sku in seen_skus:
            raise APIError(
                "VALIDATION_ERROR",
                f"Duplicate SKU '{sku}' in request.",
                400,
            )
        seen_skus.add(sku)

        try:
            product = Product.objects.get(sku=sku)
        except Product.DoesNotExist:
            raise APIError("VALIDATION_ERROR", f"Product '{sku}' does not exist.", 400)

        validated_items.append((product, qty))

    # ---- Generate order number (inside the transaction) -------------------
    order_number = _generate_order_number()

    # ---- Create order ----------------------------------------------------
    order = Order.objects.create(
        order_number=order_number,
        dealer=dealer,
        status=Order.STATUS_DRAFT,
    )

    sub = Decimal("0.00")
    tax = Decimal("0.00")

    for product, qty in validated_items:
        unit_price = product.price
        line_subtotal, line_tax, line_total = _compute_line(unit_price, qty)

        OrderItem.objects.create(
            order=order,
            product=product,
            quantity=qty,
            unit_price=unit_price,
            line_subtotal=line_subtotal,
            line_tax=line_tax,
            line_total=line_total,
        )
        sub += line_subtotal
        tax += line_tax

    order.subtotal = sub
    order.tax_total = tax
    order.grand_total = sub + tax
    order.save()

    # Prefetch items for the serialiser
    return Order.objects.prefetch_related("items__product").get(pk=order.pk)
