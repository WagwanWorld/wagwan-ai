# Chat latency and GPT-style responsiveness

This document summarizes what we implemented to improve **time-to-first-feedback (TTFT)** and how to tune further.

## Server (`/api/chat`)

- **Immediate SSE**: The stream emits `event: status` with `Reading your profile…` **before** `await resolveIdentityGraph`, so the client shows activity while the graph loads.
- **History cap**: Conversation history embedded in the prompt is capped at **12,000 characters** (most recent tail kept; prefix notes truncation).
- **Timing logs**: With `API_TIMING_LOG=1`, JSON logs include phases: `firstEnqueue`, `afterResolve`, `afterSearch` (when search runs), `firstTextDelta`, `afterStream`, plus `totalMs`.

## Search gating (`shouldRunWebSearch`)

Skipping Brave reduces latency for turns that do not need live URLs.

**Now skipped (non-exhaustive):**

- Short **drafting** / **remind** intents (length ≤ 180).
- **Summarise** intent without news/web keywords (length ≤ 200).
- Short **clarification** phrasing (“what do you mean”, “explain that”, etc., length ≤ 220).
- Trivial replies already handled (hi, thanks, ok, …).

**Tradeoff:** Fewer searches ⇒ fewer URL-backed cards on those turns; profile + thread still drive the reply.

## Client (`/ai`)

- **Abort**: Starting a new message aborts the previous in-flight `/api/chat` request (`AbortController`). Leaving the page aborts as well (`onDestroy`).
- **Streaming UI** was already using rAF batching and `loadingStatus` from SSE; early server status improves the “Reading your profile…” phase in the header and loading row.

## Optional next steps

- Stop button wired to the same `AbortController`.
- In-memory short-TTL cache for `resolveIdentityGraph` per session.
- Two-phase reply (stream without search, then append cards).
