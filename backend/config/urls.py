from django.contrib import admin
from django.http import JsonResponse
from django.urls import path

from owners.views import OwnerSignupCreateView

admin.site.site_header = "Stugora admin"
admin.site.site_title = "Stugora"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/signups/", OwnerSignupCreateView.as_view(), name="owner-signup"),
    path("api/health/", lambda request: JsonResponse({"ok": True}), name="health"),
]
