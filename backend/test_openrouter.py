import asyncio
import httpx
import os
import json
from dotenv import load_dotenv

load_dotenv()

async def test_openrouter():
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        print("No OPENROUTER_API_KEY found")
        return
        
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "google/gemini-3.1-flash-image-preview",
                "messages": [{"role": "user", "content": "A cute cat eating a watermelon"}]
            },
            timeout=30.0
        )
        print("Status:", response.status_code)
        try:
            print("Response:", json.dumps(response.json(), indent=2))
        except:
            print("Response Text:", response.text)

if __name__ == "__main__":
    asyncio.run(test_openrouter())
