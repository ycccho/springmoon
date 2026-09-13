import sys
import os
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from mkt_scheduler.db_manager import init_db, get_period_stats, log_event
from mkt_scheduler.naver_collector import collect_naver_stats
from mkt_scheduler.gfa_collector import collect_gfa_stats
from mkt_scheduler.google_collector import collect_google_stats
from mkt_scheduler.cloud_syncer import sync_to_cloud
from mkt_scheduler.kakao_notifier import (
    send_kakao_memo,
    format_daily_report,
    format_weekly_report,
    format_monthly_report
)

# Configure logging
LOG_FILE = BASE_DIR / "scheduler.log"
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("mkt_scheduler")

def execute_daily_routine(target_date: str = None):
    """
    Executes the complete daily routine:
    1. Collect Naver Ads data
    2. Collect Google Ads data
    3. Update local JSON & Cloudflare KV
    4. Send KakaoTalk daily report
    5. Send weekly report (if today is Monday)
    6. Send monthly report (if today is 1st of month)
    """
    today = datetime.now()
    if not target_date:
        target_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    logger.info("=" * 65)
    logger.info(f"🚀 Starting Marketing Sync Routine for target date: {target_date}")
    logger.info("=" * 65)

    # 1. Collect Naver Ads
    logger.info("Step 1/5: Collecting Naver Search Ads (PowerLink, PowerContents, Place)...")
    try:
        naver_res = collect_naver_stats(target_date)
        logger.info(f"  Naver Collection: {naver_res.get('success')}")
    except Exception as e:
        logger.error(f"  Error in Naver collection: {e}")
        log_event("DAILY_ROUTINE", "ERROR", f"Naver error: {e}")

    # 1-2. Collect Naver GFA (성과형 DA)
    logger.info("Step 2/5: Collecting Naver GFA (성과형 디스플레이 광고)...")
    try:
        gfa_res = collect_gfa_stats(target_date)
        logger.info(f"  GFA Collection: {gfa_res.get('success')}")
    except Exception as e:
        logger.error(f"  Error in GFA collection: {e}")
        log_event("DAILY_ROUTINE", "ERROR", f"GFA error: {e}")

    # 2. Collect Google Ads
    logger.info("Step 3/5: Collecting Google Search Ads...")
    try:
        google_res = collect_google_stats(target_date)
        logger.info(f"  Google Collection: {google_res.get('success')}")
    except Exception as e:
        logger.error(f"  Error in Google collection: {e}")
        log_event("DAILY_ROUTINE", "ERROR", f"Google error: {e}")

    # 3. Synchronize to Cloud & local file
    logger.info("Step 3/4: Synchronizing to website and Cloudflare KV...")
    try:
        sync_res = sync_to_cloud()
        logger.info(f"  Cloud Sync: {sync_res.get('success')}")
    except Exception as e:
        logger.error(f"  Error in Cloud sync: {e}")
        log_event("DAILY_ROUTINE", "ERROR", f"Sync error: {e}")

    # 4. KakaoTalk Notifications
    logger.info("Step 4/4: Dispatching KakaoTalk Notifications...")

    # 4-1. Daily Report (Yesterday vs Day before yesterday)
    try:
        daily_stats = get_period_stats(target_date, target_date)
        prev_day = (datetime.strptime(target_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
        prev_daily_stats = get_period_stats(prev_day, prev_day)
        daily_msg = format_daily_report(daily_stats, prev_daily_stats)
        send_res = send_kakao_memo(daily_msg)
        if send_res:
            logger.info("  ✅ Daily memo delivered to KakaoTalk.")
        else:
            logger.warning("  ⚠️ Daily memo could not be sent (Check token).")
    except Exception as e:
        logger.error(f"  Error sending daily memo: {e}")

    # 4-2. Weekly Report (Every Monday 09:00: Last Mon ~ Sun vs 2-weeks ago Mon ~ Sun)
    if today.weekday() == 0 or "--weekly" in sys.argv:
        try:
            last_sunday = today - timedelta(days=today.weekday() + 1 if today.weekday() == 0 else 1)
            last_monday = last_sunday - timedelta(days=6)
            s_str = last_monday.strftime("%Y-%m-%d")
            e_str = last_sunday.strftime("%Y-%m-%d")

            prev_w_s = (last_monday - timedelta(days=7)).strftime("%Y-%m-%d")
            prev_w_e = (last_sunday - timedelta(days=7)).strftime("%Y-%m-%d")
            prev_weekly_stats = get_period_stats(prev_w_s, prev_w_e)

            logger.info(f"  Triggering Weekly Report for {s_str} ~ {e_str}...")
            weekly_stats = get_period_stats(s_str, e_str)
            weekly_msg = format_weekly_report(weekly_stats, prev_weekly_stats)
            send_kakao_memo(weekly_msg)
            logger.info("  ✅ Weekly memo delivered to KakaoTalk.")
        except Exception as e:
            logger.error(f"  Error sending weekly memo: {e}")

    # 4-3. Monthly Report (Every 1st 09:00: Last month vs 2-months ago)
    if today.day == 1 or "--monthly" in sys.argv:
        try:
            first_day_this_month = today.replace(day=1)
            last_day_prev_month = first_day_this_month - timedelta(days=1)
            first_day_prev_month = last_day_prev_month.replace(day=1)
            ms_str = first_day_prev_month.strftime("%Y-%m-%d")
            me_str = last_day_prev_month.strftime("%Y-%m-%d")

            last_day_2m_ago = first_day_prev_month - timedelta(days=1)
            first_day_2m_ago = last_day_2m_ago.replace(day=1)
            prev_m_s = first_day_2m_ago.strftime("%Y-%m-%d")
            prev_m_e = last_day_2m_ago.strftime("%Y-%m-%d")
            prev_monthly_stats = get_period_stats(prev_m_s, prev_m_e)

            logger.info(f"  Triggering Monthly Report for {ms_str} ~ {me_str}...")
            monthly_stats = get_period_stats(ms_str, me_str)
            monthly_msg = format_monthly_report(monthly_stats, prev_monthly_stats)
            send_kakao_memo(monthly_msg)
            logger.info("  ✅ Monthly memo delivered to KakaoTalk.")
        except Exception as e:
            logger.error(f"  Error sending monthly memo: {e}")

    log_event("DAILY_ROUTINE", "FINISHED", f"Completed routine for {target_date}")
    logger.info("🎉 Routine completed successfully.\n")

def run_scheduler_loop():
    """
    Continuous 24/7 background scheduler loop.
    Triggers execute_daily_routine() every morning at exactly 09:00 local time.
    """
    init_db()
    logger.info("=================================================================")
    logger.info("  🚀 Marketing Analytics 24/7 Scheduler Started (Active)")
    logger.info("  - Target Schedule: Every day at 09:00 AM (Local Time)")
    logger.info("  - Weekly Summary: Every Monday at 09:00 AM")
    logger.info("  - Monthly Summary: 1st of every month at 09:00 AM")
    logger.info(f"  - Database: {BASE_DIR / 'mkt_data.sqlite3'}")
    logger.info(f"  - Dashboard: https://springmoons.pages.dev/mkt")
    logger.info("=================================================================")

    last_executed_day = None

    while True:
        try:
            now = datetime.now()
            today_str = now.strftime("%Y-%m-%d")

            # Check if it is 09:00 AM and hasn't run yet today
            if now.hour == 9 and now.minute == 0 and last_executed_day != today_str:
                logger.info(f"⏰ 09:00 AM trigger activated for {today_str}!")
                execute_daily_routine()
                last_executed_day = today_str
                # Sleep for 65 seconds to prevent double firing in the same minute
                time.sleep(65)
            else:
                # Sleep in short intervals (10 seconds)
                time.sleep(10)
        except KeyboardInterrupt:
            logger.info("Scheduler terminated by user (Ctrl+C).")
            break
        except Exception as e:
            logger.error(f"Unexpected error in scheduler loop: {e}")
            time.sleep(30)

if __name__ == "__main__":
    init_db()
    if "--now" in sys.argv:
        # Immediate manual execution mode
        custom_date = None
        for arg in sys.argv[1:]:
            if arg.startswith("202"):
                custom_date = arg
                break
        execute_daily_routine(custom_date)
    else:
        run_scheduler_loop()
