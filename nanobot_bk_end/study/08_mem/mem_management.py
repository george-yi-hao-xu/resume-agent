from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, MessagesState, StateGraph


def call_model(state: MessagesState) -> dict:
    latest_message = state["messages"][-1].content
    return {"messages": [AIMessage(content=f"Received: {latest_message}")]}


workflow = StateGraph(MessagesState)
workflow.add_node("model", call_model)
workflow.add_edge(START, "model")

memory = InMemorySaver()
app = workflow.compile(checkpointer=memory)

config = {"configurable": {"thread_id": "demo-session"}}

app.invoke(
    {"messages": [{"role": "user", "content": "I'm heading to New York next week."}]},
    config,
)
result = app.invoke(
    {"messages": [{"role": "user", "content": "What's the weather like?"}]},
    config,
)

print(result["messages"])
