"""Human-in-the-loop technical support agent backed by OpenAI."""

import os
import sys
from pathlib import Path
from typing import Optional
from uuid import uuid4

from dotenv import load_dotenv
from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.labs.openai import OpenAILlm
from google.adk.models import LlmRequest, LlmResponse
from google.adk.runners import InMemoryRunner
from google.genai import types

load_dotenv(Path(__file__).resolve().parents[3] / ".env")
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
APP_NAME = "technical_support_hitl"
USER_ID = "local_user"


def _openai_credentials_are_configured() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def troubleshoot_issue(issue: str):
    return {"status": "success", "report": f"Troubleshooting steps for {issue}."}


def create_ticket(issue_type: str, details: str) -> dict:
    return {"status": "success", "ticket_id": "TICKET123"}


def escalate_to_human(issue_type: str) -> dict:
    return {
        "status": "success",
        "message": f"Escalated {issue_type} to a human specialist.",
    }


def personalization_cb(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> Optional[LlmResponse]:
    """Adds personalization information to the LLM request."""
    customer_info = callback_context.state.get("customer_info")
    if customer_info:
        customer_name = customer_info.get("name", "valued customer")
        customer_tier = customer_info.get("tier", "standard")
        recent_purchases = customer_info.get("recent_purchases", [])
        personalization_note = (
            "\nIMPORTANT PERSONALIZATION:\n"
            f"Customer Name: {customer_name}\n"
            f"Customer Tier: {customer_tier}\n"
        )
        if recent_purchases:
            personalization_note += f"Recent Purchases: {', '.join(recent_purchases)}\n"
        if llm_request.contents:
            system_content = types.Content(
                role="system",
                parts=[types.Part(text=personalization_note)],
            )
            llm_request.contents.insert(0, system_content)
    return None


technical_support_agent = Agent(
    name="technical_support_specialist",
    model=OpenAILlm(model=OPENAI_MODEL),
    instruction="""
You are a technical support specialist for our electronics company.
FIRST, check if the user has a support history in
state["customer_info"]["support_history"].
If they do, reference this history in your responses.
For technical issues:
1. Use the troubleshoot_issue tool to analyze the problem.
2. Guide the user through basic troubleshooting steps.
3. If the issue persists, use create_ticket to log the issue.
For complex issues beyond basic troubleshooting:
1. Use escalate_to_human to transfer to a human specialist.
Maintain a professional but empathetic tone.
Acknowledge the frustration technical issues can cause,
while providing clear steps toward resolution.
""",
    tools=[troubleshoot_issue, create_ticket, escalate_to_human],
    before_model_callback=personalization_cb,
)

root_agent = technical_support_agent


def _event_text(event) -> str:
    if event.output is not None:
        return str(event.output)
    if not event.content or not event.content.parts:
        return ""
    return "\n".join(part.text for part in event.content.parts if part.text)


def run_support_session(issue: str) -> None:
    if not _openai_credentials_are_configured():
        raise RuntimeError(
            "Set OPENAI_API_KEY in your environment or .env before running this script."
        )

    runner = InMemoryRunner(agent=technical_support_agent, app_name=APP_NAME)
    session_id = f"hitl-{uuid4()}"
    runner.session_service.create_session_sync(
        app_name=APP_NAME,
        user_id=USER_ID,
        session_id=session_id,
        state={
            "customer_info": {
                "name": "Alex Chen",
                "tier": "premium",
                "recent_purchases": ["Noise Cancelling Headphones"],
                "support_history": [
                    "Reported intermittent Bluetooth disconnects last month."
                ],
            }
        },
    )

    message = types.Content(
        role="user",
        parts=[types.Part.from_text(text=issue)],
    )

    final_outputs = []
    for event in runner.run(
        user_id=USER_ID,
        session_id=session_id,
        new_message=message,
    ):
        if event.is_final_response():
            text = _event_text(event)
            if text:
                final_outputs.append(text)

    print("\n".join(final_outputs))


if __name__ == "__main__":
    user_issue = " ".join(sys.argv[1:]).strip()
    if not user_issue:
        user_issue = "My headphones keep disconnecting from Bluetooth."
    try:
        run_support_session(user_issue)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
