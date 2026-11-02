"""POST /api/inbound/booking-email/ — booking emails pushed by an inbound-email service.

Accepts the raw email as the request body (message/rfc822 or text/plain), or a
form field named body-mime (Mailgun "store and notify"/forward) or email (SendGrid
Inbound Parse with "send raw"). The service must send INBOUND_EMAIL_SECRET in the
X-Rantio-Secret header or as ?secret=. Without a secret set, the endpoint is off.
"""

import hmac

from django.conf import settings
from django.http import Http404, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .booking_emails import ingest

MAX_BYTES = 2_000_000


@csrf_exempt
@require_POST
def booking_email(request):
    secret = settings.INBOUND_EMAIL_SECRET
    if not secret:
        raise Http404
    given = request.headers.get("X-Rantio-Secret") or request.GET.get("secret", "")
    if not hmac.compare_digest(given.encode(), secret.encode()):
        return HttpResponse(status=403)
    if len(request.body) > MAX_BYTES:
        return HttpResponse(status=413)
    content_type = request.content_type or ""
    if content_type.startswith(("multipart/", "application/x-www-form-urlencoded")):
        raw = request.POST.get("body-mime") or request.POST.get("email") or ""
    else:
        raw = request.body
    if not raw:
        return JsonResponse({"error": "No email in the request."}, status=400)
    email = ingest(raw)
    return JsonResponse({"id": email.pk, "status": email.status})
