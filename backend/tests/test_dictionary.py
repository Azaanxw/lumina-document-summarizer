from unittest.mock import MagicMock, patch


def test_dictionary_endpoint_uses_timeout(client):
    dict_entry = [{
        "word": "test",
        "phonetic": "/tɛst/",
        "meanings": [{"definitions": [{"definition": "a trial", "example": "a test"}], "partOfSpeech": "noun"}],
    }]
    syn_response = [{"word": "trial"}]

    mock_dict_resp = MagicMock(status_code=200)
    mock_dict_resp.json.return_value = dict_entry
    mock_syn_resp = MagicMock(status_code=200)
    mock_syn_resp.json.return_value = syn_response

    captured = {}

    async def fake_gather(*_coros):
        return [mock_dict_resp, mock_syn_resp]

    class FakeClient:
        def __init__(self, **_kwargs):
            captured["timeout"] = _kwargs.get("timeout")

        async def __aenter__(self):
            self.get = MagicMock()
            return self

        async def __aexit__(self, *_args):
            pass

    with patch("main.httpx.AsyncClient", FakeClient), \
         patch("main.asyncio.gather", new=fake_gather):
        response = client.get("/dictionary/test")

    assert response.status_code == 200
    assert captured["timeout"] == 5.0


def test_dictionary_returns_404_for_unknown_word(client):
    mock_dict_resp = MagicMock(status_code=404)
    mock_syn_resp = MagicMock(status_code=200)
    mock_syn_resp.json.return_value = []

    async def fake_gather(*_coros):
        return [mock_dict_resp, mock_syn_resp]

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            self.get = MagicMock()
            return self

        async def __aexit__(self, *_args):
            pass

    with patch("main.httpx.AsyncClient", FakeClient), \
         patch("main.asyncio.gather", new=fake_gather):
        response = client.get("/dictionary/xyznotaword")

    assert response.status_code == 404
