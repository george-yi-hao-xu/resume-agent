# crew-ai_finance.py

import os
import logging
from crewai import Agent, Task, Crew
from crewai.tools import tool

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# --- 1. Refactored Tool: returns clean data ---
@tool("Stock Price Lookup Tool")
def get_stock_price(ticker: str) -> float:
    """
Fetches the latest simulated stock price for a given stock ticker symbol.
Returns the price as a float. Raises a ValueError if the ticker is not found.
    """
    logging.info(f"Tool Call: get_stock_price for ticker '{ticker}'")
    # mock
    simulated_prices = {
        "AAPL": 178.15,
        "GOOGL": 1750.30,
        "MSFT": 425.50
    }
    price = simulated_prices.get(ticker.upper())
    if price is not None:
        return price
    raise ValueError(f"Simulated price for ticker '{ticker.upper()}' not found")

# --- 2. Define the Agent ---
financial_analyst_agent = Agent(
    role="Senior Financial Analyst",
    goal="Analyze stock data using provided tools and report key prices",
    backstory=(
        "You are an experienced financial analyst adept at using data sources "
    ),
    verbose=True,
    tools=[get_stock_price],
    allow_delegation=False,
)

# --- 3. Refined Task ---
analyze_aapl_task = Task(
    description=(
        "What is the current simulated stock price for Apple (ticker:AAPL)? "
        "Use the 'Stock Price Lookup Tool' to find it."
        "If the ticker is not found, you must report that you were unable to "
        "retrieve the price."
    ),
    expected_output=(
        "A single, clear sentence stating the simulated stock price for AAPL. "
        "For example: 'The simulated stock price for AAPL is $178.15.'"
        "If the price cannot be found, state that clearly."
    ),
    agent=financial_analyst_agent,
)

# --- 4. Formulate the Crew ---
financial_crew = Crew(
    agents=[financial_analyst_agent],
    tasks=[analyze_aapl_task],
    verbose=True,
)

def main():
    """Main function to run the crew."""
    if not os.environ.get("OPENAI_API_KEY"):
        print("ERROR: The OPENAI_API_KEY env var is not set")
        return
    print("\n## Starting the Financial Crew...")
    print("---------------------------------")
    result = financial_crew.kickoff()
    print("\n------------------------------")
    print("## Crew execution finished.")
    print("\nFinal Result:\n", result)

if __name__ == "__main__":
    main()
