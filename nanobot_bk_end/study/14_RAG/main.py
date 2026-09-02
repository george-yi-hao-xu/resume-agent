# 14_RAG/main.py
import os
import requests
from typing import List, TypedDict
from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import OpenAIEmbeddings
from langchain_weaviate import WeaviateVectorStore
from langchain_openai import ChatOpenAI
from langchain_text_splitters import CharacterTextSplitter
from langgraph.graph import StateGraph, END

import weaviate

load_dotenv()

url = "https://raw.githubusercontent.com/hwchase17/chroma-langchain/refs/heads/master/state_of_the_union.txt"
res = requests.get(url)
with open("state_of_the_union.txt", "w", encoding="utf-8") as f:
    f.write(res.text)

loader = TextLoader("state_of_the_union.txt")
docs = loader.load()

text_splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)
chunks = text_splitter.split_documents(docs)
w_client = weaviate.connect_to_embedded(
    persistence_data_path="./weaviate_data",
    binary_path="./weaviate-embedded",
)
vectorstore = WeaviateVectorStore.from_documents(
    client=w_client,
    documents=chunks,
    embedding=OpenAIEmbeddings(),
)
retriever = vectorstore.as_retriever()
llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)

class RAGGraphState(TypedDict):
    question: str
    documents: List[Document]
    generation: str

def retrieve_documents_node(state: RAGGraphState) -> RAGGraphState:
    """Retrieves documents based on the user's question."""
    question = state["question"]
    documents = retriever.invoke(question)
    return {"question": question, "documents": documents, "generation": ""}

def generate_response_node(state: RAGGraphState)-> RAGGraphState:
    """Generate a response using the LLM based on retrieved documents."""
    question = state["question"]
    documents = state["documents"]
    # prompt temp
    temp = """You are an assistant for question-answering tasks.
    Use the following pieces of retrieved context to answer the question.
    If you don't know the answer, just say that you don't know.
    Use three sentences maximum and keep the answer concise.
    Question {question}
    Context: {context}
Answer:"""
    prompt = ChatPromptTemplate.from_template(temp)
    # Format the ctx from the docs
    ctx = "\n\n".join([doc.page_content for doc in documents])
    # Rag chain creation
    rag_chain = prompt | llm | StrOutputParser()
    # invoke
    generation = rag_chain.invoke({"context": ctx, "question": question})
    return {"question": question, "documents": documents, "generation": generation}

# Build the Graph
workflow = StateGraph(RAGGraphState)
# Add nodes
workflow.add_node("retrieve", retrieve_documents_node)
workflow.add_node("generate", generate_response_node)
# Set the entry pt
workflow.set_entry_point("retrieve")
# Add edges (transitions)
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)
# Compile
app = workflow.compile()

# --- Run the RAG App ---
if __name__ == "__main__":
    print("\n --- Running RAG Query ---")
    query = "What did the president say about Justin Trudeau?"
    inputs: RAGGraphState= {"question": query, "documents": [], "generation": ""}
    for stream in app.stream(inputs):
        print(stream)
    print("\n--- Running another RAG query")
    query_2 = "Who is Selen, an Italian actress?"
    inputs_2: RAGGraphState = {"question": query_2, "documents": [], "generation": ""}
    for stream in app.stream(inputs_2):
        print(stream)
