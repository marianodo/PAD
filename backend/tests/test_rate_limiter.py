"""Tests for the in-memory rate limiter."""

import time

from app.api.dependencies import RateLimiter


class TestRateLimiter:

    def test_allows_requests_under_limit(self):
        limiter = RateLimiter(max_requests=5, window_seconds=60)
        for _ in range(5):
            assert limiter.check("provider-1") is True

    def test_blocks_requests_over_limit(self):
        limiter = RateLimiter(max_requests=3, window_seconds=60)
        for _ in range(3):
            assert limiter.check("provider-1") is True
        assert limiter.check("provider-1") is False

    def test_independent_providers(self):
        limiter = RateLimiter(max_requests=2, window_seconds=60)
        assert limiter.check("provider-1") is True
        assert limiter.check("provider-1") is True
        assert limiter.check("provider-1") is False
        # Different provider should still be allowed
        assert limiter.check("provider-2") is True

    def test_window_resets(self):
        limiter = RateLimiter(max_requests=2, window_seconds=1)
        assert limiter.check("provider-1") is True
        assert limiter.check("provider-1") is True
        assert limiter.check("provider-1") is False
        # Wait for window to expire
        time.sleep(1.1)
        assert limiter.check("provider-1") is True

    def test_seconds_until_reset(self):
        limiter = RateLimiter(max_requests=1, window_seconds=60)
        assert limiter.seconds_until_reset("provider-1") == 0
        limiter.check("provider-1")
        remaining = limiter.seconds_until_reset("provider-1")
        assert 50 <= remaining <= 60

    def test_seconds_until_reset_empty(self):
        limiter = RateLimiter(max_requests=10, window_seconds=60)
        assert limiter.seconds_until_reset("nonexistent") == 0
