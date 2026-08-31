"""Draft and review a paragraph with Google ADK."""

import os
import sys
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.runners import InMemoryRunner
from google.genai import types


load_dotenv(Path(__file__).resolve().parents[2] / ".env")

APP_NAME = "paragraph_reflection"
USER_ID = "local_user"
MODEL = os.getenv("MODEL", "gemini-2.5-flash")

# The 1st agent generates the initial draft
generator = LlmAgent(
    name="DraftWriter",
    model=MODEL,
    description="Generates initial draft content on a given subject",
    instruction="Write a short, informative paragraph about the user's subject.",
    output_key="draft_text",
)

# The 2nd agent critiques the draft from the 1st agent
reviewer = LlmAgent(
    name="FactChecker",
    model=MODEL,
    description=(
        "Reviews a given text for factual accuracy and provides a structured critique"
    ),
    instruction="""
You are a meticulous fact-checker.
1. Read the text provided in the state key 'draft_text'
2. Carefully verify the factual accuracy of all claims.
3. Your final output must be a dictionary containing two keys:
- "Status": A string, either "ACCURATE" or "INACCURATE".
    - "Reasoning": A string providing a clear explanation for your status,
    citing specific issues if any are found.
    """,
    output_key="review_output",
)

# The sequentialAgent ensures the generator runs before the reviewer
review_pipeline = SequentialAgent(
    name="WriteAndReview_Pipeline",
    sub_agents=[generator, reviewer],
)


def _credentials_are_configured() -> bool:
    if os.getenv("GOOGLE_API_KEY"):
        return True
    return os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() == "true"


def _event_text(event) -> str:
    if event.output is not None:
        return str(event.output)
    if not event.content or not event.content.parts:
        return ""
    return "\n".join(part.text for part in event.content.parts if part.text)


def run_pipeline(subject: str) -> None:
    if not _credentials_are_configured():
        raise RuntimeError(
            "Set GOOGLE_API_KEY in your environment or .env before running this script."
        )

    runner = InMemoryRunner(agent=review_pipeline, app_name=APP_NAME)
    session_id = f"paragraph-{uuid4()}"
    runner.session_service.create_session_sync(
        app_name=APP_NAME,
        user_id=USER_ID,
        session_id=session_id,
    )

    message = types.Content(
        role="user",
        parts=[types.Part.from_text(text=subject)],
    )

    fallback_outputs = []
    for event in runner.run(
        user_id=USER_ID,
        session_id=session_id,
        new_message=message,
    ):
        if event.is_final_response():
            text = _event_text(event)
            if text:
                fallback_outputs.append(text)

    session = runner.session_service.get_session_sync(
        app_name=APP_NAME,
        user_id=USER_ID,
        session_id=session_id,
    )
    draft = session.state.get("draft_text") if session else None
    review = session.state.get("review_output") if session else None

    if draft:
        print("\n--- Draft ---")
        print(draft)
    if review:
        print("\n--- Review ---")
        print(review)
    if not draft and not review:
        print("\n".join(fallback_outputs))


if __name__ == "__main__":
    topic = " ".join(sys.argv[1:]).strip() or "large language models"
    try:
        run_pipeline(topic)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
