import asyncio
import logging
import aiohttp
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import deepgram, openai, silero


# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def fetch_context_from_organization_id(organizationId:str) -> str:
    print(f"Fetching context for phone number: {organizationId}")
    async with aiohttp.ClientSession() as session:
        url = f"https://openmic-webfront-test.vercel.app/api/getContextOfUser?organizationId={organizationId}"
        async with session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                return data.get("context", "Unknown")
            else:
                return "Unknown"
            

async def entrypoint(ctx: JobContext):
    
    # Create an initial chat context with a system prompt
    initial_ctx = llm.ChatContext().append(
        role="system",
        text=(
            "You are a voice assistant created by Attack Capital. Your interface with users is voice, and you should "
            "respond with short, concise, and natural language. You are polite, helpful, and always ready to assist. "
            "If a user pauses during their speech, wait patiently for them to continue. If they remain silent for too "
            "long, politely prompt them by saying 'Is there anything else I can help you with?'. "
            "At the start of a conversation, introduce yourself and offer your assistance."
        ),
    )

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    print(f"Room name is: {ctx.room.name}") 

    organizationId = ctx.room.name.replace("call-","")
    print(f"organizationId is: {organizationId}")
    context = await fetch_context_from_organization_id(organizationId)
    print(f"Context is: {context}")
    initial_ctx.append(
        role="system",
        text=(
            context
        ),
    )
    

    # VoiceAssistant is a class that creates a full conversational AI agent.
    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=deepgram.STT(),
        llm=openai.LLM(),
        tts=openai.TTS(),
        chat_ctx=initial_ctx,
    )

    # Start the voice assistant with the LiveKit room
    # logger.info("Starting voice assistant")
    assistant.start(ctx.room)
   
    

    await asyncio.sleep(1)

    # Greets the user with an initial message
    # logger.info("Attempting to say greeting")
    await assistant.say("Hey, how can I help you today?", allow_interruptions=True)
    # logger.info("Greeting sent")

    # Keep the agent running
    while True:
        await asyncio.sleep(1)

if __name__ == "__main__":
    # logger.info("Starting LiveKit AI Agent")
    # Initialize the worker with the entrypoint
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))