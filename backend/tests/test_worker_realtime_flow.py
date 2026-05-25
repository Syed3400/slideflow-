from types import SimpleNamespace

import worker


class _FakeResponse:
    def __init__(self, json_data=None):
        self._json_data = json_data or {}

    def raise_for_status(self):
        return None

    def json(self):
        return self._json_data


class _FakeRequests:
    def __init__(self):
        self.posts = []
        self.patches = []

    def post(self, url, data=None, headers=None, timeout=None):
        self.posts.append({"url": url, "data": data, "headers": headers, "timeout": timeout})
        return _FakeResponse()

    def patch(self, url, data=None, headers=None, timeout=None):
        self.patches.append({"url": url, "data": data, "headers": headers, "timeout": timeout})
        return _FakeResponse()


def test_parse_presentation_emits_realtime_events_and_success(monkeypatch, tmp_path):
    file_path = tmp_path / "deck.pptx"
    file_path.write_bytes(b"fake-pptx-content")

    fake_requests = _FakeRequests()
    emitted_events = []

    def _fake_pptx_presentation(_file_obj):
        slide_one = SimpleNamespace(shapes=[SimpleNamespace(text="Revenue and growth")])
        slide_two = SimpleNamespace(shapes=[SimpleNamespace(text="Roadmap and launch")])
        return SimpleNamespace(slides=[slide_one, slide_two])

    monkeypatch.setattr(worker, "requests", fake_requests)
    monkeypatch.setattr(worker, "PPTXPresentation", _fake_pptx_presentation)
    monkeypatch.setattr(worker, "generate_ai_summary", lambda text: f"Summary: {text}")
    monkeypatch.setattr(worker, "publish_event", lambda **kwargs: emitted_events.append(kwargs))
    monkeypatch.setattr(worker, "build_internal_request", lambda payload: ("{}", {}))

    result = worker.parse_presentation_task(
        file_path=str(file_path),
        owner_id="user_123",
        file_name="deck.pptx",
        next_api_url="http://localhost:3000",
        presentation_id="pres_123",
    )

    assert result["status"] == "success"
    assert result["presentation_id"] == "pres_123"
    assert result["slides"] == 2

    event_names = [event["event"] for event in emitted_events]
    assert "presentation.processing_started" in event_names
    assert event_names.count("presentation.slide_parsed") == 2
    assert "presentation.progress" in event_names
    assert "presentation.completed" in event_names

    # Slides are persisted through internal ingestion endpoint.
    assert any("/api/internal/slides" in call["url"] for call in fake_requests.posts)


def test_parse_presentation_error_marks_error_and_emits_failed(monkeypatch, tmp_path):
    file_path = tmp_path / "broken.pptx"
    file_path.write_bytes(b"bad")

    emitted_events = []
    updated_statuses = []

    monkeypatch.setattr(worker, "PPTXPresentation", lambda _file_obj: (_ for _ in ()).throw(RuntimeError("parse failed")))
    monkeypatch.setattr(worker, "publish_event", lambda **kwargs: emitted_events.append(kwargs))
    monkeypatch.setattr(
        worker,
        "update_presentation_status",
        lambda _url, _presentation_id, status: updated_statuses.append(status),
    )

    result = worker.parse_presentation_task(
        file_path=str(file_path),
        owner_id="user_123",
        file_name="broken.pptx",
        next_api_url="http://localhost:3000",
        presentation_id="pres_error",
    )

    assert result["status"] == "error"
    assert worker.PresentationStatus.ERROR.value in updated_statuses
    assert any(event["event"] == "presentation.failed" for event in emitted_events)
