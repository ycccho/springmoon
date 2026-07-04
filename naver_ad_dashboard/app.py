import streamlit as st
import pandas as pd
import datetime
import plotly.express as px
import io
import db_manager as db
from naver_api import NaverAdAPI

# Page configuration
st.set_page_config(
    page_title="네이버 광고 성과 시각화 대시보드",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize DB on load
db.init_db()

# Pre-populated Credentials (supplied safely by user)
DEFAULT_API_KEY = "01000000003e8862c48a1f7ac679c6588c585e0dd35f9c064485960e8f6ff92b22c77c5e6b"
DEFAULT_SECRET_KEY = "AQAAAAA+iGLEih96xnnGWIxYXg3TOQOrVq+wj1qrlppE2vLU7A=="
DEFAULT_CUSTOMER_ID = "1610516"

# Sidebar Authentication and Sync Panel
st.sidebar.header("🔑 네이버 광고 API 설정")
api_key = st.sidebar.text_input("액세스 라이선스", value=DEFAULT_API_KEY, type="password")
secret_key = st.sidebar.text_input("비밀키", value=DEFAULT_SECRET_KEY, type="password")
customer_id = st.sidebar.text_input("고객 ID", value=DEFAULT_CUSTOMER_ID)

st.sidebar.markdown("---")
st.sidebar.header("🔄 데이터 동기화 엔진")

# Today's date and default range (sync past 7 days by default)
today = datetime.date.today()
default_start = today - datetime.timedelta(days=7)

sync_start_date = st.sidebar.date_input("동기화 시작일", value=default_start)
sync_end_date = st.sidebar.date_input("동기화 종료일", value=today)

# Sync target ad categories
sync_targets = st.sidebar.multiselect(
    "동기화 대상 광고",
    options=["파워링크", "플레이스광고", "파워컨텐츠"],
    default=["파워링크"]
)

# Run sync button
if st.sidebar.button("🚀 네이버 광고 데이터 가져오기"):
    if not api_key or not secret_key or not customer_id:
        st.sidebar.error("API 키를 확인해주세요.")
    elif not sync_targets:
        st.sidebar.warning("동기화 대상을 최소 하나 선택해주세요.")
    elif sync_start_date > sync_end_date:
        st.sidebar.error("시작일이 종료일보다 늦을 수 없습니다.")
    else:
        # Trigger Sync Engine
        api = NaverAdAPI(api_key, secret_key, customer_id)
        
        # Calculate date range list (formatted as YYYY-MM-DD)
        delta = sync_end_date - sync_start_date
        raw_date_list = [(sync_start_date + datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(delta.days + 1)]
        
        # Filter out unavailable dates (today, and yesterday if before 8 AM KST)
        now = datetime.datetime.now()
        today_str = today.strftime("%Y-%m-%d")
        yesterday_str = (today - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        
        date_list = []
        excluded_dates = []
        for d_str in raw_date_list:
            if d_str == today_str:
                excluded_dates.append(d_str)
            elif d_str == yesterday_str and now.hour < 8:
                excluded_dates.append(d_str)
            elif d_str > today_str:
                excluded_dates.append(d_str)
            else:
                date_list.append(d_str)
                
        if excluded_dates:
            st.sidebar.warning(f"네이버 통계 집계 기준 미달일({', '.join(excluded_dates)})은 자동 제외하고 수집합니다.")
            
        if not date_list:
            st.sidebar.error("수집 가능한 날짜가 없습니다. 시작일을 더 이전 날짜로 선택해 주세요.")
        else:
            st.sidebar.info(f"총 {len(date_list)}일간의 데이터 매칭 및 수집을 시작합니다...")
            
            progress_bar = st.sidebar.progress(0.0)
            status_text = st.sidebar.empty()
        
            # Mapping UI names to Ad Types and Report types
            ad_mappings = {
                "파워링크": {"ad_type": "POWERLINK", "reports": ["KEYWORD", "USER_RETURN"]},
                "플레이스광고": {"ad_type": "PLACE", "reports": ["PLACE_AD"]},
                "파워컨텐츠": {"ad_type": "POWERCONTENT", "reports": ["CONTENTS_AD"]}
            }
            
            # Track synced days to display summary
            synced_count = 0
            skipped_count = 0
            new_keywords = set()
            
            for idx, date_str in enumerate(date_list):
                status_text.text(f"진행 중: {date_str}...")
                
                for ui_name in sync_targets:
                    config = ad_mappings[ui_name]
                    ad_type = config["ad_type"]
                    
                    for report_type in config["reports"]:
                        # Fetch already synced dates to skip duplicates
                        synced_dates = db.get_synced_dates(ad_type, report_type)
                        
                        if date_str in synced_dates:
                            skipped_count += 1
                            continue
                            
                        try:
                            # Fetch from Naver Ad API
                            rows = api.fetch_report_data(date_str, ad_type, report_type)
                            
                            # Save rows to SQLite DB
                            db.save_report_data(rows)
                            
                            # Keep track of keywords that might need search volume lookup
                            for r in rows:
                                if r[6]: # keyword field
                                    new_keywords.add(r[6])
                                    
                            # Log sync status
                            db.log_sync(date_str, ad_type, report_type)
                            synced_count += 1
                            
                            # Rate limit delay (0.5s between days/reports)
                            time_delay = 0.5
                        except Exception as ex:
                            st.sidebar.warning(f"{date_str} [{ui_name} - {report_type}] 오류: {ex}")
                            
                # Update Progress Bar
                progress_bar.progress((idx + 1) / len(date_list))
                
            status_text.text("✅ 수집 및 DB 저장 완료!")
            st.sidebar.success(f"신규 수집: {synced_count}건, 캐시 로드: {skipped_count}건")
            
            # Look up search volumes for new keywords with 0 volume
            if new_keywords:
                status_text.text("🔍 신규 키워드 월간 검색량 매칭 중...")
                conn = db.get_connection()
                # Fetch only keywords with 0 search volume
                placeholders = ",".join(["?"] * len(new_keywords))
                cursor = conn.cursor()
                cursor.execute(f"SELECT keyword FROM reports WHERE keyword IN ({placeholders}) AND search_volume = 0", list(new_keywords))
                unindexed_kws = [row["keyword"] for row in cursor.fetchall()]
                conn.close()
                
                if unindexed_kws:
                    status_text.text(f"검색량 정보 수집 중 ({len(unindexed_kws)}개)...")
                    volumes = api.get_monthly_search_volumes(unindexed_kws)
                    db.update_search_volumes(volumes)
                    st.sidebar.success(f"검색량 매칭 완료: {len(volumes)}개 키워드")
                    
            status_text.empty()

# Main Dashboard View
st.title("📊 네이버 검색광고 성과분석 대시보드")
st.markdown("로컬 DB 캐싱을 통해 신속하고 안전하게 광고 성과 지표를 추적 및 시각화합니다.")

# Main Category Selection Tab
ad_tab = st.selectbox(
    "📁 분석 광고 상품 선택",
    options=["파워링크 분석", "스마트플레이스 광고", "파워컨텐츠 광고"],
    index=0
)

ad_type_map = {
    "파워링크 분석": "POWERLINK",
    "스마트플레이스 광고": "PLACE",
    "파워컨텐츠 광고": "POWERCONTENT"
}
selected_ad_type = ad_type_map[ad_tab]

# Fetch DB summary
conn = db.get_connection()
df_db = pd.read_sql(f"SELECT * FROM reports WHERE ad_type = '{selected_ad_type}'", conn)
conn.close()

if df_db.empty:
    st.warning("데이터베이스에 데이터가 존재하지 않습니다. 먼저 왼쪽 사이드바에서 데이터 동기화를 진행해주세요.")
else:
    # Convert date to datetime object
    df_db['date'] = pd.to_datetime(df_db['date'])
    
    # ----------------------------------------------------
    # Metric Date Filters (Period A vs B)
    # ----------------------------------------------------
    st.markdown("### 📅 성과 분석 기간 비교 (A vs B)")
    
    col_a, col_b = st.columns(2)
    
    with col_a:
        st.info("🟢 비교 기준 기간 A")
        min_date = df_db['date'].min().date()
        max_date = df_db['date'].max().date()
        date_a = st.date_input(
            "기간 A 선택",
            value=(max_date - datetime.timedelta(days=7), max_date),
            min_value=min_date,
            max_value=max_date,
            key="date_range_a"
        )
        
    with col_b:
        st.info("🔵 비교 대상 기간 B")
        date_b = st.date_input(
            "기간 B 선택",
            value=(max_date - datetime.timedelta(days=15), max_date - datetime.timedelta(days=8)),
            min_value=min_date,
            max_value=max_date,
            key="date_range_b"
        )
        
    if len(date_a) == 2 and len(date_b) == 2:
        start_a, end_a = pd.to_datetime(date_a[0]), pd.to_datetime(date_a[1])
        start_b, end_b = pd.to_datetime(date_b[0]), pd.to_datetime(date_b[1])
        
        # Filter datasets
        df_a = df_db[(df_db['date'] >= start_a) & (df_db['date'] <= end_a)]
        df_b = df_db[(df_db['date'] >= start_b) & (df_db['date'] <= end_b)]
        
        # Calculate Aggregates
        def get_summary_metrics(df):
            # To prevent double counting when multiple report types are active, 
            # we aggregate only 'KEYWORD' records (search_query = "") for aggregate stats.
            # However, for Place and PowerContent, search_query is always "".
            if selected_ad_type == "POWERLINK":
                df_agg = df[df['search_query'] == ""]
            else:
                df_agg = df
            
            imp = df_agg['impressions'].sum()
            clicks = df_agg['clicks'].sum()
            cost = df_agg['cost'].sum()
            ctr = (clicks / imp * 100) if imp > 0 else 0.0
            cpc = (cost / clicks) if clicks > 0 else 0.0
            return imp, clicks, cost, ctr, cpc
            
        imp_a, clk_a, cost_a, ctr_a, cpc_a = get_summary_metrics(df_a)
        imp_b, clk_b, cost_b, ctr_b, cpc_b = get_summary_metrics(df_b)
        
        # Render comparative cards
        st.markdown("#### 주요 지표 비교 결과 요약")
        m1, m2, m3, m4, m5 = st.columns(5)
        
        def render_metric(col, label, val_a, val_b, format_str, is_higher_better=True):
            diff = val_a - val_b
            pct_change = (diff / val_b * 100) if val_b > 0 else 0.0
            
            arrow = "🔺" if diff > 0 else "🔻" if diff < 0 else "="
            color = "green" if (diff > 0 and is_higher_better) or (diff < 0 and not is_higher_better) else "red" if diff != 0 else "gray"
            
            val_a_str = format_str.format(val_a)
            change_str = f"{arrow} {abs(pct_change):.1f}%" if diff != 0 else "="
            
            col.markdown(
                f"<div style='background-color:#f8fafc; padding: 15px; border-radius: 10px; border-left: 5px solid {color};'>"
                f"<p style='margin:0; font-size:11px; font-weight:bold; color:#64748b;'>{label}</p>"
                f"<h3 style='margin:5px 0 0 0; font-size:18px; font-weight:black; color:#0f172a;'>{val_a_str}</h3>"
                f"<p style='margin:0; font-size:11px; font-weight:bold; color:{color};'>{change_str} (vs 기간 B)</p>"
                f"</div>",
                unsafe_allowed_html=True
            )
            
        render_metric(m1, "노출수 (Impressions)", imp_a, imp_b, "{:,.0f}")
        render_metric(m2, "클릭수 (Clicks)", clk_a, clk_b, "{:,.0f}")
        render_metric(m3, "광고 지출액 (Cost)", cost_a, cost_b, "₩{:,.0f}", is_higher_better=False)
        render_metric(m4, "클릭률 (CTR)", ctr_a, ctr_b, "{:.2f}%")
        render_metric(m5, "평균 CPC", cpc_a, cpc_b, "₩{:.0f}", is_higher_better=False)
        
    # ----------------------------------------------------
    # 1-Year Time Series Chart
    # ----------------------------------------------------
    st.markdown("---")
    st.markdown("### 📈 연간 시계열 광고 성과 분석 (최대 1년)")
    
    # Filter 365 days from max date
    max_db_date = df_db['date'].max()
    one_year_ago = max_db_date - datetime.timedelta(days=365)
    df_1y = df_db[df_db['date'] >= one_year_ago]
    
    # Aggregate by date
    if selected_ad_type == "POWERLINK":
        df_1y_agg = df_1y[df_1y['search_query'] == ""]
    else:
        df_1y_agg = df_1y
        
    df_chart = df_1y_agg.groupby('date')[['impressions', 'clicks', 'cost']].sum().reset_index()
    
    chart_metric = st.selectbox(
        "분석 지표 선택",
        options=["광고 지출액 (Cost)", "클릭수 (Clicks)", "노출수 (Impressions)"],
        index=0
    )
    
    metric_column = {
        "광고 지출액 (Cost)": "cost",
        "클릭수 (Clicks)": "clicks",
        "노출수 (Impressions)": "impressions"
    }[chart_metric]
    
    fig = px.line(
        df_chart, 
        x="date", 
        y=metric_column,
        title=f"일별 {chart_metric} 추이 (최근 365일)",
        labels={metric_column: chart_metric, "date": "날짜"},
        template="plotly_white"
    )
    fig.update_traces(line_color="#f97316", line_width=2.5)
    fig.update_layout(
        font_family="sans-serif",
        title_font_size=14,
        hovermode="x unified"
    )
    st.plotly_chart(fig, use_container_width=True)
    
    # ----------------------------------------------------
    # Keyword & Search Query Table Performance
    # ----------------------------------------------------
    st.markdown("---")
    st.markdown("### 🔍 세부 키워드 및 검색어 성과")
    
    # Date picker specifically for the detailed table
    table_date = st.date_input(
        "테이블 조회 기간",
        value=(max_date - datetime.timedelta(days=14), max_date),
        min_value=min_date,
        max_value=max_date,
        key="table_date_range"
    )
    
    if len(table_date) == 2:
        t_start, t_end = pd.to_datetime(table_date[0]), pd.to_datetime(table_date[1])
        df_t = df_db[(df_db['date'] >= t_start) & (df_db['date'] <= t_end)]
        
        # Filters
        keyword_search = st.text_input("키워드 필터링")
        query_search = st.text_input("소비자 상세 검색어 필터링 (클릭한 키워드)")
        
        if keyword_search:
            df_t = df_t[df_t['keyword'].str.contains(keyword_search, case=False, na=False)]
        if query_search:
            df_t = df_t[df_t['search_query'].str.contains(query_search, case=False, na=False)]
            
        # Group by Keyword & Search Query
        df_table = df_t.groupby(['keyword', 'search_query']).agg({
            'impressions': 'sum',
            'clicks': 'sum',
            'cost': 'sum',
            'search_volume': 'max'
        }).reset_index()
        
        # Calculate Rates
        df_table['CTR (%)'] = (df_table['clicks'] / df_table['impressions'] * 100).round(2)
        df_table['평균 CPC (원)'] = (df_table['cost'] / df_table['clicks']).round(0).fillna(0).astype(int)
        
        # Format labels
        df_table.rename(columns={
            'keyword': '키워드',
            'search_query': '소비자 검색어',
            'impressions': '노출수',
            'clicks': '클릭수',
            'cost': '광고비',
            'search_volume': '월간 검색량'
        }, inplace=True)
        
        # Reorder columns
        df_table = df_table[[
            '키워드', '소비자 검색어', '노출수', '클릭수', '광고비', 'CTR (%)', '평균 CPC (원)', '월간 검색량'
        ]]
        
        # Display DataFrame
        st.dataframe(df_table, use_container_width=True)
        
        # Download Section
        st.markdown("#### 📥 분석 결과 추출")
        c1, c2 = st.columns(2)
        
        # CSV Export
        csv_data = df_table.to_csv(index=False, encoding='utf-8-sig')
        c1.download_button(
            label="📄 CSV 파일로 다운로드",
            data=csv_data,
            file_name=f"네이버광고_{selected_ad_type}_{table_date[0]}_{table_date[1]}.csv",
            mime="text/csv"
        )
        
        # Excel Export (Safe fallback to CSV if openpyxl error)
        try:
            buffer = io.BytesIO()
            with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
                df_table.to_excel(writer, index=False, sheet_name='광고성과분석')
            excel_data = buffer.getvalue()
            c2.download_button(
                label="📁 Excel 파일로 다운로드",
                data=excel_data,
                file_name=f"네이버광고_{selected_ad_type}_{table_date[0]}_{table_date[1]}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        except Exception as e:
            c2.info("Excel 엑스포터 모듈(openpyxl)이 로컬 시스템에 감지되지 않아 Excel 다운로드는 비활성화되었습니다. CSV 다운로드를 이용해 주세요.")
