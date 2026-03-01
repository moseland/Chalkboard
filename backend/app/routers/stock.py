from fastapi import APIRouter, Depends, HTTPException, Query
import httpx
from app.core.config import settings
from app.core import security
from app.models import User

router = APIRouter()

@router.get("/search")
async def search_stock_photos(
    query: str = Query(..., min_length=1),
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(security.get_current_user)
):
    """Proxy search requests to Pexels API."""
    if not settings.PEXELS_API_KEY or settings.PEXELS_API_KEY == "your_pexels_api_key_here":
        raise HTTPException(status_code=500, detail="Pexels API key not configured")

    url = "https://api.pexels.com/v1/search"
    headers = {
        "Authorization": settings.PEXELS_API_KEY
    }
    params = {
        "query": query,
        "page": page,
        "per_page": per_page
    }

    try:
        async with httpx.AsyncClient() as client:
            print(f"Searching Pexels for: {query}, page: {page}")
            response = await client.get(url, headers=headers, params=params)
            print(f"Pexels Response Status: {response.status_code}")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        print(f"Pexels API Error: {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Pexels API error: {e.response.text}")
    except Exception as e:
        print(f"Unexpected error in stock search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock photos: {str(e)}")
