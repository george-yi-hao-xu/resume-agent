# deeper-search.py

import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
openai_api_key = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=openai_api_key)
model = os.environ.get("OPENAI_MODEL", "gpt-4o")

sys_msg = """
You are a professional researcher preparing a structured, data-driven report.
Focus on data-rich insights, use reliable sources, and include inline citations.
"""

usr_q = "Research the economic impact of semaglutide on global healthcare system."

request_params = {
    "model": model,
    "input": [
        {
            "role": "developer",
            "content": [
                {
                    "type": "input_text",
                    "text": sys_msg,
                }
            ]
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": usr_q
                }
            ]
        }
    ],
    "tools": [{"type": "web_search_preview"}],
}

if model.startswith(("o", "gpt-5")):
    request_params["reasoning"] = {"summary": "auto"}

res = client.responses.create(**request_params)

final_message = next((item for item in res.output if item.type == "message"), None)
final_content = (
    next(
        (
            content
            for content in getattr(final_message, "content", [])
            if content.type == "output_text"
        ),
        None,
    )
    if final_message
    else None
)

final_report = res.output_text
print(final_report)
print("--- CITATIONS ---")
anno = getattr(final_content, "annotations", None)

if not anno:
    print("No annotations found in the report.")
else:
    for i, citation in enumerate(anno):
        cited_txt = final_report[citation.start_index:citation.end_index]
        print(f"Citation {i + 1}:")
        print(f" Cited Text: {cited_txt}")
        print(f" Title: {citation.title}")
        print(f" URL: {citation.url}")
        print(f" Location: chars {citation.start_index} - {citation.end_index}")
        print("\n" + "="*50 + "\n")
print("--- INTERMEDIATE STEPS ---")
try:
    reasoning_step = next(item for item in res.output if item.type=="reasoning")
    print("\n[Found a Reasoning Step]")
    for summary_part in reasoning_step.summary:
        print(f" - {summary_part.text}")
except StopIteration:
    print("\n No reasoning steps found")

# web search call
try:
    search_step = next(item for item in res.output if item.type == "web_search_call")
    print("\n[Found a web search call]")
    action = getattr(search_step, "action", None)
    query = getattr(action, "query", None)
    print(f" Query executed: '{query}'")
    print(f" Status: {search_step.status}")
except StopIteration:
    print("\nNo web search steps found.")

# code interpreter
try:
    code_step = next(item for item in res.output if item.type == 'code_interpreter_call')
    print("\n[Found a code exec step]")
    print(" Code Input:")
    print(f" ```Python\n{code_step.input}\n```")
    print(" Code Output:")
    print(f" {code_step.output}")
except StopIteration:
    print("\n No code exec steps found")
