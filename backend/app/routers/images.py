import base64
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
import re
from app.core.config import settings
from app.core.security import get_current_user

router = APIRouter()

class ImageRequest(BaseModel):
    prompt: str
    provider: str
    model: str

from typing import Optional
class ImageEditRequest(BaseModel):
    image: str 
    mask: Optional[str] = None
    prompt: Optional[str] = None
    search_prompt: Optional[str] = None
    task: str = "erase" # erase, inpaint, remove-background, search-and-replace, outpaint, upscale
    # Outpaint parameters
    left: Optional[int] = 0
    right: Optional[int] = 0
    up: Optional[int] = 0
    down: Optional[int] = 0

async def _download_and_encode_image(url: str, client: httpx.AsyncClient) -> str:
    """Download an image from a URL and return a base64 encoded data URI."""
    for attempt in range(3):
        try:
            req = await client.get(url, timeout=30.0)
            req.raise_for_status()
            content_type = req.headers.get("Content-Type", "image/jpeg")
            encoded = base64.b64encode(req.content).decode("utf-8")
            return f"data:{content_type};base64,{encoded}"
        except Exception:
            if attempt == 2:
                raise
            import asyncio
            await asyncio.sleep(1)
    
    raise HTTPException(status_code=500, detail="Failed to fetch image payload.")

@router.post("/generate")
async def generate_image(request: ImageRequest, current_user = Depends(get_current_user)):
    if request.provider == "stability":
        if not settings.STABILITY_API_KEY:
            raise HTTPException(status_code=500, detail="Stability API Key not configured")
            
        async with httpx.AsyncClient() as client:
            try:
                # Map models to their respective APIs, default to core
                api_url = "https://api.stability.ai/v2beta/stable-image/generate/core"
                if request.model == "sd3-large" or request.model == "sd3-large-turbo" or request.model == "sd3-medium":
                    api_url = "https://api.stability.ai/v2beta/stable-image/generate/sd3"
                elif request.model == "ultra":
                    api_url = "https://api.stability.ai/v2beta/stable-image/generate/ultra"
                elif request.model == "stable-diffusion-xl-1024-v1-0":
                    api_url = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image"
                
                # SDXL uses the v1 JSON api
                if "v1" in api_url:
                    response = await client.post(
                        api_url,
                        headers={
                            "Authorization": f"Bearer {settings.STABILITY_API_KEY}",
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        json={
                            "text_prompts": [
                                { "text": request.prompt }
                            ]
                        },
                        timeout=30.0
                    )
                    
                    if response.status_code != 200:
                        raise HTTPException(status_code=response.status_code, detail=f"Stability AI Error: {response.text}")
                        
                    data = response.json()
                    # Return the first artifact
                    if "artifacts" in data and len(data["artifacts"]) > 0:
                        return {"image": f"data:image/png;base64,{data['artifacts'][0]['base64']}"}
                    raise HTTPException(status_code=500, detail="Stability API returned no image.")
                
                # Others use v2 multipart data 
                else: 
                    # Set model payload if using the generic SD3 endpoint
                    data_payload = {
                        "prompt": request.prompt,
                        "output_format": "jpeg",
                    }
                    if "sd3" in api_url:
                         data_payload["model"] = request.model
                         
                    response = await client.post(
                        api_url,
                        headers={
                            "authorization": f"Bearer {settings.STABILITY_API_KEY}",
                            "accept": "application/json"
                        },
                        files={"none": ''}, # Requires multipart data for stability v2
                        data=data_payload,
                        timeout=30.0
                    )
                    
                    if response.status_code != 200:
                        raise HTTPException(status_code=response.status_code, detail=f"Stability AI Error: {response.text}")
                        
                    data = response.json()
                    return {"image": f"data:image/jpeg;base64,{data.get('image')}"}
                    
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
                
    elif request.provider == "openrouter":
         if not settings.OPENROUTER_API_KEY:
             raise HTTPException(status_code=500, detail="OpenRouter API Key not configured")
             
         async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": request.model,
                        "messages": [{"role": "user", "content": request.prompt}]
                    },
                    timeout=60.0
                )
                
                if response.status_code != 200:
                     raise HTTPException(status_code=response.status_code, detail=f"OpenRouter Error: {response.text}")
                     
                data = response.json()
                message = data.get("choices", [])[0].get("message", {})
                
                # Check for direct images array in OpenRouter's response (used by Gemini models)
                images_list = message.get("images", [])
                if images_list and len(images_list) > 0:
                    image_data = images_list[0].get("image_url", {})
                    img_url = image_data.get("url", "") if isinstance(image_data, dict) else image_data
                    
                    if img_url.startswith("data:image"):
                        return {"image": img_url}
                    elif img_url.startswith("http"):
                        b64_img = await _download_and_encode_image(img_url, client)
                        return {"image": b64_img}

                content = message.get("content", "")
                
                # OpenRouter usually returns image generation models as markdown URLs 
                # extract URL using regex.
                match = re.search(r'(https?://[^\s)]+)', content)
                url = match.group(1) if match else content.strip()
                
                if not url.startswith("http"):
                    # For base64 string directly
                    if content.startswith("data:image"):
                        return {"image": content}
                    raise HTTPException(status_code=500, detail=f"Could not extract image URL from OpenRouter response: {content[:100]}...")
                
                # Image found via URL, we should download it and pass base64 to frontend
                b64_img = await _download_and_encode_image(url, client)
                return {"image": b64_img}
            
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Unknown provider")

@router.post("/edit")
async def edit_image(request: ImageEditRequest, current_user = Depends(get_current_user)):
    if not settings.STABILITY_API_KEY:
        raise HTTPException(status_code=500, detail="Stability API Key not configured")

    # Clean base64 headers if present
    img_b64 = request.image.split(",")[1] if "," in request.image else request.image
    img_bytes = base64.b64decode(img_b64)
    
    files = {"image": ("image.png", img_bytes, "image/png")}
    data = {}
    
    api_url = ""
    if request.task == "remove-background":
        api_url = "https://api.stability.ai/v2beta/stable-image/edit/remove-background"
        data = {"output_format": "webp"}
    elif request.task == "inpaint":
        api_url = "https://api.stability.ai/v2beta/stable-image/edit/inpaint"
        if not request.mask or not request.prompt:
            raise HTTPException(status_code=400, detail="inpaint requires mask and prompt")
        mask_b64 = request.mask.split(",")[1] if "," in request.mask else request.mask
        files["mask"] = ("mask.png", base64.b64decode(mask_b64), "image/png")
        data = {"prompt": request.prompt, "output_format": "jpeg"}
    elif request.task == "search-and-replace":
        api_url = "https://api.stability.ai/v2beta/stable-image/edit/search-and-replace"
        if not request.search_prompt or not request.prompt:
            raise HTTPException(status_code=400, detail="search-and-replace requires search_prompt and prompt")
        data = {"prompt": request.prompt, "search_prompt": request.search_prompt, "output_format": "jpeg"}
    elif request.task == "erase":
        api_url = "https://api.stability.ai/v2beta/stable-image/edit/erase"
        if not request.mask:
            raise HTTPException(status_code=400, detail="erase requires mask")
        mask_b64 = request.mask.split(",")[1] if "," in request.mask else request.mask
        files["mask"] = ("mask.png", base64.b64decode(mask_b64), "image/png")
        data = {"output_format": "jpeg"}
    elif request.task == "outpaint":
        api_url = "https://api.stability.ai/v2beta/stable-image/edit/outpaint"
        data = {
            "output_format": "jpeg",
            "prompt": request.prompt or "Extrapolate the image background",
            "left": request.left,
            "right": request.right,
            "up": request.up,
            "down": request.down
        }
    elif request.task == "upscale":
        api_url = "https://api.stability.ai/v2beta/stable-image/upscale/fast"
        data = {"output_format": "jpeg"}
    elif request.task == "sketch":
        api_url = "https://api.stability.ai/v2beta/stable-image/control/sketch"
        data = {"prompt": request.prompt or "Refine this sketch", "output_format": "jpeg", "control_strength": 0.7}
    elif request.task == "structure":
        api_url = "https://api.stability.ai/v2beta/stable-image/control/structure"
        data = {"prompt": request.prompt or "Refine this structure", "output_format": "jpeg", "control_strength": 0.7}
    else:
        raise HTTPException(status_code=400, detail="Unknown task")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                api_url,
                headers={
                    "authorization": f"Bearer {settings.STABILITY_API_KEY}",
                    "accept": "application/json"
                },
                files=files,
                data=data,
                timeout=60.0
            )

            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Stability AI Error: {response.text}")

            res_data = response.json()
            b64 = res_data.get("image")
            if not b64:
                raise HTTPException(status_code=500, detail="No image returned")
                
            ext = "webp" if request.task == "remove-background" else "jpeg"
            return {"image": f"data:image/{ext};base64,{b64}"}
            
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

