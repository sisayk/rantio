from django.contrib import admin
from django.http import JsonResponse
from django.urls import path

from owners import portal
from owners.views import OwnerSignupCreateView

admin.site.site_header = "Stugora admin"
admin.site.site_title = "Stugora"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/signups/", OwnerSignupCreateView.as_view(), name="owner-signup"),
    path("api/auth/request-code/", portal.RequestCodeView.as_view(), name="login-request-code"),
    path("api/auth/verify-code/", portal.VerifyCodeView.as_view(), name="login-verify-code"),
    path("api/auth/logout/", portal.LogoutView.as_view(), name="logout"),
    path("api/owner/me/", portal.MeView.as_view(), name="owner-me"),
    path("api/owner/summary/", portal.SummaryView.as_view(), name="owner-summary"),
    path("api/owner/bookings/", portal.BookingsView.as_view(), name="owner-bookings"),
    path("api/health/", lambda request: JsonResponse({"ok": True}), name="health"),
]
