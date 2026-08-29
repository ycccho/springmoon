# ==============================================================================
# SK해운 사무실 (SK Shipping Office) 3D 스케치업 자동 생성 스크립트
# 도면 규격: 25,020mm x 10,300mm (253.3m2 / 76.8PY)
# 벽체 높이: 2,700mm (천장고 2.7m)
# 사용법: 스케치업 상단 메뉴 [Window/창] -> [Ruby Console/루비 콘솔]을 열고 이 파일 내용을 복사-붙여넣기 후 Enter!
# ==============================================================================

model = Sketchup.active_model
model.start_operation('Build SK Shipping Office', true)

entities = model.active_entities
main_group = entities.add_group
g_ent = main_group.entities

# ------------------------------------------------------------------------------
# 1. 레이어(태그) 및 재질(Materials) 설정
# ------------------------------------------------------------------------------
materials = model.materials

mat_wall = materials.add('SK_Wall_White')
mat_wall.color = Sketchup::Color.new(245, 245, 245)

mat_glass = materials.add('SK_Glass_Partition')
mat_glass.color = Sketchup::Color.new(180, 220, 240)
mat_glass.alpha = 0.35

mat_carpet = materials.add('SK_Office_Carpet')
mat_carpet.color = Sketchup::Color.new(80, 85, 90)

mat_wood = materials.add('SK_Lounge_Wood_Floor')
mat_wood.color = Sketchup::Color.new(195, 155, 115)

mat_desk = materials.add('SK_Desk_Oak_White')
mat_desk.color = Sketchup::Color.new(230, 225, 215)

mat_dark = materials.add('SK_Chair_DarkGrey')
mat_dark.color = Sketchup::Color.new(45, 45, 50)

# ------------------------------------------------------------------------------
# 2. 바닥 슬래브 (Floor Slab) - 25,020mm x 10,300mm
# ------------------------------------------------------------------------------
# 단위 변환: 스케치업 루비는 inch 기준이므로 .mm 메서드 사용
w_total = 25020.mm
d_total = 10300.mm
h_wall = 2700.mm
t_ext = 200.mm   # 외벽 두께
t_int = 100.mm   # 내벽 두께
h_door = 2100.mm # 도어 높이

# 바닥 면 생성
pts_floor = [
  Geom::Point3d.new(0, 0, 0),
  Geom::Point3d.new(w_total, 0, 0),
  Geom::Point3d.new(w_total, d_total, 0),
  Geom::Point3d.new(0, d_total, 0)
]
floor_face = g_ent.add_face(pts_floor)
floor_face.material = mat_carpet
floor_face.back_material = mat_carpet
floor_face.pushpull(-150.mm) # 슬래브 150mm 하향 돌출

# ------------------------------------------------------------------------------
# 3. 벽체 생성 헬퍼 함수
# ------------------------------------------------------------------------------
def create_wall(ent, x1, y1, x2, y2, thickness, height, mat)
  dx = x2 - x1
  dy = y2 - y1
  len = Math.sqrt(dx*dx + dy*dy)
  return if len == 0
  
  # 수직 벡터
  nx = -dy / len * thickness
  ny = dx / len * thickness
  
  pts = [
    Geom::Point3d.new(x1, y1, 0),
    Geom::Point3d.new(x2, y2, 0),
    Geom::Point3d.new(x2 + nx, y2 + ny, 0),
    Geom::Point3d.new(x1 + nx, y1 + ny, 0)
  ]
  face = ent.add_face(pts)
  if face
    face.material = mat
    face.back_material = mat
    face.pushpull(height)
  end
end

def create_glass_wall(ent, x1, y1, x2, y2, height, mat_glass, mat_frame)
  # 하부 걸레받이/프레임 (50mm)
  create_wall(ent, x1, y1, x2, y2, 50.mm, 50.mm, mat_frame)
  # 상부 유리 (50mm ~ 2650mm)
  dx = x2 - x1
  dy = y2 - y1
  len = Math.sqrt(dx*dx + dy*dy)
  nx = -dy / len * 15.mm
  ny = dx / len * 15.mm
  pts = [
    Geom::Point3d.new(x1, y1, 50.mm),
    Geom::Point3d.new(x2, y2, 50.mm),
    Geom::Point3d.new(x2 + nx, y2 + ny, 50.mm),
    Geom::Point3d.new(x1 + nx, y1 + ny, 50.mm)
  ]
  g_face = ent.add_face(pts)
  if g_face
    g_face.material = mat_glass
    g_face.back_material = mat_glass
    g_face.pushpull(height - 100.mm)
  end
  # 상부 프레임 (2650mm ~ 2700mm)
  pts_top = [
    Geom::Point3d.new(x1, y1, height - 50.mm),
    Geom::Point3d.new(x2, y2, height - 50.mm),
    Geom::Point3d.new(x2 + nx*3, y2 + ny*3, height - 50.mm),
    Geom::Point3d.new(x1 + nx*3, y1 + ny*3, height - 50.mm)
  ]
  t_face = ent.add_face(pts_top)
  t_face.pushpull(50.mm) if t_face
end

# ------------------------------------------------------------------------------
# 4. 외곽 벽체 (Exterior Perimeter Walls)
# ------------------------------------------------------------------------------
# 상단 벽 (Y = 10,300)
create_wall(g_ent, 0, d_total, w_total, d_total, -t_ext, h_wall, mat_wall)
# 우측 벽 (X = 25,020)
create_wall(g_ent, w_total, 0, w_total, d_total, -t_ext, h_wall, mat_wall)
# 좌측 벽 (X = 0)
create_wall(g_ent, 0, 0, 0, d_total, t_ext, h_wall, mat_wall)

# 하단 벽 (Y = 0) - 주출입문(E.N.T: X=1,800~3,600) 개구부 남김
create_wall(g_ent, 0, 0, 1800.mm, 0, t_ext, h_wall, mat_wall)
create_wall(g_ent, 3600.mm, 0, w_total, 0, t_ext, h_wall, mat_wall)
# 주출입문 상부 인방벽 (Lintel, 2100mm~2700mm)
pts_lintel = [
  Geom::Point3d.new(1800.mm, 0, 2100.mm),
  Geom::Point3d.new(3600.mm, 0, 2100.mm),
  Geom::Point3d.new(3600.mm, t_ext, 2100.mm),
  Geom::Point3d.new(1800.mm, t_ext, 2100.mm)
]
f_lin = g_ent.add_face(pts_lintel)
f_lin.pushpull(600.mm) if f_lin

# ------------------------------------------------------------------------------
# 5. 내부 구획벽 (Interior Partition Walls)
# ------------------------------------------------------------------------------
# X 좌표 기준선:
x_edu = 6305.mm                   # 교육장 우측 벽
x_m1  = x_edu + 3655.mm           # 회의실1 / 회의실2 경계 (9,960mm)
x_m2  = x_m1 + 3655.mm            # 회의실2 우측 벽 (13,615mm)
x_cor = x_m2 + 1200.mm            # OA/통로 (14,815mm)
x_ex1 = x_cor + 3655.mm           # 임원실1 / 임원실2 경계 (18,470mm)
x_ex2 = x_ex1 + 3655.mm           # 임원실2 우측 벽 (22,125mm)
x_sto = w_total                   # 창고/통신실 우측 (25,020mm)

y_rooms = d_total - 3720.mm       # 상단 룸 복도면 (Y = 6,580mm)

# (1) 교육장 우측 경계벽 (X = 6,305, Y = 0 ~ 10,300, 도어 개구부 Y=1,500~2,400)
create_wall(g_ent, x_edu, 0, x_edu, 1500.mm, t_int, h_wall, mat_wall)
create_wall(g_ent, x_edu, 2400.mm, x_edu, d_total, t_int, h_wall, mat_wall)
# 교육장 도어 상부 인방벽
pts_edulintel = [
  Geom::Point3d.new(x_edu, 1500.mm, 2100.mm),
  Geom::Point3d.new(x_edu, 2400.mm, 2100.mm),
  Geom::Point3d.new(x_edu + t_int, 2400.mm, 2100.mm),
  Geom::Point3d.new(x_edu + t_int, 1500.mm, 2100.mm)
]
f_edulin = g_ent.add_face(pts_edulintel)
f_edulin.pushpull(600.mm) if f_edulin

# (2) 상단 룸 수평 복도벽 (Y = 6,580mm, X = 6,305 ~ 25,020)
# 회의실 1 전면 유리벽 (X = 6,305 ~ 9,960) - 도어 X=9,060~9,960
create_glass_wall(g_ent, x_edu, y_rooms, x_edu + 2755.mm, y_rooms, h_wall, mat_glass, mat_wall)
# 회의실 2 전면 유리벽 (X = 9,960 ~ 13,615) - 도어 X=12,715~13,615
create_glass_wall(g_ent, x_m1, y_rooms, x_m1 + 2755.mm, y_rooms, h_wall, mat_glass, mat_wall)
# OA ZONE 1 (X = 13,615 ~ 14,815) 벽체
create_wall(g_ent, x_m2, y_rooms, x_cor, y_rooms, t_int, h_wall, mat_wall)
# 임원실 1 전면벽 (X = 14,815 ~ 18,470) - 도어 X=14,815~15,715
create_wall(g_ent, x_cor + 900.mm, y_rooms, x_ex1, y_rooms, t_int, h_wall, mat_wall)
# 임원실 2 전면벽 (X = 18,470 ~ 22,125) - 도어 X=18,470~19,370
create_wall(g_ent, x_ex1 + 900.mm, y_rooms, x_ex2, y_rooms, t_int, h_wall, mat_wall)
# 창고/통신실 전면벽 (X = 22,125 ~ 25,020) - 도어 X=22,125~22,925
create_wall(g_ent, x_ex2 + 800.mm, y_rooms, x_sto, y_rooms, t_int, h_wall, mat_wall)

# (3) 상단 룸 수직 분할벽 (Y = 6,580 ~ 10,300)
create_wall(g_ent, x_m1, y_rooms, x_m1, d_total, t_int, h_wall, mat_wall) # 회의실 1/2
create_wall(g_ent, x_m2, y_rooms, x_m2, d_total, t_int, h_wall, mat_wall) # 회의실2 / 통로
create_wall(g_ent, x_cor, y_rooms, x_cor, d_total, t_int, h_wall, mat_wall) # 통로 / 임원실1
create_wall(g_ent, x_ex1, y_rooms, x_ex1, d_total, t_int, h_wall, mat_wall) # 임원실 1/2
create_wall(g_ent, x_ex2, y_rooms, x_ex2, d_total, t_int, h_wall, mat_wall) # 임원실2 / 창고

# ------------------------------------------------------------------------------
# 6. 주요 가구 및 집기 (3D Furniture Blocks)
# ------------------------------------------------------------------------------
def create_desk(ent, x, y, z, w, d, h, mat_top, mat_leg)
  # 상판 (Desk Top)
  pts_top = [
    Geom::Point3d.new(x, y, z + h - 30.mm),
    Geom::Point3d.new(x + w, y, z + h - 30.mm),
    Geom::Point3d.new(x + w, y + d, z + h - 30.mm),
    Geom::Point3d.new(x, y + d, z + h - 30.mm)
  ]
  f_top = ent.add_face(pts_top)
  if f_top
    f_top.material = mat_top
    f_top.back_material = mat_top
    f_top.pushpull(30.mm)
  end
  # 다리 4개
  leg_w = 40.mm
  [[0, 0], [w - leg_w, 0], [0, d - leg_w], [w - leg_w, d - leg_w]].each do |lx, ly|
    pts_leg = [
      Geom::Point3d.new(x + lx, y + ly, z),
      Geom::Point3d.new(x + lx + leg_w, y + ly, z),
      Geom::Point3d.new(x + lx + leg_w, y + ly + leg_w, z),
      Geom::Point3d.new(x + lx, y + ly + leg_w, z)
    ]
    f_leg = ent.add_face(pts_leg)
    f_leg.pushpull(h - 30.mm) if f_leg
  end
end

def create_chair(ent, x, y, z, mat)
  # 의자 방석
  pts_seat = [
    Geom::Point3d.new(x, y, z + 420.mm),
    Geom::Point3d.new(x + 450.mm, y, z + 420.mm),
    Geom::Point3d.new(x + 450.mm, y + 450.mm, z + 420.mm),
    Geom::Point3d.new(x, y + 450.mm, z + 420.mm)
  ]
  f_s = ent.add_face(pts_seat)
  if f_s
    f_s.material = mat
    f_s.pushpull(50.mm)
  end
  # 등받이
  pts_back = [
    Geom::Point3d.new(x, y + 400.mm, z + 470.mm),
    Geom::Point3d.new(x + 450.mm, y + 400.mm, z + 470.mm),
    Geom::Point3d.new(x + 450.mm, y + 450.mm, z + 470.mm),
    Geom::Point3d.new(x, y + 450.mm, z + 470.mm)
  ]
  f_b = ent.add_face(pts_back)
  f_b.pushpull(400.mm) if f_b
end

# (1) 회의실 1 & 2 대형 테이블 (2,000 x 1,000mm)
create_desk(g_ent, x_edu + 827.mm, y_rooms + 1360.mm, 0, 2000.mm, 1000.mm, 740.mm, mat_desk, mat_dark)
create_desk(g_ent, x_m1 + 827.mm, y_rooms + 1360.mm, 0, 2000.mm, 1000.mm, 740.mm, mat_desk, mat_dark)

# (2) 일반근무석 (16석: 1600x800 책상 4x4 모듈)
y_open_start = 1800.mm
[14800.mm, 17200.mm, 19600.mm, 22000.mm].each do |wx|
  # 상단 마주보는 2석
  create_desk(g_ent, wx, y_open_start + 1800.mm, 0, 1600.mm, 800.mm, 720.mm, mat_desk, mat_dark)
  create_desk(g_ent, wx, y_open_start + 2600.mm, 0, 1600.mm, 800.mm, 720.mm, mat_desk, mat_dark)
  # 하단 마주보는 2석
  create_desk(g_ent, wx, y_open_start, 0, 1600.mm, 800.mm, 720.mm, mat_desk, mat_dark)
  create_desk(g_ent, wx, y_open_start + 800.mm, 0, 1600.mm, 800.mm, 720.mm, mat_desk, mat_dark)
end

# (3) 임원실 1 & 2 중역 책상 (1,800 x 900mm) + 사이드장
create_desk(g_ent, x_cor + 1000.mm, y_rooms + 1800.mm, 0, 1800.mm, 900.mm, 750.mm, mat_wood, mat_dark)
create_desk(g_ent, x_ex1 + 1000.mm, y_rooms + 1800.mm, 0, 1800.mm, 900.mm, 750.mm, mat_wood, mat_dark)

# (4) 교육장 36석 강의용 2인 테이블 18개 (1,400 x 500mm)
[1000.mm, 2800.mm, 4600.mm].each do |col_x|
  (0..5).each do |row|
    row_y = 2000.mm + (row * 1100.mm)
    create_desk(g_ent, col_x, row_y, 0, 1400.mm, 500.mm, 720.mm, mat_desk, mat_dark)
    create_chair(g_ent, col_x + 150.mm, row_y - 450.mm, 0, mat_dark)
    create_chair(g_ent, col_x + 800.mm, row_y - 450.mm, 0, mat_dark)
  end
end

# ------------------------------------------------------------------------------
# 7. 공간 라벨 텍스트 (3D 텍스트)
# ------------------------------------------------------------------------------
g_ent.add_3d_text('교육장 (36seat) 53.9m²', TextAlignLeft, 'Pretendard', true, false, 300.mm, 20.mm, 0, true, 0)
g_ent.add_3d_text('회의실 1 (13.6m²)', TextAlignLeft, 'Pretendard', true, false, 250.mm, 20.mm, 0, true, 0)
g_ent.add_3d_text('회의실 2 (13.6m²)', TextAlignLeft, 'Pretendard', true, false, 250.mm, 20.mm, 0, true, 0)
g_ent.add_3d_text('임원실 1 (13.6m²)', TextAlignLeft, 'Pretendard', true, false, 250.mm, 20.mm, 0, true, 0)
g_ent.add_3d_text('임원실 2 (13.6m²)', TextAlignLeft, 'Pretendard', true, false, 250.mm, 20.mm, 0, true, 0)
g_ent.add_3d_text('일반근무석 (16seat) 77.2m²', TextAlignLeft, 'Pretendard', true, false, 300.mm, 20.mm, 0, true, 0)
g_ent.add_3d_text('라운지 & 복도 47.5m²', TextAlignLeft, 'Pretendard', true, false, 300.mm, 20.mm, 0, true, 0)

model.commit_operation
UI.messagebox("SK해운 사무실 (76.8평 / 253.3m2) 3D 모델 생성이 완료되었습니다!")
