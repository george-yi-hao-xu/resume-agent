# study/04_reflect/factorial.py

import os
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

load_dotenv()

if not os.getenv("OPENAI_API_KEY"):
    raise ValueError("OPENAI_API_KEY is not set")

llm = ChatOpenAI(model="gpt-4o", temperature=0.1)
def run_reflection_loop():
    task_prompt = """
Your task is to create a Python function named `calculat_factorial`.
This function should do the following:
1. Accept a single integer `n` as input
2. Calculate its factorial (n!).
3. Include a clear docstring explaining what the function does.
4. Handle edge cases: The factorial of 0 is 1.
5. Handle invalid input: Raise a ValueError if the input is a negative number.
"""
    max_iteration = 3
    current_code = ""
    msg_history = [HumanMessage(content=task_prompt)]

    for i in range(max_iteration):
        print("\n" + "=" * 25 + f" REFLECTION LOOP: ITERATION {i + 1}" + "=" * 25)
        if i == 0:
            print("\n>>> STAGE 1: GENERATING initial code...")
            res = llm.invoke(msg_history)
            current_code = str(res.content)
        else:
            print("\n>>> STAGE 1: Refining code based on previous critique...")
            msg_history.append(
                HumanMessage(
                    content="Please refine the code using the critiques provided."
                )
            )
            res = llm.invoke(msg_history)
            current_code = str(res.content)
        print("\n--- Generated Code (v" + str(i + 1) + ") ---\n" + current_code)
        msg_history.append(res)

        # --- 2. REFLECT STAGE ---
        print("\n>>> STAGE 2: REFLECTING on the generated code...")
        reflector_prompt = [
            SystemMessage(content="""
You are a senior software engineer and an expert in Python.
Your role is to perform a meticulous code review.
Critically evaluate the provided Python code based on the original task requirements.
Look for bugs, style issues, missing edge cases, and areas for improvement.
If the code is perfect and meets all requirements,
respond with the single phrase 'CODE_IS_PERFECT'.
Otherwise, provide a bulleted list of your critiques.
    """),
            HumanMessage(
                content=f"Original Task:\n{task_prompt}\n\nCode to Review:\n{current_code}"
            )
        ]
        crit_res = llm.invoke(reflector_prompt)
        crit = crit_res.content

        # --- 3. STOPPING CONDITION ---
        if "CODE_IS_PERFECT" in crit:
            print("\n --- Critique ---\n No further critiques found. "
                "The code is satisfactory"
                )
            break
        print("\n --- Critique --- \n" + str(crit))
        msg_history.append(
            HumanMessage(content=f"Critique of the previous code:\n{crit}")
        )

    print("\n" + "="*30 + " FINAL RESULT " + "="*30)
    print("\n Final refined code after the reflection process:\n")
    print(current_code)

if __name__ == "__main__":
    run_reflection_loop()
