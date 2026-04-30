import discord
import os
import re
import asyncio
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

bot = discord.Client(intents=intents)

SCAN_KEYWORDS = ["free-picks", "vip-multis", "vip-value-picks"]
ADELAIDE_OFFSET = timedelta(hours=9, minutes=30)


def get_result(message):
    for reaction in message.reactions:
        emoji = str(reaction.emoji)

        if emoji in ["💰", "✅"]:
            return "win"
        if emoji == "❌":
            return "loss"
        if emoji in ["🔄", "↩️"]:
            return "void"

    return None


def parse_bet(message):
    text = message.content.lower()

    # Must have text/caption somewhere on the image message
    if not text.strip():
        return None

    # Finds stake anywhere:
    # 2U, 2.25U, 2 Units, 1.5 Unit
    stake_match = re.search(
        r"(\d+(?:\.\d+)?)\s*(?:u|unit|units)",
        text,
        re.IGNORECASE
    )

    # Finds odds anywhere:
    # @ 1.80, @1.80
    odds_match = re.search(
        r"@\s*(\d+(?:\.\d+)?)",
        text,
        re.IGNORECASE
    )

    if not stake_match or not odds_match:
        return None

    result = get_result(message)
    if result is None:
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
        "section": section
    }


def is_today_adelaide(message):
    now_adelaide = datetime.now(timezone.utc) + ADELAIDE_OFFSET
    msg_adelaide = message.created_at + ADELAIDE_OFFSET
    return msg_adelaide.date() == now_adelaide.date()


async def run_recap(guild):
    tracked_bets = []

    print("🔍 Scanning today’s channels...")

    for channel in guild.text_channels:
        if any(keyword in channel.name.lower() for keyword in SCAN_KEYWORDS):
            print(f"Scanning {channel.name}")

            async for msg in channel.history(limit=500):
                if not is_today_adelaide(msg):
                    continue

                bet = parse_bet(msg)
                if bet:
                    tracked_bets.append(bet)

    print(f"Found {len(tracked_bets)} bets today")

    if not tracked_bets:
        return "No bets found for today."

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
$100 bettor: ${total_profit * 100:.0f}

Rules:
- Hype + FOMO
- Say GREEN if profit, RED if loss
- Clean Discord formatting
- Keep it short
- End with:
Check out #vip-info to access our premium bets
"""

    response = client_ai.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    return response.choices[0].message.content


def find_results_channel(guild):
    for channel in guild.text_channels:
        if "result" in channel.name.lower():
            return channel
    return None


async def auto_post():
    await bot.wait_until_ready()

    while not bot.is_closed():
        now_adelaide = datetime.now(timezone.utc) + ADELAIDE_OFFSET
        print("⏱ Checking Adelaide time:", now_adelaide)

        if now_adelaide.hour == 21 and now_adelaide.minute == 45:
            print("🚀 TRIGGERED AUTO POST")

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
async def on_ready():
    print(f"📊 The Accountant is online as {bot.user}")
    asyncio.create_task(auto_post())


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


bot.run(TOKEN)