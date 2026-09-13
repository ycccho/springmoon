import os
import sys
import time
from pathlib import Path

# Ensure UTF-8 console output
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

BASE_DIR = Path(__file__).resolve().parent
PROFILE_DIR = BASE_DIR / "gfa_profile"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)

def launch_login():
    options = Options()
    options.add_argument(f"--user-data-dir={PROFILE_DIR.resolve()}")
    options.add_argument("--profile-directory=Default")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    print("=" * 65)
    print("🚀 GFA (네이버 성과형 디스플레이 광고) 로그인 브라우저 시작")
    print("=" * 65)
    print("1. 브라우저 창이 열리면 [네이버 로그인]을 진행해 주세요.")
    print("   (★ 반드시 '로그인 상태 유지'에 체크해 주세요)")
    print("2. 로그인 후 광고계정 목록에서 [inde_company:naver]를 확인하고,")
    print("   우측의 [운영 관리]를 클릭하여 GFA 대시보드로 진입해 주세요.")
    print("3. 대시보드(인지도 및 트래픽 > 네이티브 캠페인) 화면이 열리면 완료됩니다.")
    print("=" * 65)

    driver = webdriver.Chrome(options=options)
    driver.get("https://gfa.naver.com")

    # Monitor navigation
    account_selected = False
    dashboard_reached = False

    try:
        while True:
            time.sleep(2)
            try:
                current_url = driver.current_url
                page_source = driver.page_source

                # Check if account selection page
                if "inde_company:naver" in page_source and not account_selected:
                    print("\n[감지] 광고계정 목록에서 'inde_company:naver' 발견!")
                    print("👉 'inde_company:naver'의 [운영 관리] 버튼을 클릭해 주세요.")
                    account_selected = True

                # Check if inside GFA campaign dashboard
                if ("campaign" in current_url.lower() or "report" in current_url.lower() or "인지도" in page_source) and not dashboard_reached:
                    print(f"\n🎉 [성공] GFA 대시보드 진입 감지! (URL: {current_url})")
                    print("✅ 로그인 세션과 광고계정 정보가 성공적으로 저장되었습니다.")
                    print("📌 확인이 끝나시면 크롬 브라우저를 닫으셔도 됩니다.")
                    dashboard_reached = True

            except Exception:
                # Browser might be closed by user
                break
    except KeyboardInterrupt:
        print("\n종료합니다.")
    finally:
        try:
            driver.quit()
        except Exception:
            pass
        print("\n브라우저 세션 저장이 완료되었습니다.")

if __name__ == "__main__":
    launch_login()
