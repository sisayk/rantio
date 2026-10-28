from django.contrib import admin

from .models import Booking, Cottage, Owner, OwnerSignup


@admin.register(OwnerSignup)
class OwnerSignupAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "region", "cottage_count", "status", "created_at"]
    list_filter = ["status", "region", "language"]
    list_editable = ["status"]
    search_fields = ["name", "email", "phone"]
    readonly_fields = ["created_at", "privacy_consent", "source"]


class CottageInline(admin.TabularInline):
    model = Cottage
    extra = 0
    fields = ["name", "region", "max_guests", "price_per_night", "status"]
    show_change_link = True


@admin.register(Owner)
class OwnerAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "is_pilot", "commission_rate", "agreement_signed_on"]
    list_filter = ["is_pilot", "language"]
    search_fields = ["name", "email"]
    inlines = [CottageInline]


@admin.register(Cottage)
class CottageAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "region", "max_guests", "price_per_night", "status", "listing_started_on"]
    list_filter = ["status", "region", "has_sauna"]
    search_fields = ["name", "owner__name", "municipality"]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["cottage", "channel", "check_in", "check_out", "owner_payout", "commission", "commission_vat", "cancelled"]
    list_filter = ["channel", "cancelled"]
    date_hierarchy = "check_in"
    search_fields = ["cottage__name", "external_id"]
