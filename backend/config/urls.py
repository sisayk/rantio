from django.contrib import admin
from django.http import JsonResponse
from django.urls import path

from config.admin_assets_view import admin_css
from owners import inbox, portal
from owners.views import OwnerSignupCreateView, RatesView

admin.site.site_header = "Stugora admin"
admin.site.site_title = "Stugora"

urlpatterns = [
    path("admin/_assets/stugora-admin.css", admin_css, name="admin_css"),
    path("admin/", admin.site.urls),
    path("api/signups/", OwnerSignupCreateView.as_view(), name="owner-signup"),
    path("api/auth/request-code/", portal.RequestCodeView.as_view(), name="login-request-code"),
    path("api/auth/verify-code/", portal.VerifyCodeView.as_view(), name="login-verify-code"),
    path("api/auth/logout/", portal.LogoutView.as_view(), name="logout"),
    path("api/owner/me/", portal.MeView.as_view(), name="owner-me"),
    path("api/owner/summary/", portal.SummaryView.as_view(), name="owner-summary"),
    path("api/owner/bookings/", portal.BookingsView.as_view(), name="owner-bookings"),
    path("api/enquiries/", inbox.EnquiryView.as_view(), name="enquiry"),
    path("api/conversations/<str:token>/", inbox.GuestThreadView.as_view(), name="guest-thread"),
    path("api/owner/conversations/", inbox.OwnerConversationsView.as_view(), name="owner-conversations"),
    path("api/owner/conversations/<int:pk>/", inbox.OwnerThreadView.as_view(), name="owner-thread"),
    path("api/owner/conversations/<int:pk>/draft/", inbox.OwnerDraftView.as_view(), name="owner-draft"),
    path("api/owner/assistant/", inbox.AssistantStatusView.as_view(), name="owner-assistant"),
    path("api/rates/", RatesView.as_view(), name="rates"),
    path("api/health/", lambda request: JsonResponse({"ok": True}), name="health"),
]
