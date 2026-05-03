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

SCAN_CHANNEL_KEYWORDS = ["free-picks", "vip-multis", "vip-value-picks"]
RESULTS_CHANNEL_KEYWORD = "results"
ANNOUNCEMENTS_CHANNEL_KEYWORD = "announcements"

ADELAIDE_OFFSET = timedelta(hours=9, minutes=30)

BET_LOG_FILE = "bet_log.json"
DAILY_LOG_FILE = "daily_log.json"
SERVER_STATS_FILE = "server_stats.json"

SERVER_STARTING_PROFIT = 13.05
UNIT_VALUE = 50

RESULT_EMOJIS = {
    "💰": "win",
    "✅": "win",
    "❌": "loss",
    "🔄": "void",
    "↩️": "void"
}


def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def now_utc():
    return datetime.now(timezone.utc)


def adelaide_now():
    return now_utc() + ADELAIDE_OFFSET


def to_adelaide(dt):
    return dt + ADELAIDE_OFFSET


def today_key():
    return adelaide_now().strftime("%Y-%m-%d")


def is_bet_channel(channel_name):
    name = channel_name.lower()
    return any(k in name for k in SCAN_CHANNEL_KEYWORDS)


def find_channel(guild, keyword):
    for channel in guild.text_channels:
        if keyword.lower() in channel.name.lower():
            return channel
    return None


def parse_units(text):
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:u|unit|units)\b", text, re.I)
    return float(match.group(1)) if match else None


def parse_odds(text):
    match = re.search(r"@\s*(\d+(?:\.\d+)?)", text, re.I)
    return float(match.group(1)) if match else None


def calc_profit(stake, odds, result):
    if result == "win":
        return round(stake * (odds - 1), 2)
    if result == "loss":
        return round(-stake, 2)
    return 0.0


def load_bets():
    return load_json(BET_LOG_FILE, {})


def save_bets(data):
    save_json(BET_LOG_FILE, data)


def load_daily():
    return load_json(DAILY_LOG_FILE, {})


def save_daily(data):
    save_json(DAILY_LOG_FILE, data)


def load_stats():
    return load_json(SERVER_STATS_FILE, {
        "server_total_profit": SERVER_STARTING_PROFIT,
        "counted_days": []
    })


def save_stats(data):
    save_json(SERVER_STATS_FILE, data)


def summarize(bets):
    free = round(sum(b["profit"] for b in bets if b["section"] == "FREE"), 2)
    vip = round(sum(b["profit"] for b in bets if b["section"] == "VIP"), 2)
    total = round(free + vip, 2)
    wins = sum(1 for b in bets if b["result"] == "win")
    losses = sum(1 for b in bets if b["result"] == "loss")
    voids = sum(1 for b in bets if b["result"] == "void")
    return free, vip, total, wins, losses, voids


def weekly_window():
    now = adelaide_now()
    monday = now - timedelta(days=now.weekday())
    start = monday.replace(hour=4, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=6, hours=18)
    return start, end


async def build_daily_post(bets):
    if not bets:
        return "No settled bets found today."

    free, vip, total, wins, losses, voids = summarize(bets)

    prompt = f"""
Write a short Discord betting daily recap.

Free: {free:.2f}U
VIP: {vip:.2f}U
Total: {total:.2f}U
Wins: {wins}, Losses: {losses}, Voids: {voids}
$50 bettor: ${total * UNIT_VALUE:.0f}

Rules:
- Clean Discord format
- Hype if green
- Calm and confident if red
- Mention bankroll and consistency if red
- Keep it short
- End with: Check out #vip-info to access our premium bets
"""

    res = client_ai.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}]
    )
    return res.choices[0].message.content


async def build_weekly_post(bets, server_total):
    if not bets:
        return (
            f"No weekly results found.\n\n"
            f"📊 Total Server Profit: {server_total:+.2f}U\n"
            f"💰 That’s {server_total * UNIT_VALUE:+.0f} total server profit for a $50 bettor."
        )

    free, vip, total, wins, losses, voids = summarize(bets)

    prompt = f"""
Write a weekly Discord betting results recap.

Free: {free:.2f}U
VIP: {vip:.2f}U
Weekly Profit: {total:.2f}U
Wins: {wins}, Losses: {losses}, Voids: {voids}
$50 bettor weekly result: ${total * UNIT_VALUE:.0f}

Total Server Profit: {server_total:.2f}U
$50 bettor total server profit: ${server_total * UNIT_VALUE:.0f}

Rules:
- Clean Discord format
- Big hype if profitable
- If negative, stay confident and say we rebuild, stay consistent, and keep growing the bankroll
- Mention: Total Server Profit: {server_total:+.2f}U
- Mention: That’s {server_total * UNIT_VALUE:+.0f} total server profit for a $50 bettor
- Keep it powerful but not too long
- End with: Check out #vip-info to access our premium bets
"""

    res = client_ai.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}]
    )
    return res.choices[0].message.content


async def fetch_message_from_payload(payload):
    channel = bot.get_channel(payload.channel_id)
    if channel is None:
        return None
    try:
        return await channel.fetch_message(payload.message_id)
    except Exception as e:
        print("Could not fetch message:", e)
        return None


@bot.event
async def on_ready():
    print(f"📊 The Accountant is online as {bot.user}")
    asyncio.create_task(auto_loop())


@bot.event
async def on_raw_reaction_add(payload):
    emoji = str(payload.emoji)

    if emoji not in RESULT_EMOJIS:
        return

    if bot.user and payload.user_id == bot.user.id:
        return

    message = await fetch_message_from_payload(payload)
    if message is None:
        return

    if not is_bet_channel(message.channel.name):
        return

    text = message.content or ""
    stake = parse_units(text)
    odds = parse_odds(text)

    if stake is None or odds is None:
        print("Ignored reaction: no stake or odds in message.")
        return

    result = RESULT_EMOJIS[emoji]
    profit = calc_profit(stake, odds, result)
    section = "VIP" if "vip" in message.channel.name.lower() else "FREE"

    bets = load_bets()
    msg_id = str(message.id)

    bets[msg_id] = {
        "message_id": msg_id,
        "channel_name": message.channel.name,
        "section": section,
        "stake": stake,
        "odds": odds,
        "result": result,
        "profit": profit,
        "message_created_at_utc": message.created_at.isoformat(),
        "resulted_at_utc": now_utc().isoformat(),
        "content_preview": text[:300]
    }

    save_bets(bets)
    print(f"✅ Saved result {result} | {stake}U @ {odds} | {profit:+.2f}U")


@bot.event
async def on_raw_reaction_remove(payload):
    emoji = str(payload.emoji)

    if emoji not in RESULT_EMOJIS:
        return

    bets = load_bets()
    msg_id = str(payload.message_id)

    if msg_id in bets:
        del bets[msg_id]
        save_bets(bets)
        print(f"🗑 Removed result for message {msg_id}")


def get_bets_resulted_between(start_adl, end_adl):
    bets = load_bets()
    results = []

    for b in bets.values():
        resulted_utc = datetime.fromisoformat(b["resulted_at_utc"])
        resulted_adl = to_adelaide(resulted_utc)

        if start_adl <= resulted_adl <= end_adl:
            results.append(b)

    return results


def get_today_bets():
    now = adelaide_now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = now
    return get_bets_resulted_between(start, end)


def add_today_to_server_total(total):
    stats = load_stats()
    key = today_key()

    if key not in stats["counted_days"]:
        stats["server_total_profit"] = round(stats["server_total_profit"] + total, 2)
        stats["counted_days"].append(key)
        save_stats(stats)

    return stats["server_total_profit"]


async def post_daily(guild, update_total=True):
    bets = get_today_bets()
    _, _, total, _, _, _ = summarize(bets) if bets else (0, 0, 0, 0, 0, 0)

    if update_total:
        add_today_to_server_total(total)

    post = await build_daily_post(bets)
    channel = find_channel(guild, RESULTS_CHANNEL_KEYWORD)

    if channel:
        await channel.send(f"📊 **Daily Results Recap** 📊\n\n{post}")


async def post_weekly(guild):
    start, end = weekly_window()
    bets = get_bets_resulted_between(start, end)
    stats = load_stats()
    post = await build_weekly_post(bets, stats["server_total_profit"])

    channel = find_channel(guild, ANNOUNCEMENTS_CHANNEL_KEYWORD)
    if channel:
        await channel.send(f"🔥 **WEEKLY RESULTS RECAP** 🔥\n\n{post}")


async def auto_loop():
    await bot.wait_until_ready()

    last_daily_post = None
    last_weekly_post = None

    while not bot.is_closed():
        now = adelaide_now()
        key = now.strftime("%Y-%m-%d")

        if now.hour == 22 and now.minute == 45:
            if last_daily_post != key:
                for guild in bot.guilds:
                    await post_daily(guild, update_total=True)

                    if now.weekday() == 6 and last_weekly_post != key:
                        await post_weekly(guild)
                        last_weekly_post = key

                last_daily_post = key

            await asyncio.sleep(60)

        await asyncio.sleep(20)


@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    if message.content.startswith("!testrecap"):
        await post_daily(message.guild, update_total=False)

    if message.content.startswith("!testweekly"):
        await post_weekly(message.guild)

    if message.content.startswith("!betlog"):
        bets = load_bets()
        await message.channel.send(f"📊 Tracked settled bets: {len(bets)}")

    if message.content.startswith("!today"):
        bets = get_today_bets()
        free, vip, total, wins, losses, voids = summarize(bets) if bets else (0, 0, 0, 0, 0, 0)
        await message.channel.send(
            f"📊 Today\nFree: {free:+.2f}U\nVIP: {vip:+.2f}U\n"
            f"Total: {total:+.2f}U\nRecord: {wins}W / {losses}L / {voids}V"
        )

    if message.content.startswith("!weekly"):
        start, end = weekly_window()
        bets = get_bets_resulted_between(start, end)
        free, vip, total, wins, losses, voids = summarize(bets) if bets else (0, 0, 0, 0, 0, 0)
        await message.channel.send(
            f"📊 Weekly\nFree: {free:+.2f}U\nVIP: {vip:+.2f}U\n"
            f"Total: {total:+.2f}U\nRecord: {wins}W / {losses}L / {voids}V"
        )

    if message.content.startswith("!servertotal"):
        stats = load_stats()
        total = stats["server_total_profit"]
        await message.channel.send(
            f"📊 Total Server Profit: {total:+.2f}U\n"
            f"💰 That’s {total * UNIT_VALUE:+.0f} total server profit for a $50 bettor."
        )

    if message.content.startswith("!setservertotal"):
        parts = message.content.split()
        if len(parts) >= 2:
            try:
                new_total = float(parts[1])
                stats = load_stats()
                stats["server_total_profit"] = new_total
                save_stats(stats)
                await message.channel.send(f"✅ Server total set to {new_total:+.2f}U")
            except ValueError:
                await message.channel.send("❌ Use: !setservertotal 13.05")


bot.run(TOKEN)
