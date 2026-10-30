"""Unit tests for the leaderboard Lambda. Run: python3 -m unittest discover -s tests -p "test_*.py" """
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "infra", "lambda"))
import app  # noqa: E402


class FakeTable:
    def __init__(self):
        self.items = []

    def put_item(self, Item):
        self.items.append(dict(Item))

    def query(self, **kwargs):
        assert kwargs["ExpressionAttributeValues"][":b"] == "main"
        ordered = sorted(self.items, key=lambda i: i["rank_key"])
        return {"Items": ordered[: kwargs.get("Limit", 50)]}


def post(body, route="POST /score", raw=None):
    return {"routeKey": route, "body": raw if raw is not None else json.dumps(body)}


GOOD = {"nickname": "Umer Ops", "score": 300, "seconds": 74, "scenarios": 3}


class ValidationTests(unittest.TestCase):
    def setUp(self):
        app._table = FakeTable()

    def code(self, body, **kw):
        return app.handler(post(body, **kw), None)["statusCode"]

    def test_valid_entry_is_saved(self):
        res = app.handler(post(GOOD), None)
        self.assertEqual(res["statusCode"], 201)
        self.assertEqual(len(app._table.items), 1)
        item = app._table.items[0]
        self.assertEqual(item["board"], "main")
        self.assertIn("expires_at", item)

    def test_rejects_bad_nicknames(self):
        for nick in ["x", "a" * 17, "<script>", "http://x.io", "ad min!", "my.com", "Admin", "", "   "]:
            self.assertEqual(self.code(dict(GOOD, nickname=nick)), 400, nick)

    def test_rejects_impossible_scores(self):
        # max for 3 scenarios in 74 s is 300 + 46 = 346
        self.assertEqual(self.code(dict(GOOD, score=346)), 201)
        self.assertEqual(self.code(dict(GOOD, score=347)), 400)
        self.assertEqual(self.code(dict(GOOD, score=74)), 400)   # below 25 x 3
        self.assertEqual(self.code(dict(GOOD, score=-5)), 400)
        self.assertEqual(self.code(dict(GOOD, score=9999)), 400)

    def test_rejects_impossible_times_and_counts(self):
        self.assertEqual(self.code(dict(GOOD, seconds=14)), 400)   # under 5 s per scenario
        self.assertEqual(self.code(dict(GOOD, seconds=3601)), 400)
        self.assertEqual(self.code(dict(GOOD, scenarios=2)), 400)
        self.assertEqual(self.code(dict(GOOD, scenarios=5)), 400)

    def test_rejects_wrong_types(self):
        self.assertEqual(self.code(dict(GOOD, score="300")), 400)
        self.assertEqual(self.code(dict(GOOD, score=300.5)), 400)
        self.assertEqual(self.code(dict(GOOD, score=True)), 400)
        self.assertEqual(self.code(dict(GOOD, nickname=123)), 400)

    def test_rejects_extra_or_missing_fields(self):
        self.assertEqual(self.code(dict(GOOD, admin=True)), 400)
        missing = dict(GOOD)
        del missing["seconds"]
        self.assertEqual(self.code(missing), 400)

    def test_rejects_bad_bodies(self):
        self.assertEqual(app.handler(post(None, raw="not json"), None)["statusCode"], 400)
        self.assertEqual(app.handler(post(None, raw="[1,2]"), None)["statusCode"], 400)
        self.assertEqual(app.handler(post(None, raw=""), None)["statusCode"], 400)
        self.assertEqual(app.handler(post(None, raw="x" * 2000), None)["statusCode"], 400)

    def test_unknown_route_is_404(self):
        self.assertEqual(app.handler({"routeKey": "GET /admin"}, None)["statusCode"], 404)

    def test_server_errors_do_not_leak_details(self):
        class Broken:
            def put_item(self, **_):
                raise RuntimeError("secret table name xyz")

        app._table = Broken()
        res = app.handler(post(GOOD), None)
        self.assertEqual(res["statusCode"], 500)
        self.assertNotIn("xyz", res["body"])


class LeaderboardTests(unittest.TestCase):
    def setUp(self):
        app._table = FakeTable()

    def test_best_first_and_one_entry_per_nickname(self):
        for nick, score, secs in [("amy", 250, 90), ("bob", 340, 40), ("amy", 300, 60), ("cat", 340, 30)]:
            res = app.handler(post({"nickname": nick, "score": score, "seconds": secs, "scenarios": 3}), None)
            self.assertEqual(res["statusCode"], 201, res["body"])
        board = json.loads(app.handler({"routeKey": "GET /leaderboard"}, None)["body"])["entries"]
        self.assertEqual([e["nickname"] for e in board], ["cat", "bob", "amy"])
        self.assertEqual(board[2]["score"], 300)  # amy's best, not her first

    def test_caps_at_ten(self):
        for i in range(15):
            app.handler(post({"nickname": "p%02d" % i, "score": 200 + i, "seconds": 100, "scenarios": 3}), None)
        board = json.loads(app.handler({"routeKey": "GET /leaderboard"}, None)["body"])["entries"]
        self.assertEqual(len(board), 10)
        self.assertEqual(board[0]["score"], 214)

    def test_empty_board(self):
        res = app.handler({"routeKey": "GET /leaderboard"}, None)
        self.assertEqual(json.loads(res["body"]), {"entries": []})


if __name__ == "__main__":
    unittest.main()
