from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path

from config.admin_assets_view import admin_css
from owners import calendar_views, inbound, inbox, portal
from owners.views import HeroSlidesView, OwnerSignupCreateView, RatesView

admin.site.site_header = "Stugora admin"
admin.site.site_title = "Stugora"

urlpatterns = [
    path("admin/_assets/stugora-admin.css", admin_css, name="admin_css"),
    path("admin/", admin.site.urls),
    path("api/signups/", OwnerSignupCreateView.as_view(), name="owner-signup"),
    path("api/auth/request-code/", portal.RequestCodeView.as_view(), name="login-request-code"),
    path("api/auth/verify-code/", portal.VerifyCodeView.as_view(), name="login-verify-code"),
    path("api/auth/logout/", portal.LogoutView.as_view(), name="logout"),
    path("api/owner/device/", portal.DeviceView.as_view(), name="owner-device"),
    path("api/owner/me/", portal.MeView.as_view(), name="owner-me"),
    path("api/owner/summary/", portal.SummaryView.as_view(), name="owner-summary"),
    path("api/owner/bookings/", portal.BookingsView.as_view(), name="owner-bookings"),
    path("api/enquiries/", inbox.EnquiryView.as_view(), name="enquiry"),
    path("api/enquiries/draft/", inbox.EnquiryDraftView.as_view(), name="enquiry-draft"),
    path("api/conversations/<str:token>/", inbox.GuestThreadView.as_view(), name="guest-thread"),
    path("api/owner/conversations/", inbox.OwnerConversationsView.as_view(), name="owner-conversations"),
    path("api/owner/conversations/<int:pk>/", inbox.OwnerThreadView.as_view(), name="owner-thread"),
    path("api/owner/conversations/<int:pk>/draft/", inbox.OwnerDraftView.as_view(), name="owner-draft"),
    path("api/owner/assistant/", inbox.AssistantStatusView.as_view(), name="owner-assistant"),
    path("api/calendar/<str:token>.ics", calendar_views.calendar_export, name="calendar-export"),
    path("api/book/<str:token>/", calendar_views.BookingLinkView.as_view(), name="booking-link"),
    path("api/owner/calendar/", calendar_views.OwnerCalendarView.as_view(), name="owner-calendar"),
    path("api/owner/calendar/blocks/", calendar_views.OwnerBlocksView.as_view(), name="owner-blocks"),
    path("api/owner/calendar/blocks/<int:pk>/", calendar_views.OwnerBlockView.as_view(), name="owner-block"),
    path("api/owner/calendar/feeds/", calendar_views.OwnerFeedsView.as_view(), name="owner-feeds"),
    path("api/owner/calendar/feeds/<int:pk>/", calendar_views.OwnerFeedView.as_view(), name="owner-feed"),
    path("api/owner/cottages/<int:pk>/booking-link/", calendar_views.OwnerBookingLinkView.as_view(), name="owner-booking-link"),
    path("api/owner/conversations/<int:pk>/accept/", calendar_views.OwnerRequestView.as_view(), {"action": "accept"}, name="owner-request-accept"),
    path("api/owner/conversations/<int:pk>/decline/", calendar_views.OwnerRequestView.as_view(), {"action": "decline"}, name="owner-request-decline"),
    path("api/rates/", RatesView.as_view(), name="rates"),
    path("api/hero/", HeroSlidesView.as_view(), name="hero-slides"),
    path("api/inbound/booking-email/", inbound.booking_email, name="inbound-booking-email"),
    path("api/health/", lambda request: JsonResponse({"ok": True}), name="health"),
]

# Uploaded files in development; in production the web server serves /media/.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
