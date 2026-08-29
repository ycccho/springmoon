# Springmoon AI Studio & 3D SketchUp 변환 작업 히스토리

본 문서는 현재 대화(Conversation ID: `cba78360-2c6e-4c60-86a7-0225052caaeb`)에서 진행된 핵심 작업 내역, 개발된 기능, 생성된 3D 스케치업 모델 및 사용 가이드를 `springmoon` 프로젝트로 이관 및 영구 보존하기 위해 작성되었습니다.

---

## 📌 1. 핵심 개발 및 업데이트 내역

### 1) 3D 실사 렌더링 시스템 (`https://springmoons.pages.dev/render`)
* **기능**: 스케치업 캡처 및 도면 이미지를 업로드하면 PBR 물리 재질, 자연 채광, 플램비언트 노출을 주입하여 극실사 인테리어 사진으로 변환.
* **핵심 업데이트**:
  * 다중 이미지 일괄 업로드(Batch Multi-Upload) 지원
  * 대기열 관리 및 순차 일괄 렌더링
  * Before & After 비교 슬라이더 및 개별 뷰 탭 전환
  * Tier-1 Paid API 기반 고해상도 처리 파이프라인 구축

### 2) 도면 공간 조닝 시스템 (`https://springmoons.pages.dev/zoning`)
* **기능**: 병원/의원 및 상업 오피스 2D 도면을 기반으로 4가지 서로 다른 현실적 조닝 대안(안 A~D), 실별 면적 산출표, 동선 검토 보고서 자동 생성.
* **핵심 규칙**:
  * **외곽 벽체 100% 고정 (Wall Lock)**: 원본 도면의 테두리 및 입구를 임의 확장하지 않고 내부 공간만 구획
  * **공용부 제외**: 계단실, EV실, 외부 공용복도 면적 자동 제외
  * **현실적 실별 평수**: 30평(실면적 22~25평) 기준 4~5개 핵심 실, 50~60평 기준 6~8개 실 등 건축 실무 규격 적용
  * **병원 vs 오피스 분리**: 선택 용도에 따른 프롬프트 및 전용 면적 옵션 완전 격리

---

## 🏢 2. SK해운 사무실 (76.8평 / 253.3㎡) 3D 스케치업 모델 데이터

도면 치수(25,020mm × 10,300mm × 천장고 2,700mm)를 1:1 수학적 좌표로 반영하여 생성된 3D 데이터 파일 위치입니다:

* 📁 **3D 모델 디렉토리**: `D:\my\springmoon\models\sk_shipping_office\`
  1. `sk_shipping_office.obj` : 스케치업 가져오기(Import)용 3D Wavefront OBJ 파일
  2. `sk_shipping_office.mtl` : 카펫, 우드, 유리, 화이트벽체 3D 재질 정의 파일
  3. `sk_shipping_office.rb` : 스케치업 루비 콘솔용 1초 자동 모델링 스크립트
  4. `sk_shipping_cad_isometric_exact.png` : 왜곡 0% 3D CAD 메쉬 렌더링 뷰
  5. `sk_shipping_sketchup_3d_iso.jpg` : 3D 아이소메트릭 뷰
  6. `sk_shipping_sketchup_3d_eye.jpg` : 3D 아이레벨 투시도 뷰

---

## 🛠️ 3. 스케치업에서 불러오는 방법

### 방법 1. OBJ 가져오기 (Import)
1. 스케치업 실행 ➡️ `파일(File)` ➡️ `가져오기(Import)`
2. 파일 형식: `Wavefront OBJ (*.obj)` 선택
3. `D:\my\springmoon\models\sk_shipping_office\sk_shipping_office.obj` 선택

### 방법 2. 루비 콘솔 (Ruby Console)
1. 스케치업 실행 ➡️ `창(Window)` ➡️ `루비 콘솔(Ruby Console)`
2. 아래 명령어 실행:
```ruby
load "D:/my/springmoon/models/sk_shipping_office/sk_shipping_office.rb"
```

---

## 💡 4. 워크플로우 팁
* 2D 도면을 3D로 만들 때는 2D 이미지 생성 AI 대신 **정밀 3D CAD 파일(`.obj` / `.rb`)**로 스케치업에 올려 벽체 왜곡을 0%로 유지하고,
* 스케치업에서 카메라 뷰를 잡은 캡처 사진을 **`https://springmoons.pages.dev/render`**에 넣어 극실사 렌더링으로 완성하는 것이 가장 완벽한 프로페셔널 워크플로우입니다.
