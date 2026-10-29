from django.contrib import admin

from .models import Booking, Conversation, Cottage, ExchangeRate, LoginCode, Message, Owner, OwnerSignup


@admin.register(OwnerSignup)
class OwnerSignupAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "country", "region", "cottage_count", "status", "created_at"]
    list_filter = ["status", "country", "region", "language"]
    list_editable = ["status"]
    search_fields = ["name", "email", "phone"]
    readonly_fields = ["created_at", "privacy_consent", "source"]


class CottageInline(admin.TabularInline):
    model = Cottage
    extra = 0
    fields = ["name", "country", "region", "max_guests", "price_per_night", "status"]
    show_change_link = True


@admin.register(Owner)
class OwnerAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "is_pilot", "commission_rate", "agreement_signed_on"]
    list_filter = ["is_pilot", "language"]
    search_fields = ["name", "email"]
    inlines = [CottageInline]


@admin.register(Cottage)
class CottageAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "country", "region", "max_guests", "price_per_night", "status", "listing_started_on", "listing_slug"]
    list_filter = ["status", "country", "region", "has_sauna"]
    search_fields = ["name", "owner__name", "municipality"]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["cottage", "channel", "check_in", "check_out", "owner_payout", "commission", "commission_vat", "cancelled"]
    list_filter = ["channel", "cancelled"]
    date_hierarchy = "check_in"
    search_fields = ["cottage__name", "external_id"]


@admin.register(LoginCode)
class LoginCodeAdmin(admin.ModelAdmin):
    """Read-only: who asked for a sign-in code, and whether it was used."""

    list_display = ["owner", "created_at", "expires_at", "attempts", "used_at"]
    readonly_fields = ["owner", "code_hash", "created_at", "expires_at", "attempts", "used_at"]

    def has_add_permission(self, request):
        return False


class MessageInline(admin.TabularInline):
    model = Message
    extra = 1
    fields = ["sender", "body", "created_at"]
    readonly_fields = ["created_at"]


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    """Enquiries about example cottages with no owner yet land here for the team to answer."""

    list_display = ["guest_name", "cottage", "listing_slug", "channel", "last_message_at", "archived"]
    list_filter = ["channel", "archived", "guest_language"]
    search_fields = ["guest_name", "guest_email", "listing_slug", "cottage__name"]
    readonly_fields = ["token", "created_at", "last_message_at", "owner_read_at", "guest_read_at"]
    inlines = [MessageInline]


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ("currency", "per_eur", "rate_date", "fetched_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
