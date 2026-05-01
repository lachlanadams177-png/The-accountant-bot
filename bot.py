import discord
import os
import re
import asyncio
import json
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
OPENAI_KEY = os.getenv("OPENAI_API_KEY")

client_ai = OpenAI(api_key=OPENAI_KEY)

intents = discord.Intents.default()
intents.message_content = True
intents.reactions = True
intents.guilds = True

bot = discord.Client(intents=intents)

SCAN_KEYWORDS = ["free-picks", "vip-multis", "vip-value-picks"]
ADELAIDE_OFFSET = timedelta(hours=9, minutes=30)

# Render-safe local file
REACTION_LOG_FILE = "reaction_log.json"

RESULT_EMOJIS = {
    "💰": "win",
    "✅": "win",
    "❌": "loss",
    "🔄": "void",
    "↩️": "void"
}


def load_reaction_log():
    if not os.path.exists(REACTION_LOG_FILE):
        return {}

    with open(REACTION_LOG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_reaction_log(data):
    with open(REACTION_LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def now_utc():
    return datetime.now(timezone.utc)


def adelaide_now():
    return now_utc() + ADELAIDE_OFFSET


def message_within_hours(message, hours):
    return message.created_at >= now_utc() - timedelta(hours=48)


def parse_bet(message, result):
    text = message.content.lower()

    stake_match = re.search(
        r"(\d+(?:\.\d+)?)\s*(?:u|unit|units)\b",
        text,
        re.IGNORECASE
    )

    odds_match = re.search(
        r"@\s*(\d+(?:\.\d+)?)",
        text,
        re.IGNORECASE
    )

    if not stake_match or not odds_match:
        return None

    stake = float(stake_match.group(1))
    odds = float(odds_match.group(1))

    if result == "win":
        profit = stake * (odds - 1)
    elif result == "loss":
        profit = -stake
    else:
        profit = 0

    section = "VIP" if "vip" in message.channel.name.lower() else "FREE"

    return {
        "profit": profit,
        "result": result,
        "section": section,
        "stake": stake,
        "odds": odds,
        "channel": message.channel.name
    }


def find_results_channel(guild):
    for channel in guild.text_channels:
        if "result" in channel.name.lower():
            return channel
    return None


@bot.event
async def on_ready():
    print(f"📊 The Accountant is online as {bot.user}")
    asyncio.create_task(auto_post())


@bot.event
async def on_raw_reaction_add(payload):
    emoji = str(payload.emoji)

    if emoji not in RESULT_EMOJIS:
        return

    if bot.user and payload.user_id == bot.user.id:
        return

    print("🔥 REACTION DETECTED:", emoji)

    data = load_reaction_log()
    message_id = str(payload.message_id)

    data[message_id] = {
        "result": RESULT_EMOJIS[emoji],
        "emoji": emoji,
        "reacted_at": now_utc().isoformat(),
        "channel_id": payload.channel_id,
        "guild_id": payload.guild_id
    }

    save_reaction_log(data)
    print(f"✅ Logged reaction {emoji} on message {message_id}")


async def run_recap(guild):
    reaction_log = load_reaction_log()
    tracked_bets = []

    cutoff_reaction = now_utc() - timedelta(hours=17)

    print("🔍 Scanning bets from past 48 hours...")
    print("⏱ Counting reactions from past 17 hours only...")

    for channel in guild.text_channels:
        if any(keyword in channel.name.lower() for keyword in SCAN_KEYWORDS):
            print(f"Scanning {channel.name}")

            async for msg in channel.history(limit=500):
                if not message_within_hours(msg, 48):
                    continue

                msg_id = str(msg.id)

                if msg_id not in reaction_log:
                    continue

                reaction_data = reaction_log[msg_id]
                reacted_at = datetime.fromisoformat(reaction_data["reacted_at"])

                if reacted_at < cutoff_reaction:
                    continue

                bet = parse_bet(msg, reaction_data["result"])

                if bet:
                    tracked_bets.append(bet)

    print(f"Found {len(tracked_bets)} newly resulted bets")

    if not tracked_bets:
        return "No new resulted bets found."

    free_profit = sum(b["profit"] for b in tracked_bets if b["section"] == "FREE")
    vip_profit = sum(b["profit"] for b in tracked_bets if b["section"] == "VIP")
    total_profit = free_profit + vip_profit

    wins = sum(1 for b in tracked_bets if b["result"] == "win")
    losses = sum(1 for b in tracked_bets if b["result"] == "loss")
    voids = sum(1 for b in tracked_bets if b["result"] == "void")

    prompt = f"""
Write a hype Discord betting recap.

Free: {free_profit:.2f}U
VIP: {vip_profit:.2f}U
Total: {total_profit:.2f}U
Wins: {wins}, Losses: {losses}, Voids: {voids}
$50 bettor: ${total_profit * 50:.0f}

Rules:
- Hype + FOMO
- Say GREEN if profit, RED if loss
- Clean Discord formatting
- Keep it short
- Use "$50 bettor" NOT "$100 bettor"
- End with:
Check out #vip-info to access our premium bets
"""

    response = client_ai.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    return response.choices[0].message.content


async def auto_post():
    await bot.wait_until_ready()

    while not bot.is_closed():
        now_adl = adelaide_now()
        print("⏱ Checking Adelaide time:", now_adl)

        if now_adl.hour == 22 and now_adl.minute == 45:
            print("🚀 TRIGGERED 10:45PM DAILY RECAP")

            for guild in bot.guilds:
                recap = await run_recap(guild)
                results_channel = find_results_channel(guild)

                if results_channel:
                    await results_channel.send(
                        f"📊 **Daily Results Recap** 📊\n\n{recap}"
                    )
                else:
                    print("❌ Could not find results channel")

            await asyncio.sleep(60)

        await asyncio.sleep(20)


@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    if message.content.startswith("!testrecap"):
        recap = await run_recap(message.guild)
        results_channel = find_results_channel(message.guild)

        if results_channel:
            await results_channel.send(
                f"📊 **Daily Results Recap TEST** 📊\n\n{recap}"
            )
        else:
            await message.channel.send("❌ Could not find results channel")

    if message.content.startswith("!reactionlog"):
        data = load_reaction_log()
        await message.channel.send(f"📊 Logged reactions: {len(data)}")


bot.run(TOKEN)
