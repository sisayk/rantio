from urllib.parse import urlparse

from rest_framework import serializers

from .models import MonitorInterest, OwnerSignup
from .regions import valid_region


class OwnerSignupSerializer(serializers.ModelSerializer):
    # Honeypot: real people never see or fill this field.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = OwnerSignup
        fields = [
            "id", "name", "email", "phone", "language", "country", "region", "place", "cottage_count",
            "nettimokki_url", "listed_on", "message", "privacy_consent", "source", "website",
        ]
        read_only_fields = ["id"]

    def validate_privacy_consent(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError("Consent to the privacy policy is required.")
        return value

    def validate_nettimokki_url(self, value: str) -> str:
        if value:
            host = (urlparse(value).hostname or "").lower()
            if not (host == "nettimokki.com" or host.endswith(".nettimokki.com")):
                raise serializers.ValidationError("Paste the link to your Nettimökki listing.")
        return value

    def validate_listed_on(self, value: str) -> str:
        keys = [k.strip() for k in value.split(",") if k.strip()]
        if any(k not in OwnerSignup.LISTED_ON for k in keys):
            raise serializers.ValidationError("Unknown site.")
        if "none" in keys and len(keys) > 1:
            keys = ["none"]
        return ",".join(dict.fromkeys(keys))

    def validate_cottage_count(self, value: int) -> int:
        if value > 50:
            raise serializers.ValidationError("For more than 50 cottages, contact us directly.")
        return value

    def validate(self, attrs):
        if attrs.pop("website", ""):
            raise serializers.ValidationError("Invalid submission.")
        # The form asks for the country, then one of its official regions.
        if not valid_region(attrs.get("country", "FI"), attrs.get("region", "")):
            raise serializers.ValidationError({"region": "Choose one of the country's regions."})
        attrs["place"] = attrs.get("place", "").strip()
        attrs["email"] = attrs["email"].strip().lower()
        attrs["name"] = attrs["name"].strip()
        return attrs


class MonitorInterestSerializer(serializers.ModelSerializer):
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)  # honeypot
    # The same address may join twice; the second time just updates the answers.
    email = serializers.EmailField()

    class Meta:
        model = MonitorInterest
        fields = ["email", "language", "country", "rents", "privacy_consent", "source", "website"]

    def validate_privacy_consent(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError("Consent to the privacy policy is required.")
        return value

    def validate(self, attrs):
        if attrs.pop("website", ""):
            raise serializers.ValidationError("Invalid submission.")
        attrs["email"] = attrs["email"].strip().lower()
        return attrs

    def create(self, validated):
        entry, _ = MonitorInterest.objects.update_or_create(email=validated.pop("email"), defaults=validated)
        return entry
