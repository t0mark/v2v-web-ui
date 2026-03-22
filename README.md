# V2V Communication Demo

2026 Embedded SW Contest

차량 내 탑재된 셀룰러 모듈로 수신한 **V2V(Vehicle-to-Vehicle) MQTT 메시지**를 실시간으로 시각화하는 웹 대시보드입니다.

## 화면 구성

| 패널 | 설명 |
|------|------|
| **Camera Feed** | 전방 카메라 피드 (추후 연결) |
| **Road View** | Three.js 기반 3D 주변 차량 시각화 |

### 차량 상태 색상

| 색상 | 의미 |
|------|------|
| 🔵 파랑 | Ego (자차) |
| 🔴 빨강 | Danger — 즉각 대응 필요 |
| 🟡 노랑 | Warning — 주의 필요 |
| ⬜ 회색 | Normal |

## 실행 방법

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

브라우저에서 `http://<차량IP>:8000` 접속.

## 프로젝트 구조

```
v2v-web-ui/
├── main.py              # FastAPI 서버 (WebSocket /ws 엔드포인트)
├── requirements.txt
└── static/
    ├── index.html
    ├── style.css
    ├── app.js           # Three.js 씬 + 차량 시각화
    └── assets/
        ├── SportsCar2.obj
        └── SportsCar2.mtl
```

## MQTT 연동 (추후 구현)

`main.py`의 `/ws` WebSocket 엔드포인트에 MQTT 브릿지를 연결합니다.
클라이언트로 전송할 JSON 포맷:

```json
{
  "vehicle_id": "VEH-01",
  "state": "DANGER",
  "message": "급제동 감지"
}
```

`state` 값: `DANGER` | `WARNING` | `NORMAL`

## 의존성

- Python 3.10+
- FastAPI / Uvicorn
- Three.js r160 (CDN)
