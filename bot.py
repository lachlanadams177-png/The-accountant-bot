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

REACTION_LOG_FILE = "reaction_log.json"
SERVER_STATS_FILE = "server_stats.json"
SERVER_STARTING_PROFIT = 30.00

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


def load_server_stats():
    if not os.path.exists(SERVER_STATS_FILE):
        return {
            "server_total_profit": SERVER_STARTING_PROFIT,
            "counted_daily_dates": []
        }

    with open(SERVER_STATS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_server_stats(data):
    with open(SERVER_STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def now_utc():
    return datetime.now(timezone.utc)


def adelaide_now():
    return now_utc() + ADELAIDE_OFFSET


def to_adelaide(dt):
    return dt + ADELAIDE_OFFSET


def message_within_hours(message, hours):
    return message.created_at >= now_utc() - timedelta(hours=hours)


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


def summarize_bets(tracked_bets):
    free_profit = sum(b["profit"] for b in tracked_bets if b["section"] == "FREE")
    vip_profit = sum(b["profit"] for b in tracked_bets if b["section"] == "VIP")
    total_profit = free_profit + vip_profit

    wins = sum(1 for b in tracked_bets if b["result"] == "win")
    losses = sum(1 for b in tracked_bets if b["result"] == "loss")
    voids = sum(1 for b in tracked_bets if b["result"] == "void")

    return free_profit, vip_profit, total_profit, wins, losses, voids


def find_results_channel(guild):
    for channel in guild.text_channels:
        if "result" in channel.name.lower():
            return channel
    return None


def find_announcements_channel(guild):
    for channel in guild.text_channels:
        if "announcement" in channel.name.lower():
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


async def collect_daily_bets(guild):
    reaction_log = load_reaction_log()
    tracked_bets = []

    cutoff_reaction = now_utc() - timedelta(hours=17)

    for channel in guild.text_channels:
        if any(keyword in channel.name.lower() for keyword in SCAN_KEYWORDS):
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

    return tracked_bets


async def collect_weekly_bets(guild):
    reaction_log = load_reaction_log()
    tracked_bets = []

    now_adl = adelaide_now()

    monday = now_adl - timedelta(days=now_adl.weekday())
    week_start = monday.replace(hour=4, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=6, hours=18)

    print("📆 Weekly recap window:")
    print("START:", week_start)
    print("END:", week_end)

    for channel in guild.text_channels:
        if any(keyword in channel.name.lower() for keyword in SCAN_KEYWORDS):
            print(f"Weekly scanning {channel.name}")

            async for msg in channel.history(limit=1500):
                msg_adl = to_adelaide(msg.created_at)

                if msg_adl < week_start or msg_adl > week_end:
                    continue

                msg_id = str(msg.id)

                if msg_id not in reaction_log:
                    continue

                reaction_data = reaction_log[msg_id]
                reacted_at_utc = datetime.fromisoformat(reaction_data["reacted_at"])
                reacted_at_adl = to_adelaide(reacted_at_utc)

                if reacted_at_adl < week_start or reacted_at_adl > week_end:
                    continue

                bet = parse_bet(msg, reaction_data["result"])

                if bet:
                    tracked_bets.append(bet)

    print(f"Found {len(tracked_bets)} weekly bets")
    return tracked_bets


async def build_daily_recap(tracked_bets):
    if not tracked_bets:
        return "No new resulted bets found."

    free_profit, vip_profit, total_profit, wins, losses, voids = summarize_bets(tracked_bets)

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


async def build_weekly_recap(tracked_bets, server_total_profit):
    if not tracked_bets:
        return f"""
No weekly results found.

📊 Total Server Profit: {server_total_profit:+.2f}U
💰 That’s {server_total_profit * 50:+.0f} profit for a $50 bettor.
"""

    free_profit, vip_profit, weekly_profit, wins, losses, voids = summarize_bets(tracked_bets)

    prompt = f"""
Write a weekly Discord betting results recap.

Free: {free_profit:.2f}U
VIP: {vip_profit:.2f}U
Weekly Profit: {weekly_profit:.2f}U
Wins: {wins}, Losses: {losses}, Voids: {voids}
$50 bettor weekly result: ${weekly_profit * 50:.0f}

Total Server Profit: {server_total_profit:.2f}U
$50 bettor total server profit: ${server_total_profit * 50:.0f}

Rules:
- This is a WEEKLY recap
- Big hype write-up if profitable
- If negative, stay confident and positive, say we rebuild, stay consistent, and keep growing the bankroll
- Clean Discord formatting
- Mention weekly profit clearly
- Include this line clearly: "Total Server Profit: +{server_total_profit:.2f}U"
- Include this line clearly: "That’s +${server_total_profit * 50:.0f} total server profit for a $50 bettor"
- Keep it powerful but not too long
- End with:
Check out #vip-info to access our premium bets
"""

    response = client_ai.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    return response.choices[0].message.content


def add_daily_profit_to_server_total(total_profit):
    stats = load_server_stats()
    today_key = adelaide_now().strftime("%Y-%m-%d")

    if today_key not in stats["counted_daily_dates"]:
        stats["server_total_profit"] += total_profit
        stats["counted_daily_dates"].append(today_key)
        save_server_stats(stats)
        print(f"✅ Added {total_profit:.2f}U to server total for {today_key}")
    else:
        print(f"⚠️ Daily profit for {today_key} already counted.")

    return stats["server_total_profit"]


async def run_daily_recap(guild, update_server_total=False):
    tracked_bets = await collect_daily_bets(guild)

    total_profit = 0
    if tracked_bets:
        _, _, total_profit, _, _, _ = summarize_bets(tracked_bets)

    if update_server_total:
        add_daily_profit_to_server_total(total_profit)

    return await build_daily_recap(tracked_bets)


async def run_weekly_recap(guild):
    tracked_bets = await collect_weekly_bets(guild)
    stats = load_server_stats()
    server_total_profit = stats["server_total_profit"]

    return await build_weekly_recap(tracked_bets, server_total_profit)


async def auto_post():
    await bot.wait_until_ready()

    while not bot.is_closed():
        now_adl = adelaide_now()
        print("⏱ Checking Adelaide time:", now_adl)

        if now_adl.hour == 22 and now_adl.minute == 45:
            for guild in bot.guilds:
                daily_recap = await run_daily_recap(guild, update_server_total=True)
                results_channel = find_results_channel(guild)

                if results_channel:
                    await results_channel.send(
                        f"📊 **Daily Results Recap** 📊\n\n{daily_recap}"
                    )

                if now_adl.weekday() == 6:
                    weekly_recap = await run_weekly_recap(guild)
                    announcements_channel = find_announcements_channel(guild)

                    if announcements_channel:
                        await announcements_channel.send(
                            f"🔥 **WEEKLY RESULTS RECAP** 🔥\n\n{weekly_recap}"
                        )
                    else:
                        print("❌ Could not find announcements channel")

            await asyncio.sleep(60)

        await asyncio.sleep(20)


@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    if message.content.startswith("!testrecap"):
        recap = await run_daily_recap(message.guild, update_server_total=False)
        results_channel = find_results_channel(message.guild)

        if results_channel:
            await results_channel.send(
                f"📊 **Daily Results Recap TEST** 📊\n\n{recap}"
            )

    if message.content.startswith("!testweekly"):
        recap = await run_weekly_recap(message.guild)
        announcements_channel = find_announcements_channel(message.guild)

        if announcements_channel:
            await announcements_channel.send(
                f"🔥 **WEEKLY RESULTS RECAP TEST** 🔥\n\n{recap}"
            )
        else:
            await message.channel.send("❌ Could not find announcements channel")

    if message.content.startswith("!reactionlog"):
        data = load_reaction_log()
        await message.channel.send(f"📊 Logged reactions: {len(data)}")

    if message.content.startswith("!servertotal"):
        stats = load_server_stats()
        total = stats["server_total_profit"]
        await message.channel.send(
            f"📊 Total Server Profit: {total:+.2f}U\n"
            f"💰 That’s {total * 50:+.0f} total server profit for a $50 bettor."
        )


bot.run(TOKEN)
