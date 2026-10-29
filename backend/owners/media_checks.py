"""Checks for homepage slide uploads: real file type (not just the name) and video length.

No extra packages: images are recognised by their first bytes, and an MP4's length is
read from its 'mvhd' box (the movie header every MP4 and MOV file has).
"""

import struct

from django.core.exceptions import ValidationError

IMAGE_MAX = 8 * 1024 * 1024
VIDEO_MAX = 40 * 1024 * 1024
VIDEO_MAX_SECONDS = 20


def image_type(head: bytes) -> str | None:
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def mp4_seconds(data: bytes) -> float | None:
    """The length of an MP4/MOV in seconds, from moov/mvhd; None if it isn't one."""

    def boxes(buf: bytes, start: int, end: int):
        i = start
        while i + 8 <= end:
            size, kind = struct.unpack(">I4s", buf[i:i + 8])
            header = 8
            if size == 1:
                if i + 16 > end:
                    return
                size = struct.unpack(">Q", buf[i + 8:i + 16])[0]
                header = 16
            elif size == 0:
                size = end - i
            if size < header:
                return
            yield kind, i + header, min(i + size, end)
            i += size

    if data[4:8] != b"ftyp":
        return None
    for kind, s, e in boxes(data, 0, len(data)):
        if kind == b"moov":
            for k2, s2, _ in boxes(data, s, e):
                if k2 == b"mvhd":
                    version = data[s2]
                    if version == 1:
                        timescale, duration = struct.unpack(">IQ", data[s2 + 20:s2 + 32])
                    else:
                        timescale, duration = struct.unpack(">II", data[s2 + 12:s2 + 20])
                    return duration / timescale if timescale else None
    return None


def check_image(f) -> None:
    if f.size > IMAGE_MAX:
        raise ValidationError(f"The photo is {f.size / 1048576:.1f} MB; the limit is 8 MB.")
    f.seek(0)
    head = f.read(16)
    f.seek(0)
    if not image_type(head):
        raise ValidationError("Use a JPG, PNG or WebP photo.")


def check_video(f) -> float:
    """Returns the length in seconds."""
    if f.size > VIDEO_MAX:
        raise ValidationError(f"The video is {f.size / 1048576:.0f} MB; the limit is 40 MB. Shorten or compress it.")
    f.seek(0)
    data = f.read()
    f.seek(0)
    seconds = mp4_seconds(data)
    if seconds is None:
        raise ValidationError("Use an MP4 video (H.264), the kind phones and most editors save.")
    if seconds > VIDEO_MAX_SECONDS + 0.5:
        raise ValidationError(f"The video is {seconds:.0f} seconds long; the limit is {VIDEO_MAX_SECONDS} seconds.")
    return seconds
