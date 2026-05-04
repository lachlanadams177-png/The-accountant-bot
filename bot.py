import discord
import os
import re
import asyncio
import json
import base64
import io
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
client_ai = OpenAI(api_key=OPENAI_KEY) if OPENAI_KEY else None

intents = discord.Intents.default()
intents.message_content = True
intents.reactions = True
intents.guilds = True
intents.members = True

bot = discord.Client(intents=intents)

SCAN_CHANNEL_KEYWORDS = ["free-picks", "vip-multis", "vip-value-picks"]
RESULTS_CHANNEL_KEYWORD = "results"
ANNOUNCEMENTS_CHANNEL_KEYWORD = "announcements"

FREE_CHANNEL_KEYWORD = "free-picks"
VIP_MULTI_CHANNEL_KEYWORD = "vip-multis"
VIP_VALUE_CHANNEL_KEYWORD = "vip-value-picks"

ADELAIDE_OFFSET = timedelta(hours=9, minutes=30)

BET_LOG_FILE = "bet_log.json"
SERVER_STATS_FILE = "server_stats.json"

SERVER_STARTING_PROFIT = 13.05
UNIT_VALUE = 50

FRESH_START_UTC = datetime(2026, 5, 4, 0, 0, tzinfo=timezone.utc)

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


def load_bets():
    return load_json(BET_LOG_FILE, {})


def save_bets(data):
    save_json(BET_LOG_FILE, data)


def load_stats():
    return load_json(SERVER_STATS_FILE, {
        "server_total_profit": SERVER_STARTING_PROFIT,
        "counted_days": []
    })


def save_stats(data):
    save_json(SERVER_STATS_FILE, data)


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


async def user_can_control(message_or_payload):
    if hasattr(message_or_payload, "guild") and hasattr(message_or_payload, "author"):
        member = message_or_payload.author
        return member.guild_permissions.manage_messages or member.guild_permissions.administrator

    guild = bot.get_guild(message_or_payload.guild_id)
    user_id = message_or_payload.user_id

    if guild is None:
        return False

    member = guild.get_member(user_id)
    if member is None:
        try:
            member = await guild.fetch_member(user_id)
        except Exception:
            return False

    return member.guild_permissions.manage_messages or member.guild_permissions.administrator


async def fetch_message_from_payload(payload):
    channel = bot.get_channel(payload.channel_id)
    if channel is None:
        return None
    try:
        return await channel.fetch_message(payload.message_id)
    except Exception as e:
        print("Could not fetch message:", e)
        return None


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
    return get_bets_resulted_between(start, now)


def add_today_to_server_total(total):
    stats = load_stats()
    key = today_key()

    if key not in stats["counted_days"]:
        stats["server_total_profit"] = round(stats["server_total_profit"] + total, 2)
        stats["counted_days"].append(key)
        save_stats(stats)

    return stats["server_total_profit"]


async def get_pending_bets(guild):
    bets = load_bets()
    pending = []

    now_adl = adelaide_now()
    start_adl = now_adl.replace(hour=0, minute=0, second=0, microsecond=0)

    for channel in guild.text_channels:
        if not is_bet_channel(channel.name):
            continue

        async for msg in channel.history(limit=150):
            msg_adl = to_adelaide(msg.created_at)

            if msg_adl < start_adl:
                continue

            text = msg.content or ""

            if parse_units(text) is not None and parse_odds(text) is not None:
                if str(msg.id) not in bets:
                    pending.append(msg)

    return pending


async def generate_bet_writeup(image_bytes, units_text, play_type):
    if not client_ai:
        return f"{units_text} PLAY\n\nBet image attached.\n\nConfidence: Medium"

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    prompt = f"""
You are writing a clean Discord betting post.

The user attached a betting screenshot. Read the screenshot and extract:
- bet type, e.g. SGM, Multi, single play
- odds
- legs/selections
- player lines if visible

The unit size is: {units_text}
The play type is: {play_type}

Write in this exact style:

{units_text} PLAY

[Bet type] @ [odds]

[Leg 1]
[Leg 2]
[Leg 3 if needed]

Short write-up, 2-4 sentences max.
Sound confident but not reckless.

Confidence: Medium / Medium-High / High

IMPORTANT:
- Include the odds as @ 1.80 etc.
- Keep it clean for Discord.
- Do not mention that you read an image.
- Do not include websites or sources.
- Do not use markdown tables.
"""

    res = client_ai.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}"
                        }
                    }
                ]
            }
        ]
    )

    return res.choices[0].message.content


async def post_bet_from_command(message, target_keyword, units_text, play_type):
    if not await user_can_control(message):
        await message.channel.send("❌ You don’t have permission to use this command.")
        return

    if not message.attachments:
        await message.channel.send("❌ Attach the bet screenshot in the same message.")
        return

    target_channel = find_channel(message.guild, target_keyword)
    if not target_channel:
        await message.channel.send(f"❌ Could not find target channel containing: {target_keyword}")
        return

    attachment = message.attachments[0]
    image_bytes = await attachment.read()

    await message.channel.send("🧾 The Accountant is building the bet post...")

    writeup = await generate_bet_writeup(image_bytes, units_text, play_type)

    file = discord.File(
        io.BytesIO(image_bytes),
        filename=attachment.filename or "bet.png"
    )

    sent = await target_channel.send(content=writeup, file=file)

    await message.channel.send(
        f"✅ Posted to #{target_channel.name}\n"
        f"Message ID tracked internally: `{sent.id}`"
    )


async def build_daily_post(bets):
    if not bets:
        return "No settled bets found today."

    free, vip, total, wins, losses, voids = summarize(bets)

    if client_ai:
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

    return (
        f"Free: {free:+.2f}U\n"
        f"VIP: {vip:+.2f}U\n"
        f"TOTAL: {total:+.2f}U\n"
        f"Wins: {wins} | Losses: {losses} | Voids: {voids}\n"
        f"$50 bettor: ${total * UNIT_VALUE:+.0f}\n\n"
        f"Check out #vip-info to access our premium bets"
    )


async def build_weekly_post(bets, server_total):
    if not bets:
        return (
            f"No weekly results found.\n\n"
            f"📊 Total Server Profit: {server_total:+.2f}U\n"
            f"💰 That’s {server_total * UNIT_VALUE:+.0f} total server profit for a $50 bettor."
        )

    free, vip, total, wins, losses, voids = summarize(bets)

    if client_ai:
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
- Mention Total Server Profit
- Keep it powerful but not too long
- End with: Check out #vip-info to access our premium bets
"""
        res = client_ai.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        return res.choices[0].message.content

    return (
        f"Free Picks: {free:+.2f}U\n"
        f"VIP Picks: {vip:+.2f}U\n"
        f"Weekly Profit: {total:+.2f}U\n"
        f"Record: {wins} Wins | {losses} Losses | {voids} Voids\n"
        f"$50 Bettor Weekly Result: ${total * UNIT_VALUE:+.0f}\n\n"
        f"Total Server Profit: {server_total:+.2f}U\n"
        f"That’s {server_total * UNIT_VALUE:+.0f} total server profit for a $50 bettor.\n\n"
        f"Check out #vip-info to access our premium bets"
    )


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

    if not await user_can_control(payload):
        print("Ignored reaction: user does not have permission to settle.")
        return

    message = await fetch_message_from_payload(payload)
    if message is None:
        return

    if message.created_at < FRESH_START_UTC:
        print("Ignored old bet before fresh start.")
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
        "settled_by_user_id": str(payload.user_id),
        "content_preview": text[:300]
    }

    save_bets(bets)
    print(f"✅ Saved result {result} | {stake}U @ {odds} | {profit:+.2f}U")


@bot.event
async def on_raw_reaction_remove(payload):
    emoji = str(payload.emoji)

    if emoji not in RESULT_EMOJIS:
        return

    if bot.user and payload.user_id == bot.user.id:
        return

    if not await user_can_control(payload):
        return

    bets = load_bets()
    msg_id = str(payload.message_id)

    if msg_id in bets:
        del bets[msg_id]
        save_bets(bets)
        print(f"🗑 Removed result for message {msg_id}")


@bot.event
async def on_raw_message_delete(payload):
    bets = load_bets()
    msg_id = str(payload.message_id)

    if msg_id in bets:
        del bets[msg_id]
        save_bets(bets)
        print(f"🗑 Bet removed because message was deleted: {msg_id}")


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

    content = message.content.strip()

    if content.startswith("!postfreebet"):
        parts = content.split()
        units = parts[1] if len(parts) > 1 else "1U"
        await post_bet_from_command(message, FREE_CHANNEL_KEYWORD, units, "FREE BET")

    elif content.startswith("!postvipmulti"):
        parts = content.split()
        units = parts[1] if len(parts) > 1 else "1U"
        await post_bet_from_command(message, VIP_MULTI_CHANNEL_KEYWORD, units, "VIP MULTI")

    elif content.startswith("!postvipvalue"):
        parts = content.split()
        units = parts[1] if len(parts) > 1 else "1U"
        await post_bet_from_command(message, VIP_VALUE_CHANNEL_KEYWORD, units, "VIP VALUE PLAY")

    elif content.startswith("!testrecap"):
        await post_daily(message.guild, update_total=False)

    elif content.startswith("!testweekly"):
        await post_weekly(message.guild)

    elif content.startswith("!betlog"):
        bets = load_bets()
        await message.channel.send(f"📊 Tracked settled bets: {len(bets)}")

    elif content.startswith("!pending"):
        pending = await get_pending_bets(message.guild)
        await message.channel.send(f"📊 Pending Bets: {len(pending)}")

    elif content.startswith("!today"):
        bets = get_today_bets()
        free, vip, total, wins, losses, voids = summarize(bets) if bets else (0, 0, 0, 0, 0, 0)
        await message.channel.send(
            f"📊 Today\n"
            f"Free: {free:+.2f}U\n"
            f"VIP: {vip:+.2f}U\n"
            f"Total: {total:+.2f}U\n"
            f"Record: {wins}W / {losses}L / {voids}V"
        )

    elif content.startswith("!weekly"):
        start, end = weekly_window()
        bets = get_bets_resulted_between(start, end)
        free, vip, total, wins, losses, voids = summarize(bets) if bets else (0, 0, 0, 0, 0, 0)
        await message.channel.send(
            f"📊 Weekly\n"
            f"Free: {free:+.2f}U\n"
            f"VIP: {vip:+.2f}U\n"
            f"Total: {total:+.2f}U\n"
            f"Record: {wins}W / {losses}L / {voids}V"
        )

    elif content.startswith("!servertotal"):
        stats = load_stats()
        total = stats["server_total_profit"]
        await message.channel.send(
            f"📊 Total Server Profit: {total:+.2f}U\n"
            f"💰 That’s {total * UNIT_VALUE:+.0f} total server profit for a $50 bettor."
        )

    elif content.startswith("!setservertotal"):
        parts = content.split()
        if len(parts) >= 2:
            try:
                new_total = float(parts[1])
                stats = load_stats()
                stats["server_total_profit"] = new_total
                save_stats(stats)
                await message.channel.send(f"✅ Server total set to {new_total:+.2f}U")
            except ValueError:
                await message.channel.send("❌ Use: !setservertotal 13.05")

    elif content.startswith("!clearbetlog"):
        save_bets({})
        await message.channel.send("✅ Bet log cleared.")

    elif content.startswith("!clearcounteddays"):
        stats = load_stats()
        stats["counted_days"] = []
        save_stats(stats)
        await message.channel.send("✅ Counted days cleared.")


bot.run(TOKEN)
