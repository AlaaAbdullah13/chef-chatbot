from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
import base64

app = FastAPI(title="AI Chef Assistant 👨‍🍳")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Chef System Prompt
# ---------------------------------------------------------------------------
CHEF_SYSTEM_PROMPT = """You are Chef Alaa — a world-class, Michelin-star chef 👨‍🍳.

Your personality:
• You speak like a real, passionate chef — warm, encouraging, and full of culinary flair.
• You use short chef expressions like "Beautiful!", "Let's get cooking!", "Perfetto!" naturally.
• You remember everything the user told you earlier in this conversation.

Your rules:
1. ALWAYS guide the user step-by-step — NEVER skip steps.
2. First, ask what ingredients they have.
3. Then, suggest 2-3 dishes they can make.
4. Let THEM pick a dish before you start the recipe.
5. Give the recipe in numbered steps, one at a time if they want.
6. Adjust your tone based on the creativity setting:
   - Low creativity (0.0-0.3): Be precise, brief, professional — classic recipes only.
   - Medium creativity (0.4-0.6): Balanced — classic with small twists.
   - High creativity (0.7-1.0): Be adventurous, suggest bold flavor combos, fusion ideas!
7. Always respond in English.
8. If the user sends an image, identify the food/ingredients and comment on them.
"""

# ---------------------------------------------------------------------------
# In-memory conversation store  (session_id → list of messages)
# ---------------------------------------------------------------------------
conversations: dict[str, list] = {}


def get_conversation(session_id: str) -> list:
    """Return or create the conversation history for a session."""
    if session_id not in conversations:
        conversations[session_id] = []
    return conversations[session_id]


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str
    creativity: float = 0.7
    session_id: str = "default"


class ChatResponse(BaseModel):
    reply: str


class ResetResponse(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def home():
    return {"message": "Chef Backend is Running! 👨‍🍳"}


@app.post("/chat", response_model=ChatResponse)
async def chat_with_chef(req: ChatRequest):
    """Send a message to the AI Chef and get a response with full conversation context."""

    # Clamp creativity between 0 and 1
    temperature = max(0.0, min(1.0, req.creativity))

    # Create the LLM with the requested creativity
    llm = ChatOllama(
        model="llama3",
        temperature=temperature,
        base_url="http://localhost:11434",
    )

    # Build conversation history
    history = get_conversation(req.session_id)

    # Construct the full prompt with system + history + new message
    messages = [SystemMessage(content=CHEF_SYSTEM_PROMPT)]
    messages.extend(history)
    messages.append(HumanMessage(content=req.message))

    # Invoke the LLM
    response = llm.invoke(messages)

    # Store in conversation memory
    history.append(HumanMessage(content=req.message))
    history.append(AIMessage(content=response.content))

    return ChatResponse(reply=response.content)


@app.post("/chat-with-image", response_model=ChatResponse)
async def chat_with_image(
    message: str = Form(...),
    creativity: float = Form(0.7),
    session_id: str = Form("default"),
    image: UploadFile = File(None),
):
    """Chat endpoint that also accepts an image upload."""
    temperature = max(0.0, min(1.0, creativity))

    llm = ChatOllama(
        model="llama3",
        temperature=temperature,
        base_url="http://localhost:11434",
    )

    history = get_conversation(session_id)

    # Build content parts
    content_parts = message
    if image:
        image_data = await image.read()
        image_base64 = base64.b64encode(image_data).decode("utf-8")
        content_parts = [
            {"type": "text", "text": message},
            {
                "type": "image_url",
                "image_url": f"data:image/jpeg;base64,{image_base64}",
            },
        ]

    messages = [SystemMessage(content=CHEF_SYSTEM_PROMPT)]
    messages.extend(history)
    messages.append(HumanMessage(content=content_parts))

    response = llm.invoke(messages)

    # Store text-only version in history for context
    history.append(HumanMessage(content=message))
    history.append(AIMessage(content=response.content))

    return ChatResponse(reply=response.content)


@app.post("/reset", response_model=ResetResponse)
async def reset_conversation(session_id: str = "default"):
    """Clear the conversation history for a session."""
    if session_id in conversations:
        del conversations[session_id]
    return ResetResponse(status="Conversation cleared! Ready for a fresh start 🍳")