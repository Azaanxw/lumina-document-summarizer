def test_security_headers_present(client):
    # 422 validation error — middleware fires on all responses
    response = client.post("/ask", json={})

    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "max-age=31536000" in response.headers["strict-transport-security"]
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["content-security-policy"] == "default-src 'none'"
