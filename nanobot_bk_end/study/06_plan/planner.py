# planner.py

import os
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process, LLM
from langchain_openai import ChatOpenAI

load_dotenv()
llm = LLM(model="gpt-4-turbo", provider="openai")

# define a clear and focused agent
planner_writer_agent = Agent(
    role="Article Planner and Writer",
    goal=(
        "Plan and then write a concise, engaging summary on a "
        "specified topic."
    ),
    backstory=(
        "You are an expert technical writer and content strategist. "
        "Your strength lies in creating a clear, actionable plan before writing, "
        "ensuring the final summary is both informative and easy to digest."
    ),
    verbose=True,
    allow_delegation=False,
    llm=llm
)

# define a TASK
topic = "The importance of Reinforcement Learning in AI"
high_lv_task = Task(
    description=(
        f"1. Create a bullet-point plan for a summary on the topic: '{topic}'.\n"
        f"2. Write the summary based on your plan, keeping it around 200 words."
    ),
    expected_output=(
        "A final report containing two distinct sections:\n\n"
        "### Plan\n"
        "- A bulleted list outlining the main points of the summary.\n\n"
        "### Summary\n"
        "- A concise and well-structured summary of the topic."
    ),
    agent=planner_writer_agent
)

# Create a crew
c = Crew(
    agents=[planner_writer_agent],
    tasks=[high_lv_task],
    process=Process.sequential,
)

if __name__ == "__main__":
    print(c.kickoff())
