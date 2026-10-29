from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group, User
from unfold.admin import ModelAdmin, TabularInline
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from .models import Booking, Conversation, Cottage, ExchangeRate, LoginCode, Message, Owner, OwnerSignup


@admin.register(OwnerSignup)
class OwnerSignupAdmin(ModelAdmin):
    list_display = ["name", "email", "country", "region", "cottage_count", "status", "created_at"]
    list_filter = ["status", "country", "region", "language"]
    list_editable = ["status"]
    search_fields = ["name", "email", "phone"]
    readonly_fields = ["created_at", "privacy_consent", "source"]
    fieldsets = [
        ("Who", {"fields": ["name", "email", "phone", "language"], "classes": ["st-grid-2"]}),
        ("Cottages", {"fields": ["country", "region", "cottage_count", "nettimokki_url"], "classes": ["st-grid-2"]}),
        ("Their message", {"fields": ["message"]}),
        ("Follow-up", {"fields": ["status", "internal_notes"]}),
        ("From the form", {"fields": ["privacy_consent", "source", "created_at"], "classes": ["st-grid-3"]}),
    ]


class CottageInline(TabularInline):
    model = Cottage
    extra = 0
    fields = ["name", "country", "region", "max_guests", "price_per_night", "status"]
    show_change_link = True


@admin.register(Owner)
class OwnerAdmin(ModelAdmin):
    list_display = ["name", "email", "is_pilot", "commission_rate", "agreement_signed_on"]
    list_filter = ["is_pilot", "language"]
    search_fields = ["name", "email"]
    inlines = [CottageInline]
    readonly_fields = ["created_at"]
    fieldsets = [
        ("Owner", {"fields": ["name", "email", "phone", "language", "user", "signup"], "classes": ["st-grid-2"]}),
        ("Agreement", {"fields": ["is_pilot", "commission_rate", "vat_registered", "agreement_signed_on", "created_at"],
                       "classes": ["st-grid-2"]}),
    ]


@admin.register(Cottage)
class CottageAdmin(ModelAdmin):
    list_display = ["name", "owner", "country", "region", "max_guests", "price_per_night", "currency", "status", "listing_started_on", "listing_slug"]
    list_filter = ["status", "country", "region", "has_sauna"]
    search_fields = ["name", "owner__name", "municipality"]
    autocomplete_fields = ["owner"]
    fieldsets = [
        ("Cottage", {"fields": ["owner", "name", "status", "listing_slug", "listing_started_on"], "classes": ["st-grid-2"]}),
        ("Where", {"fields": ["country", "region", "municipality", "nettimokki_url"], "classes": ["st-grid-2"]}),
        ("Size", {"fields": ["max_guests", "bedrooms", "beds", "has_sauna", "has_lake_or_sea_access"], "classes": ["st-grid-3"]}),
        ("Price, in the cottage's currency", {"fields": ["price_per_night", "cleaning_fee", "min_nights"], "classes": ["st-grid-3"]}),
        ("For guests and the AI helper", {"fields": ["amenities", "house_rules", "description_fi", "description_en"]}),
    ]


@admin.register(Booking)
class BookingAdmin(ModelAdmin):
    list_display = ["cottage", "channel", "check_in", "check_out", "owner_payout", "commission", "commission_vat", "currency", "cancelled"]
    list_filter = ["channel", "cancelled"]
    date_hierarchy = "check_in"
    search_fields = ["cottage__name", "external_id"]
    autocomplete_fields = ["cottage"]
    fieldsets = [
        ("Stay", {"fields": ["cottage", "channel", "external_id", "check_in", "check_out", "guests"], "classes": ["st-grid-2"]}),
        ("Money, in the cottage's currency", {"fields": ["owner_payout", "cancelled"], "classes": ["st-grid-2"]}),
    ]


@admin.register(LoginCode)
class LoginCodeAdmin(ModelAdmin):
    """Read-only: who asked for a sign-in code, and whether it was used."""

    list_display = ["owner", "created_at", "expires_at", "attempts", "used_at"]
    readonly_fields = ["owner", "code_hash", "created_at", "expires_at", "attempts", "used_at"]

    def has_add_permission(self, request):
        return False


class MessageInline(TabularInline):
    model = Message
    extra = 1
    fields = ["sender", "body", "created_at"]
    readonly_fields = ["created_at"]


@admin.register(Conversation)
class ConversationAdmin(ModelAdmin):
    """Enquiries about example cottages with no owner yet land here for the team to answer."""

    list_display = ["guest_name", "cottage", "listing_slug", "channel", "last_message_at", "archived"]
    list_filter = ["channel", "archived", "guest_language"]
    search_fields = ["guest_name", "guest_email", "listing_slug", "cottage__name"]
    readonly_fields = ["token", "created_at", "last_message_at", "owner_read_at", "guest_read_at"]
    inlines = [MessageInline]


@admin.register(ExchangeRate)
class ExchangeRateAdmin(ModelAdmin):
    """The ECB's daily rates, fetched automatically; read-only."""

    list_display = ("currency", "per_eur", "rate_date", "fetched_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# Admin users and groups in the same look (unfold's forms), as in Bona.
admin.site.unregister(User)
admin.site.unregister(Group)


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm


@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass
