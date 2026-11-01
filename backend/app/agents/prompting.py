"""Helpers for building prompts from untrusted text."""

from __future__ import annotations

from html import escape


def fence(tag: str, text: str) -> str:
    """Wrap untrusted text in a tag after escaping angle brackets, so it cannot close the tag
    or open a new one."""
    return f"<{tag}>\n{escape(text.strip(), quote=False)}\n</{tag}>"
