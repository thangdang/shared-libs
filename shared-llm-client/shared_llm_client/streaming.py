"""SSE token streaming support for LLM responses.

Provides utilities for streaming tokens from Ollama as Server-Sent Events
and formatting SSE event strings.
"""

import json
import logging
from typing import AsyncIterator

import httpx

logger = logging.getLogger(__name__)


def format_sse_event(data: str, event_type: str = "token") -> str:
    """Format data as a Server-Sent Event string.

    Args:
        data: Event data payload.
        event_type: Event type (default "token").

    Returns:
        Formatted SSE event string with trailing newlines.
    """
    lines = []
    lines.append(f"event: {event_type}")
    # Handle multi-line data
    for line in data.split("\n"):
        lines.append(f"data: {line}")
    lines.append("")  # Trailing newline to end event
    return "\n".join(lines) + "\n"


async def stream_ollama(
    url: str,
    model: str,
    prompt: str,
    options: dict,
) -> AsyncIterator[str]:
    """Stream tokens from Ollama as they are generated.

    Yields individual SSE-formatted token events.
    Final yield includes [DONE] marker with complete response and usage.

    Args:
        url: Ollama API base URL.
        model: Model name.
        prompt: Input prompt.
        options: Generation options (temperature, num_predict, etc.).

    Yields:
        SSE-formatted event strings (token events + final event).
    """
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": True,
        "options": options,
    }

    full_response = ""
    usage = {}

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{url}/api/generate", json=payload
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line:
                        continue

                    data = json.loads(line)
                    token = data.get("response", "")

                    if token:
                        full_response += token
                        yield format_sse_event(token, "token")

                    if data.get("done", False):
                        usage = {
                            "prompt_tokens": data.get("prompt_eval_count", 0),
                            "completion_tokens": data.get("eval_count", 0),
                            "total_duration_ms": data.get("total_duration", 0) / 1_000_000,
                        }
                        break

        # Emit final event with complete response
        final_data = json.dumps({
            "content": full_response,
            "usage": usage,
            "done": True,
        })
        yield format_sse_event(final_data, "done")

    except Exception as e:
        # Emit error event and close gracefully
        error_data = json.dumps({"error": str(e), "partial_response": full_response})
        yield format_sse_event(error_data, "error")
        logger.error(f"Stream error: {e}")
