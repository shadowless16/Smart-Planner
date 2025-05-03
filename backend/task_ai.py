# task_ai.py

import os
from dotenv import load_dotenv
import openai
from typing import List

# Load environment variables from .env file
load_dotenv()

# 1. Securely load your key – set as ENV var in production
openai_api_key = os.getenv("OPENAI_API_KEY")
client = openai.OpenAI(api_key=openai_api_key)

def suggest_subtasks(task_summary: str) -> List[str]:
    """
    Call OpenAI to get a list of subtasks.
    """
    try:
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that breaks tasks into subtasks."},
                {"role": "user",  "content": f"Break this task into 5 clear subtasks: {task_summary}"}
            ],
            temperature=0.7,
            max_tokens=150,
        )
        # Extract and split into lines
        text = resp.choices[0].message.content.strip()
        # Assume each subtask is on its own line
        subtasks = [line.strip(" -•") for line in text.splitlines() if line.strip()]
        return subtasks[:4]
    except Exception as e:
        # Log server-side, then bubble up a clean error
        print("OpenAI error:", e)
        raise RuntimeError("AI suggestion failed")
