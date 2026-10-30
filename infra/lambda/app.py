"""Audit Me leaderboard API (Layer 2).

Routes (API Gateway HTTP API, payload format 2.0):
    POST /score        save one finished game
    GET  /leaderboard  top 10, best entry per nickname

The browser computes the score, so this function can only bound it: it rejects
anything outside what the game can actually produce. The leaderboard is a fun
extra and is presented that way, never as proof of anything.
"""
import base64
import json
import logging
import os
import re
import time
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BOARD = "main"
MAX_BODY_BYTES = 1024
TTL_SECONDS = 60 * 24 * 3600
ALLOWED_FIELDS = {"nickname", "score", "seconds", "scenarios"}
NICKNAME_RE = re.compile(r"^[A-Za-z0-9 _-]{2,16}$")
BLOCKED_FRAGMENTS = ("http", "www", ".com", "admin", "fuck", "shit")

# Scoring rules, mirrored from site/js/engine.js
BASE_POINTS = 100
FLOOR_POINTS = 25
TIME_BONUS_START = 120
MIN_SECONDS_PER_SCENARIO = 5
MAX_SECONDS = 3600

_table = None


def get_table():
    """Create the DynamoDB table handle on first use (keeps unit tests free of boto3)."""
    global _table
    if _table is None:
        import boto3  # imported lazily on purpose

        _table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
    return _table


def response(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", "Cache-Control": "no-store"},
        "body": json.dumps(body),
    }


def is_int(value):
    # bool is a subclass of int in Python, and must not count as a number here
    return isinstance(value, int) and not isinstance(value, bool)


def validate(payload):
    """Return (clean_entry, None) or (None, error_message)."""
    if not isinstance(payload, dict):
        return None, "Send a JSON object."
    extra = set(payload) - ALLOWED_FIELDS
    if extra or set(payload) != ALLOWED_FIELDS:
        return None, "Send exactly: nickname, score, seconds, scenarios."

    nickname = payload["nickname"]
    if not isinstance(nickname, str):
        return None, "Nickname must be text."
    nickname = nickname.strip()
    if not NICKNAME_RE.match(nickname):
        return None, "Nickname must be 2 to 16 letters, numbers, spaces, - or _."
    lowered = nickname.lower()
    if any(fragment in lowered for fragment in BLOCKED_FRAGMENTS):
        return None, "Pick a different nickname."

    scenarios, seconds, score = payload["scenarios"], payload["seconds"], payload["score"]
    if not (is_int(scenarios) and scenarios in (3, 4)):
        return None, "Scenarios must be 3 or 4."
    if not (is_int(seconds) and MIN_SECONDS_PER_SCENARIO * scenarios <= seconds <= MAX_SECONDS):
        return None, "That time is not possible."
    max_score = BASE_POINTS * scenarios + max(0, TIME_BONUS_START - seconds)
    min_score = FLOOR_POINTS * scenarios
    if not (is_int(score) and min_score <= score <= max_score):
        return None, "That score is not possible."

    return {"nickname": nickname, "score": score, "seconds": seconds, "scenarios": scenarios}, None


def parse_body(event):
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8", errors="replace")
    if len(raw.encode("utf-8")) > MAX_BODY_BYTES:
        return None, "Request is too large."
    try:
        return json.loads(raw), None
    except (ValueError, TypeError):
        return None, "Send valid JSON."


def rank_key(entry, now_ms):
    # Ascending order = best first: inverted score, then faster time, then name.
    return "{:04d}#{:05d}#{}#{}".format(9999 - entry["score"], entry["seconds"], entry["nickname"].lower(), now_ms)


def post_score(event):
    payload, err = parse_body(event)
    if err:
        return response(400, {"error": err})
    entry, err = validate(payload)
    if err:
        return response(400, {"error": err})

    now = time.time()
    item = dict(entry)
    item.update(
        {
            "board": BOARD,
            "rank_key": rank_key(entry, int(now * 1000)),
            "created_at": datetime.fromtimestamp(now, tz=timezone.utc).isoformat(),
            "expires_at": int(now) + TTL_SECONDS,
        }
    )
    get_table().put_item(Item=item)
    logger.info("score saved: %s %s", entry["score"], entry["scenarios"])
    return response(201, {"nickname": entry["nickname"], "score": entry["score"], "seconds": entry["seconds"]})


def get_leaderboard(_event):
    result = get_table().query(
        KeyConditionExpression="board = :b",
        ExpressionAttributeValues={":b": BOARD},
        ScanIndexForward=True,
        Limit=50,
    )
    seen, entries = set(), []
    for item in result.get("Items", []):
        name = str(item["nickname"]).lower()
        if name in seen:
            continue
        seen.add(name)
        entries.append({"nickname": item["nickname"], "score": int(item["score"]), "seconds": int(item["seconds"])})
        if len(entries) == 10:
            break
    return response(200, {"entries": entries})


def handler(event, _context):
    route = event.get("routeKey", "")
    try:
        if route == "POST /score":
            return post_score(event)
        if route == "GET /leaderboard":
            return get_leaderboard(event)
        return response(404, {"error": "Not found."})
    except Exception:  # never leak internals to the client
        logger.exception("unhandled error")
        return response(500, {"error": "Server error."})
