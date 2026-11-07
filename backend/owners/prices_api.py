"""GET /api/pricing/: Rantio's prices as set in the admin (Settings → Prices, models.Pricing), for
the website's hosts page, terms and estimate, and the app. Public: the same numbers the hosts page
shows anyway."""

from rest_framework import permissions, views
from rest_framework.response import Response

from .models import VAT_RATE, Pricing


def as_number(value):
    """12.00 → 12, 12.50 → 12.5: JSON numbers the website can do sums with."""
    return int(value) if value == value.to_integral_value() else float(value)


def pricing_dict() -> dict:
    p = Pricing.current()
    return {
        "commission_rate": as_number(p.commission_rate),
        "trial_months": p.trial_months,
        "yearly_fees": {c: as_number(v) for c, v in p.yearly_fees.items()},
        "platform_fee": as_number(p.platform_fee),
        "vat_rate": as_number(VAT_RATE),
    }


class PricingView(views.APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        response = Response(pricing_dict())
        # Short, so a change in the admin is on the site within a minute.
        response["Cache-Control"] = "public, max-age=60"
        return response
