from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path

from config.admin_assets_view import admin_asset
from owners import calendar_views, events, geocode, inbound, inbox, listing_links, listings, newsletter, portal, site_icons
from owners.views import HeroSlidesView, MonitorInterestCreateView, OwnerSignupCreateView, RatesView, SignupCardView, health
from owners.views import EmailCodeView

admin.site.site_header = "Rantio admin"
admin.site.site_title = "Rantio"

urlpatterns = [
    path("admin/_assets/<str:name>", admin_asset, name="admin_asset"),
    path("admin/", admin.site.urls),
    path("api/events/", events.EventsView.as_view(), name="events"),
    path("api/signups/", OwnerSignupCreateView.as_view(), name="owner-signup"),
    path("api/signups/email-code/", EmailCodeView.as_view(), name="owner-signup-email-code"),
    path("api/signups/<str:token>/card/", SignupCardView.as_view(), name="owner-signup-card"),
    path("api/monitor-waitlist/", MonitorInterestCreateView.as_view(), name="monitor-waitlist"),
    path("api/newsletter/", newsletter.SubscribeView.as_view(), name="newsletter-subscribe"),
    path("api/newsletter/confirm/", newsletter.ConfirmView.as_view(), name="newsletter-confirm"),
    path("api/newsletter/unsubscribe/", newsletter.UnsubscribeView.as_view(), name="newsletter-unsubscribe"),
    path("api/auth/request-code/", portal.RequestCodeView.as_view(), name="login-request-code"),
    path("api/auth/verify-code/", portal.VerifyCodeView.as_view(), name="login-verify-code"),
    path("api/auth/logout/", portal.LogoutView.as_view(), name="logout"),
    path("api/auth/options/", portal.OptionsView.as_view(), name="login-options"),
    path("api/auth/social/", portal.SocialView.as_view(), name="login-social"),
    path("api/owner/device/", portal.DeviceView.as_view(), name="owner-device"),
    path("api/owner/me/", portal.MeView.as_view(), name="owner-me"),
    path("api/owner/monitor/", portal.MonitorWaitlistView.as_view(), name="owner-monitor"),
    path("api/owner/summary/", portal.SummaryView.as_view(), name="owner-summary"),
    path("api/owner/bookings/", portal.BookingsView.as_view(), name="owner-bookings"),
    path("api/enquiries/", inbox.EnquiryView.as_view(), name="enquiry"),
    path("api/enquiries/draft/", inbox.EnquiryDraftView.as_view(), name="enquiry-draft"),
    path("api/conversations/<str:token>/", inbox.GuestThreadView.as_view(), name="guest-thread"),
    path("api/conversations/<str:token>/push/", inbox.GuestPushView.as_view(), name="guest-push"),
    path("api/owner/conversations/", inbox.OwnerConversationsView.as_view(), name="owner-conversations"),
    path("api/owner/conversations/<int:pk>/", inbox.OwnerThreadView.as_view(), name="owner-thread"),
    path("api/owner/conversations/<int:pk>/draft/", inbox.OwnerDraftView.as_view(), name="owner-draft"),
    path("api/owner/assistant/", inbox.AssistantStatusView.as_view(), name="owner-assistant"),
    path("api/calendar/<str:token>.ics", calendar_views.calendar_export, name="calendar-export"),
    path("api/book/<str:token>/", calendar_views.BookingLinkView.as_view(), name="booking-link"),
    path("api/book/<str:token>/quote/", calendar_views.BookingQuoteView.as_view(), name="booking-quote"),
    path("api/owner/calendar/", calendar_views.OwnerCalendarView.as_view(), name="owner-calendar"),
    path("api/owner/calendar/blocks/", calendar_views.OwnerBlocksView.as_view(), name="owner-blocks"),
    path("api/owner/calendar/blocks/<int:pk>/", calendar_views.OwnerBlockView.as_view(), name="owner-block"),
    path("api/owner/calendar/feeds/", calendar_views.OwnerFeedsView.as_view(), name="owner-feeds"),
    path("api/owner/calendar/feeds/<int:pk>/", calendar_views.OwnerFeedView.as_view(), name="owner-feed"),
    path("api/owner/cottages/", listings.OwnerCottagesView.as_view(), name="owner-cottages"),
    path("api/owner/geocode/", geocode.GeocodeView.as_view(), name="owner-geocode"),
    path("api/owner/cottages/<int:pk>/", listings.OwnerCottageView.as_view(), name="owner-cottage"),
    path("api/owner/cottages/<int:pk>/links/", listing_links.OwnerLinksView.as_view(), name="owner-links"),
    path("api/owner/links/<int:pk>/", listing_links.OwnerLinkView.as_view(), name="owner-link"),
    path("api/owner/cottages/<int:pk>/status/", listings.OwnerStatusView.as_view(), name="owner-cottage-status"),
    path("api/owner/cottages/<int:pk>/duplicate/", listings.OwnerDuplicateView.as_view(), name="owner-cottage-duplicate"),
    path("api/owner/cottages/<int:pk>/preview/", listings.OwnerPreviewView.as_view(), name="owner-cottage-preview"),
    path("api/owner/cottages/<int:pk>/prices/", listings.OwnerPricesView.as_view(), name="owner-prices"),
    path("api/owner/cottages/<int:pk>/photos/", listings.OwnerPhotosView.as_view(), name="owner-photos"),
    path("api/owner/cottages/<int:pk>/photos/<int:photo_pk>/replace/", listings.OwnerPhotoReplaceView.as_view(), name="owner-photo-replace"),
    path("api/owner/cottages/<int:pk>/photos/order/", listings.OwnerPhotoOrderView.as_view(), name="owner-photo-order"),
    path("api/owner/cottages/<int:pk>/photos/<int:photo_pk>/", listings.OwnerPhotoView.as_view(), name="owner-photo"),
    path("api/owner/cottages/<int:pk>/booking-link/", calendar_views.OwnerBookingLinkView.as_view(), name="owner-booking-link"),
    path("api/owner/conversations/<int:pk>/accept/", calendar_views.OwnerRequestView.as_view(), {"action": "accept"}, name="owner-request-accept"),
    path("api/owner/conversations/<int:pk>/decline/", calendar_views.OwnerRequestView.as_view(), {"action": "decline"}, name="owner-request-decline"),
    path("api/rates/", RatesView.as_view(), name="rates"),
    path("api/site-icon/<str:site>/", site_icons.site_icon, name="site-icon"),
    path("api/hero/", HeroSlidesView.as_view(), name="hero-slides"),
    path("api/inbound/booking-email/", inbound.booking_email, name="inbound-booking-email"),
    path("api/health/", health, name="health"),
]

# Uploaded files in development; in production the web server serves /media/.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
