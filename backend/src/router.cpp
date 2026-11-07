#include "submit/http.hpp"
#include "submit/store.hpp"

namespace submit {
namespace {
Response json(int status, const char* reason, std::string body) {
  Response response;
  response.status = status;
  response.reason = reason;
  response.body = std::move(body);
  return response;
}

bool objectBody(const std::string& body) {
  const auto first = body.find_first_not_of(" \t\r\n");
  const auto last = body.find_last_not_of(" \t\r\n");
  return first != std::string::npos && body[first] == '{' && body[last] == '}';
}
}

Response dispatch(const Request& request, const Store& store) {
  if (request.method == "OPTIONS") return json(204, "No Content", "");
  if (request.method == "GET" && request.path == "/") {
    Response response;
    response.type = "text/html; charset=utf-8";
    response.body = "<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Submit Service</title><body style=\"font:16px system-ui;max-width:640px;margin:12vh auto;padding:24px;color:#26324a\"><h1>Submit 本地服务正在运行</h1><p>端口：8888</p><p>健康状态：<a href=\"/api/health\">/api/health</a></p></body></html>";
    return response;
  }
  if (request.method == "GET" && request.path == "/api/health")
    return json(200, "OK", "{\"status\":\"ok\",\"service\":\"submit-local\"}");
  if (request.method == "GET" && request.path == "/api/config")
    return json(200, "OK", store.settings());
  if (request.method == "PUT" && request.path == "/api/config") {
    if (!objectBody(request.body)) return json(400, "Bad Request", "{\"error\":\"expected an object\"}");
    return store.saveSettings(request.body) ? json(200, "OK", "{\"saved\":true}")
      : json(500, "Internal Server Error", "{\"error\":\"storage unavailable\"}");
  }
  if (request.method == "GET" && request.path == "/api/records")
    return json(200, "OK", store.records());
  if (request.method == "POST" && request.path == "/api/records") {
    if (!objectBody(request.body)) return json(400, "Bad Request", "{\"error\":\"expected an object\"}");
    return store.appendRecord(request.body) ? json(201, "Created", "{\"saved\":true}")
      : json(500, "Internal Server Error", "{\"error\":\"storage unavailable\"}");
  }
  if (request.method == "DELETE" && request.path == "/api/records")
    return store.clearRecords() ? json(200, "OK", "{\"cleared\":true}")
      : json(500, "Internal Server Error", "{\"error\":\"storage unavailable\"}");
  return json(404, "Not Found", "{\"error\":\"route not found\"}");
}

}  // namespace submit
