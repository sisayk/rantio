from urllib.parse import urlparse

from rest_framework import serializers

from .models import OwnerSignup


class OwnerSignupSerializer(serializers.ModelSerializer):
    # Honeypot: real people never see or fill this field.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = OwnerSignup
        fields = [
            "id", "name", "email", "phone", "language", "country", "region", "cottage_count",
            "nettimokki_url", "message", "privacy_consent", "source", "website",
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

    def validate_cottage_count(self, value: int) -> int:
        if value > 50:
            raise serializers.ValidationError("For more than 50 cottages, contact us directly.")
        return value

    def validate(self, attrs):
        if attrs.pop("website", ""):
            raise serializers.ValidationError("Invalid submission.")
        if attrs.get("region") and attrs.get("country", "FI") != "FI":
            raise serializers.ValidationError({"region": "Regions are only used for Finnish cottages."})
        attrs["email"] = attrs["email"].strip().lower()
        attrs["name"] = attrs["name"].strip()
        return attrs
