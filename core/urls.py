from django.urls import path

from . import views
from .assistant_views import AssistantChatView
from .ml_views import ForecastDetailView, ReorderSuggestionsView

urlpatterns = [
    # Health
    path("health/", views.health),
    # Products
    path("products/", views.ProductListCreateView.as_view()),
    path("products/<str:sku>/", views.ProductDetailView.as_view()),
    # Inventory
    path("inventory/<str:sku>/", views.InventoryUpdateView.as_view()),
    # Dealers
    path("dealers/", views.DealerListCreateView.as_view()),
    path("dealers/<int:pk>/", views.DealerDetailView.as_view()),
    # Orders
    path("orders/", views.OrderListCreateView.as_view()),
    path("orders/<str:order_number>/", views.OrderDetailView.as_view()),
    # Dealer Assistant
    path("assistant/chat/", AssistantChatView.as_view()),
    # Forecasting & Reorder
    path("forecast/<str:sku>/", ForecastDetailView.as_view()),
    path("reorder-suggestions/", ReorderSuggestionsView.as_view()),
]
