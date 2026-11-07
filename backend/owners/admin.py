from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group, User
from unfold.admin import ModelAdmin, TabularInline
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from decimal import Decimal

from django import forms
from django.utils.html import format_html
from unfold import widgets as unfold_widgets
from unfold.decorators import display

from . import media_checks
from django.contrib import messages

from . import booking_emails, invoicing, stripe_api, vault
from .models import (
    AppDevice, Booking, CalendarBlock, CalendarFeed, Conversation, Cottage, CottageChange, CottagePhoto, ExchangeRate, ExternalRating, HeroSlide, InboundEmail, Invoice, ListingLink, LoginCode,
    Message, MonitorAlert, MonitorDevice, MonitorInterest, NewsletterSubscriber, Owner, OwnerSignup, Pricing, Review, SignupPhoto,
)


class SignupPhotoInline(TabularInline):
    model = SignupPhoto
    extra = 0
    fields = ["preview", "image", "position"]
    readonly_fields = ["preview"]

    @display(description="Photo")
    def preview(self, obj):
        if not obj.pk or not obj.image:
            return "-"
        return format_html('<a href="{0}" target="_blank"><img src="{0}" style="height:96px;border-radius:6px"></a>', obj.image.url)


@admin.register(OwnerSignup)
class OwnerSignupAdmin(ModelAdmin):
    list_display = ["name", "email", "country", "region", "cottage_count", "listed_now", "photo_count", "card", "status", "created_at"]
    list_filter = ["status", "country", "language", ("card_saved_at", admin.EmptyFieldListFilter)]
    list_editable = ["status"]
    search_fields = ["name", "email", "phone"]
    readonly_fields = ["created_at", "privacy_consent", "source", "card", "stripe_customer_id"]
    inlines = [SignupPhotoInline]
    actions = ["copy_photos"]
    fieldsets = [
        ("Who", {"fields": ["name", "email", "phone", "language"], "classes": ["st-grid-2"]}),
        ("Cottages", {"fields": ["country", "region", "place", "cottage_count", "listed_on", "nettimokki_url"],
                      "classes": ["st-grid-2"]}),
        ("Their message", {"fields": ["message"]}),
        ("Follow-up", {"fields": ["status", "internal_notes"]}),
        ("Free trial", {"fields": ["card", "stripe_customer_id"], "classes": ["st-grid-2"]}),
        ("From the form", {"fields": ["privacy_consent", "source", "created_at"], "classes": ["st-grid-3"]}),
    ]

    @display(description="Listed now")
    def listed_now(self, obj):
        return obj.listed_on_display

    @display(description="Photos")
    def photo_count(self, obj):
        return obj.photos.count()

    @display(description="Card for the trial")
    def card(self, obj):
        return f"Saved {obj.card_saved_at:%-d.%-m.%Y}" if obj.card_saved_at else "Not saved"

    @admin.action(description="Copy the photos to the owner's first cottage")
    def copy_photos(self, request, queryset):
        from django.core.files.base import ContentFile

        for signup in queryset:
            owner = Owner.objects.filter(signup=signup).first()
            cottage = owner.cottages.order_by("pk").first() if owner else None
            if not cottage:
                self.message_user(request, f"{signup.name}: link the sign-up to an owner with a cottage first.", messages.WARNING)
                continue
            start = cottage.photos.count()
            for i, photo in enumerate(signup.photos.all()):
                with photo.image.open("rb") as f:
                    data = f.read()
                CottagePhoto.objects.create(cottage=cottage, position=start + i,
                                            image=ContentFile(data, name=photo.image.name.rsplit("/", 1)[-1]))
            self.message_user(request, f"{signup.name}: {signup.photos.count()} photos copied to {cottage.name}.")


@admin.register(MonitorInterest)
class MonitorInterestAdmin(ModelAdmin):
    list_display = ["email", "country", "rents", "language", "created_at"]
    list_filter = ["rents", "country", "language"]
    search_fields = ["email"]
    readonly_fields = ["created_at", "privacy_consent", "source"]


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(ModelAdmin):
    list_display = ["email", "language", "is_active", "confirmed_at", "unsubscribed_at", "created_at"]
    list_filter = [("confirmed_at", admin.EmptyFieldListFilter), ("unsubscribed_at", admin.EmptyFieldListFilter), "language"]
    search_fields = ["email"]
    readonly_fields = ["token", "created_at", "confirmed_at", "unsubscribed_at", "confirmations_sent", "last_confirmation_at", "source"]
    actions = ["export_active"]

    @display(description="On the list", boolean=True)
    def is_active(self, obj):
        return obj.active

    @admin.action(description="Export confirmed subscribers (CSV)")
    def export_active(self, request, queryset):
        import csv

        from django.http import HttpResponse

        res = HttpResponse(content_type="text/csv; charset=utf-8")
        res["Content-Disposition"] = 'attachment; filename="rantio-newsletter.csv"'
        out = csv.writer(res)
        out.writerow(["email", "language", "confirmed_at"])
        for sub in queryset.filter(confirmed_at__isnull=False, unsubscribed_at__isnull=True):
            out.writerow([sub.email, sub.language, sub.confirmed_at.isoformat()])
        return res


class CottageInline(TabularInline):
    model = Cottage
    extra = 0
    fields = ["name", "country", "region", "max_guests", "price_per_night", "status"]
    show_change_link = True


@admin.register(Owner)
class OwnerAdmin(ModelAdmin):
    list_display = ["name", "email", "is_host", "is_pilot", "commission_rate", "agreement_signed_on"]
    list_filter = ["is_host", "is_pilot", "language"]
    search_fields = ["name", "email"]
    inlines = [CottageInline]
    readonly_fields = ["created_at", "stripe_customer_id", "card", "signs_in_with", "tax_number"]
    # The encrypted fields (owners/vault.py) are text columns: show them as what they hold.
    formfield_overrides = {
        vault.SealedCharField: {"widget": unfold_widgets.UnfoldAdminTextInputWidget},
        vault.SealedDateField: {"widget": unfold_widgets.UnfoldAdminSingleDateWidget},
        vault.SealedJSONField: {"widget": unfold_widgets.UnfoldAdminTextareaWidget},
    }
    fieldsets = [
        ("Owner", {"fields": ["name", "email", "phone", "language", "is_host", "user", "signup", "signs_in_with"],
                   "classes": ["st-grid-2"]}),
        ("Agreement", {"fields": ["is_pilot", "commission_rate", "vat_registered", "agreement_signed_on", "created_at"],
                       "classes": ["st-grid-2"]}),
        ("Billing", {"fields": ["airbnb_cohost_payout", "stripe_customer_id", "card"], "classes": ["st-grid-2"]}),
        ("Who lists, and the address", {"fields": ["account_type", "company_name", "business_id", "vat_id", "address_line",
                                                   "postal_code", "city", "address_country", "photo"], "classes": ["st-grid-2"]}),
        ("For the booking sites (private person)", {"fields": ["legal_first_name", "legal_last_name", "date_of_birth", "tax_country",
                                                                "tax_number", "emergency_name", "emergency_phone"], "classes": ["st-grid-2"]}),
        ("For the booking sites (company)", {"fields": ["business_type", "trading_name", "website", "legal_rep_name", "legal_rep_role",
                                                         "beneficial_owners"], "classes": ["st-grid-2"]}),
        ("Postal address and contacts", {"fields": ["postal_same", "postal_line", "postal_postal_code", "postal_city", "postal_country",
                                                     "reservations_contact"], "classes": ["st-grid-2"]}),
        ("Payouts", {"fields": ["payout_holder", "payout_iban", "payout_bic"], "classes": ["st-grid-2"]}),
    ]

    @display(description="Tax number")
    def tax_number(self, obj):
        # Stored encrypted; the admin sees it masked, like the owner does.
        from .profile import tax_id_row
        row = tax_id_row(obj)
        if row["tax_id_unreadable"]:
            return "Can't be decrypted: a key is missing (stugora-manage vault status)"
        return row["tax_id"] or "—"

    @display(description="Card")
    def card(self, obj):
        saved = obj.stripe_payment_method or (obj.signup.stripe_payment_method if obj.signup else "")
        return "Saved: invoices are charged to it" if saved else "None: invoices are emailed"

    @display(description="Signs in with")
    def signs_in_with(self, obj):
        ways = ["email code"] + (["SMS code"] if obj.phone else []) + (["Google"] if obj.google_sub else []) + (["Apple"] if obj.apple_sub else [])
        return ", ".join(ways)


class CottagePhotoInline(TabularInline):
    model = CottagePhoto
    extra = 0
    fields = ["preview", "image", "kind", "position"]
    readonly_fields = ["preview"]
    ordering = ["position", "pk"]

    @display(description="Photo")
    def preview(self, obj):
        if not obj.pk or not obj.image:
            return "-"
        return format_html('<img src="{}" style="height:64px;border-radius:6px">', obj.image.url)


class ListingLinkInline(TabularInline):
    model = ListingLink
    extra = 0
    fields = ["site", "url", "feed"]
    readonly_fields = ["feed"]
    verbose_name = "listing on another site"
    verbose_name_plural = "listings on other sites"


class ExternalRatingInline(TabularInline):
    model = ExternalRating
    extra = 0
    fields = ["site", "score", "scale", "count", "url", "updated_at"]
    readonly_fields = ["updated_at"]
    verbose_name = "score on another site"
    verbose_name_plural = "scores on other sites"


class CottageChangeInline(TabularInline):
    """What the owner changed in Hosting → My listings (field names only)."""

    model = CottageChange
    extra = 0
    fields = ["at", "by", "action", "fields"]
    readonly_fields = fields
    can_delete = False
    ordering = ["-at"]
    max_num = 0


@admin.register(Cottage)
class CottageAdmin(ModelAdmin):
    inlines = [CottagePhotoInline, ListingLinkInline, ExternalRatingInline, CottageChangeInline]
    list_display = ["name", "owner", "country", "region", "max_guests", "price_per_night", "currency", "status", "listing_started_on", "listing_slug"]
    list_filter = ["status", "country", "region", "has_sauna"]
    search_fields = ["name", "owner__name", "municipality", "inbound_code"]
    autocomplete_fields = ["owner"]
    readonly_fields = ["forwarding_address", "beds24_property_id", "beds24_room_id", "beds24_synced_at", "beds24_error"]
    actions = ["send_to_beds24"]
    fieldsets = [
        ("Cottage", {"fields": ["owner", "name", "status", "listing_slug", "listing_started_on", "trial_months"], "classes": ["st-grid-2"]}),
        ("Beds24 (channel manager)", {
            "fields": ["beds24_property_id", "beds24_room_id", "beds24_synced_at", "beds24_error"],
            "classes": ["st-grid-2"],
            "description": "Filled in by the action \"Send to Beds24\" in the cottage list. Airbnb, Booking.com and Vrbo are "
                           "then connected to the property once, in Beds24's control panel.",
        }),
        ("Where", {"fields": ["country", "region", "municipality", "nettimokki_url"], "classes": ["st-grid-2"]}),
        ("Nettimökki booking emails", {
            "fields": ["forwarding_address"],
            "description": "Set up a forwarding rule in the owner's email so Nettimökki's booking emails go to this "
                           "address. Their dates are then blocked here automatically.",
        }),
        ("Size", {"fields": ["max_guests", "bedrooms", "beds", "has_sauna", "has_lake_or_sea_access"], "classes": ["st-grid-3"]}),
        ("Price, in the cottage's currency", {"fields": ["price_per_night", "cleaning_fee", "min_nights"], "classes": ["st-grid-3"]}),
        ("For guests and the AI helper", {"fields": ["amenities", "house_rules", "description_fi", "description_en"]}),
    ]


    @admin.action(description="Send to Beds24 (the cottage and its prices)")
    def send_to_beds24(self, request, queryset):
        from django.contrib import messages

        from . import beds24

        if not beds24.enabled():
            self.message_user(request, "Beds24 isn't connected yet: run deploy/set-beds24.sh on the Mac.", messages.ERROR)
            return
        for c in queryset:
            try:
                self.message_user(request, beds24.sync(c), messages.SUCCESS)
            except beds24.Beds24Error as e:
                self.message_user(request, f"{c.name}: {e}", messages.ERROR)


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


@admin.register(AppDevice)
class AppDeviceAdmin(ModelAdmin):
    list_display = ("owner", "name", "platform", "has_push", "last_used_at", "created_at")
    list_filter = ("platform",)
    search_fields = ("owner__name", "owner__email", "name")
    readonly_fields = ("owner", "name", "platform", "push_token", "created_at", "last_used_at")
    exclude = ("token_hash",)

    @admin.display(boolean=True, description="Notifications")
    def has_push(self, obj):
        return bool(obj.push_token)

    def has_add_permission(self, request):
        return False


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

    list_display = ["guest_name", "cottage", "listing_slug", "channel", "request_status", "last_message_at", "archived"]
    list_filter = ["channel", "request_status", "archived", "guest_language"]
    search_fields = ["guest_name", "guest_email", "listing_slug", "cottage__name"]
    readonly_fields = ["token", "created_at", "last_message_at", "owner_read_at", "guest_read_at"]
    inlines = [MessageInline]


@admin.register(Pricing)
class PricingAdmin(ModelAdmin):
    """Rantio's prices: one page, no list. The website and the app show them within a minute."""

    fieldsets = [
        ("Commission and free months", {
            "fields": ["commission_rate", "trial_months"],
            "classes": ["st-grid-2"],
            "description": "For owners and cottages added from now on. Someone already signed up keeps what they "
            "agreed to: change their commission on the owner's page and their free months on the cottage's page.",
        }),
        ("Yearly fee per cottage, before VAT", {
            "fields": ["yearly_fee_eur", "yearly_fee_sek", "yearly_fee_nok", "yearly_fee_dkk", "yearly_fee_isk"],
            "classes": ["st-grid-3"],
            "description": "Charged at this price whenever a cottage's next listing year starts, for every owner.",
        }),
        ("Website example", {"fields": ["platform_fee", "updated_at"], "classes": ["st-grid-2"]}),
    ]
    readonly_fields = ["updated_at"]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        from django.shortcuts import redirect
        from django.urls import reverse

        return redirect(reverse("admin:owners_pricing_change", args=[Pricing.current().pk]))

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        messages.info(request, "Saved. The website and the app show the new prices within a minute.")


@admin.register(ExchangeRate)
class ExchangeRateAdmin(ModelAdmin):
    """The ECB's daily rates, fetched automatically; read-only."""

    list_display = ("currency", "per_eur", "rate_date", "fetched_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class SlideUpload(forms.ClearableFileInput):
    """A large 'choose or drop a file' box with a preview, the current file, and checks
    before upload (size, video length). Template: templates/admin/owners/heroslide/upload.html."""

    def __init__(self, kind: str, accept: str):
        super().__init__(attrs={"accept": accept})
        self.kind = kind

    def render(self, name, value, attrs=None, renderer=None):
        from django.template.loader import render_to_string
        from django.utils.safestring import mark_safe

        attrs = attrs or {}
        url = getattr(value, "url", None) if value else None
        return mark_safe(render_to_string("admin/owners/heroslide/upload.html", {
            "name": name, "id": attrs.get("id", f"id_{name}"), "accept": self.attrs["accept"], "kind": self.kind,
            "url": url, "filename": str(value).rsplit("/", 1)[-1] if url else "",
            "can_clear": bool(url) and not self.is_required, "clear_name": self.clear_checkbox_name(name),
        }))


class HeroSlideForm(forms.ModelForm):
    class Meta:
        model = HeroSlide
        fields = ["title", "kind", "image", "image_url", "video", "alt", "focus", "seconds", "active"]
        widgets = {"image": SlideUpload("image", "image/jpeg,image/png,image/webp"),
                   "video": SlideUpload("video", "video/mp4,video/quicktime")}

    def clean(self):
        data = super().clean()
        kind, image, video = data.get("kind"), data.get("image"), data.get("video")
        new_image = image and image != getattr(self.instance, "image", None) and hasattr(image, "size")
        new_video = video and video != getattr(self.instance, "video", None) and hasattr(video, "size")
        if new_image:
            try:
                media_checks.check_image(image)
            except forms.ValidationError as err:
                self.add_error("image", err)
        if new_video:
            try:
                self.instance.video_seconds = Decimal(f"{media_checks.check_video(video):.2f}")
            except forms.ValidationError as err:
                self.add_error("video", err)
        # The file decides the kind, so a video added while "Photo" is still selected becomes
        # a video slide, and a "Video" slide with only a photo becomes a photo slide.
        if new_video and kind != HeroSlide.Kind.VIDEO:
            kind = data["kind"] = HeroSlide.Kind.VIDEO
        elif kind == HeroSlide.Kind.VIDEO and not video and (image or data.get("image_url")):
            kind = data["kind"] = HeroSlide.Kind.IMAGE
        if kind == HeroSlide.Kind.IMAGE and not image and not data.get("image_url"):
            self.add_error("image", "Add a photo or a video.")
        if kind == HeroSlide.Kind.VIDEO and not video:
            self.add_error("video", "Add the video.")
        return data


@admin.register(HeroSlide)
class HeroSlideAdmin(ModelAdmin):
    """The slides at the top of the homepage. Drag rows to change their order."""

    form = HeroSlideForm
    list_display = ["preview", "title", "kind", "length", "active", "order"]
    list_display_links = ["preview", "title"]
    list_editable = ["active", "order"]
    list_filter = ["kind", "active"]
    ordering_field = "order"
    hide_ordering_field = True
    fieldsets = [
        ("Slide", {"fields": ["title", "kind", "active"], "classes": ["st-grid-3"]}),
        ("Photo or video", {
            "fields": ["video", "image", "image_url"],
            "description": "Add a video (MP4) or a photo. Adding a video makes it a video slide; a photo added "
                           "next to a video is shown while the video loads.",
        }),
        ("On the page", {"fields": ["alt", "focus", "seconds"], "classes": ["st-grid-3"]}),
    ]

    def save_model(self, request, obj, form, change):
        if not change and not obj.order:
            last = HeroSlide.objects.order_by("-order").values_list("order", flat=True).first()
            obj.order = (last or 0) + 1
        if not obj.video:
            obj.video_seconds = None
        super().save_model(request, obj, form, change)

    @display(description="")
    def preview(self, obj):
        if obj.image or obj.image_url:
            return format_html('<img src="{}" alt="" style="width:120px;height:60px;object-fit:cover;border-radius:8px;">',
                               obj.image.url if obj.image else obj.image_url)
        if obj.video:
            return format_html('<video src="{}#t=0.5" muted preload="metadata" style="width:120px;height:60px;object-fit:cover;border-radius:8px;"></video>', obj.video.url)
        return "–"

    @display(description="Shows for")
    def length(self, obj):
        if obj.kind == HeroSlide.Kind.VIDEO:
            return f"{obj.video_seconds:.0f} s video" if obj.video_seconds else "video"
        return f"{obj.seconds} s"


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


@admin.register(InboundEmail)
class InboundEmailAdmin(ModelAdmin):
    list_display = ["received_at", "subject", "cottage", "status", "note"]
    list_filter = ["status"]
    search_fields = ["subject", "from_address", "to_address", "body"]
    readonly_fields = ["received_at", "message_id", "from_address", "to_address", "subject", "body", "booking", "note"]
    autocomplete_fields = ["cottage"]
    exclude = ["raw"]
    actions = ["read_again"]
    fieldsets = [
        ("Result", {"fields": ["status", "note", "cottage", "booking"], "classes": ["st-grid-2"],
                    "description": "Wrong or missing cottage? Pick it, save, then use “Read again” in the list."}),
        ("Email", {"fields": ["received_at", "from_address", "to_address", "subject", "message_id", "body"]}),
    ]

    @admin.action(description="Read again")
    def read_again(self, request, queryset):
        for email in queryset.exclude(raw=""):
            booking_emails.reread(email)
        self.message_user(request, f"Read {queryset.count()} email(s) again.")


@admin.register(Invoice)
class InvoiceAdmin(ModelAdmin):
    list_display = ["number", "owner", "month", "subtotal", "vat", "total", "currency", "status", "sent_at"]
    list_filter = ["status", "month", "currency"]
    search_fields = ["number", "owner__name", "owner__email"]
    readonly_fields = ["number", "owner", "month", "currency", "line_table", "subtotal", "vat", "total", "rates_date",
                       "stripe_invoice_id", "stripe_link", "created_at", "sent_at"]
    exclude = ["lines", "stripe_url"]
    actions = ["rebuild", "send_with_stripe", "mark_paid"]
    fieldsets = [
        ("Invoice", {"fields": ["number", "owner", "month", "currency", "status"], "classes": ["st-grid-2"]}),
        ("Lines, before VAT", {"fields": ["line_table", "subtotal", "vat", "total", "rates_date"],
                                        "classes": ["st-grid-2"]}),
        ("Stripe", {"fields": ["stripe_invoice_id", "stripe_link", "created_at", "sent_at"], "classes": ["st-grid-2"]}),
    ]

    def has_add_permission(self, request):  # made by make_monthly_invoices
        return False

    @display(description="Lines")
    def line_table(self, obj):
        rows = "".join(
            format_html("<tr><td style='padding:2px 12px 2px 0'>{}</td><td style='text-align:right'>{} {}</td><td style='padding-left:8px;color:#888'>{}</td></tr>",
                        x["description"], x["amount"], obj.currency, x.get("original", ""))
            for x in obj.lines
        )
        return format_html("<table>{}</table>", format_html(rows)) if rows else "—"

    @display(description="Stripe page")
    def stripe_link(self, obj):
        return format_html('<a href="{}" target="_blank" rel="noopener">Open</a>', obj.stripe_url) if obj.stripe_url else "—"

    @admin.action(description="Rebuild drafts from the latest bookings")
    def rebuild(self, request, queryset):
        for inv in queryset.filter(status=Invoice.Status.DRAFT):
            invoicing.build(inv.owner, inv.month)
        self.message_user(request, "Drafts rebuilt. A draft with nothing left to charge is removed.")

    @admin.action(description="Send through Stripe")
    def send_with_stripe(self, request, queryset):
        if not stripe_api.enabled():
            self.message_user(request, "Set STRIPE_SECRET_KEY first; nothing was sent.", messages.ERROR)
            return
        sent = 0
        for inv in queryset.filter(status=Invoice.Status.DRAFT):
            try:
                stripe_api.send(inv)
                sent += 1
            except stripe_api.StripeError as e:
                self.message_user(request, f"{inv.number}: {e}", messages.ERROR)
        self.message_user(request, f"Sent {sent} invoice(s).")

    @admin.action(description="Mark as paid")
    def mark_paid(self, request, queryset):
        n = queryset.filter(status=Invoice.Status.SENT).update(status=Invoice.Status.PAID)
        self.message_user(request, f"Marked {n} invoice(s) paid.")


@admin.register(CalendarFeed)
class CalendarFeedAdmin(ModelAdmin):
    """Booking sites' calendar links (iCal) that owners added; read every 15 minutes."""

    list_display = ["cottage", "channel", "last_synced_at", "last_error"]
    list_filter = ["channel"]
    search_fields = ["cottage__name", "cottage__owner__name"]
    readonly_fields = ["last_synced_at", "last_error", "created_at"]


@admin.register(CalendarBlock)
class CalendarBlockAdmin(ModelAdmin):
    """Closed dates: by the owner (no site) or read from a booking site's calendar."""

    list_display = ["cottage", "start", "end", "feed", "note"]
    list_filter = ["feed__channel"]
    search_fields = ["cottage__name", "note"]
    date_hierarchy = "start"


@admin.register(Review)
class ReviewAdmin(ModelAdmin):
    """Guests' reviews of stays booked through a booking link. Tick "hidden" to take one off the page."""

    list_display = ["cottage", "guest", "rating", "created_at", "hidden"]
    list_filter = ["hidden", "rating"]
    list_editable = ["hidden"]
    search_fields = ["cottage__name", "conversation__guest_name", "comment"]
    readonly_fields = ["conversation", "cottage", "rating", "cleanliness", "location", "value", "comment", "language", "owner_reply", "replied_at", "created_at"]

    @display(description="guest")
    def guest(self, obj):
        return obj.conversation.guest_name


class MonitorAlertInline(TabularInline):
    model = MonitorAlert
    extra = 0
    fields = ["kind", "started_at", "ended_at", "value"]
    readonly_fields = fields
    can_delete = False
    max_num = 0
    ordering = ["-started_at"]


@admin.register(MonitorDevice)
class MonitorDeviceAdmin(ModelAdmin):
    """Boxes are made with manage.py monitor new (it prints the claim code and secret once)."""

    list_display = ["serial", "owner", "cottage", "last_seen_at", "firmware"]
    search_fields = ["serial", "owner__name", "owner__email", "cottage__name"]
    readonly_fields = ["serial", "last_seen_at", "last", "firmware", "claimed_at", "created_at"]
    exclude = ["claim_code_hash", "secret_hash"]
    autocomplete_fields = ["owner", "cottage"]
    inlines = [MonitorAlertInline]

    def has_add_permission(self, request):
        return False
