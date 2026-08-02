"""
HTTP 客户端 — 绕过 Windows 系统代理
"""
import httpx


def create_http_client() -> httpx.Client:
    """Create an httpx client that bypasses system proxy settings."""
    return httpx.Client(proxy=None, trust_env=False, timeout=120.0)
