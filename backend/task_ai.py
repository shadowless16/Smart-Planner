# task_ai.py

import os
from dotenv import load_dotenv
import openai
from typing import List

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client
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
        text = resp.choices[0].message.content.strip()
        subtasks = [line.strip(" -•") for line in text.splitlines() if line.strip()]
        return subtasks[:4]
    except Exception as e:
        print("OpenAI error:", e)
        raise RuntimeError("AI suggestion failed")

def get_mood_based_tasks(mood_or_topic: str) -> List[str]:
    """
    Generate task suggestions based on user's mood or topic of interest.
    """
    try:
        prompt = f"""Based on the mood/topic '{mood_or_topic}', suggest 5 engaging and relevant tasks.
        If it's a mood (like 'energetic', 'tired', 'creative'), suggest appropriate tasks for that emotional state.
        If it's a topic (like 'coding', 'health', 'learning'), suggest focused tasks in that area.
        Make tasks specific and actionable.
        Format: Just the tasks, one per line."""

        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful AI that suggests personalized daily tasks based on moods or interests."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=200,
        )
        
        text = resp.choices[0].message.content.strip()
        tasks = [line.strip(" -•") for line in text.splitlines() if line.strip()]
        return tasks[:5]
    except Exception as e:
        print("OpenAI error:", e)
        raise RuntimeError("AI mood-based suggestion failed")
