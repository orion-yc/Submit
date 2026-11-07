#include "submit/http.hpp"

#include <algorithm>
#include <cctype>
#include <sstream>
#ifndef _WIN32
#include <sys/socket.h>
#endif

namespace submit {
namespace {
std::string trim(std::string value) {
  const auto start = value.find_first_not_of(" \t\r\n");
  if (start == std::string::npos) return {};
  const auto end = value.find_last_not_of(" \t\r\n");
  return value.substr(start, end - start + 1);
}

std::string lower(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
    return static_cast<char>(std::tolower(c));
  });
  return value;
}

bool sendAll(SubmitSocket socket, const std::string& data) {
  std::size_t sent = 0;
  while (sent < data.size()) {
    const auto count = send(socket, data.data() + sent, static_cast<int>(data.size() - sent), 0);
    if (count <= 0) return false;
    sent += static_cast<std::size_t>(count);
  }
  return true;
}
}

bool readRequest(SubmitSocket socket, Request& request) {
  std::string raw;
  char buffer[8192];
  while (raw.find("\r\n\r\n") == std::string::npos && raw.size() < 65536) {
    const auto count = recv(socket, buffer, sizeof(buffer), 0);
    if (count <= 0) return false;
    raw.append(buffer, static_cast<std::size_t>(count));
  }
  const auto split = raw.find("\r\n\r\n");
  if (split == std::string::npos) return false;
  std::istringstream lines(raw.substr(0, split));
  std::string line, target, version;
  if (!std::getline(lines, line)) return false;
  std::istringstream requestLine(line);
  requestLine >> request.method >> target >> version;
  if (request.method.empty() || target.empty()) return false;
  request.path = target.substr(0, target.find('?'));
  while (std::getline(lines, line)) {
    const auto colon = line.find(':');
    if (colon != std::string::npos) request.headers[lower(trim(line.substr(0, colon)))] = trim(line.substr(colon + 1));
  }
  std::size_t length = 0;
  const auto lengthHeader = request.headers.find("content-length");
  if (lengthHeader != request.headers.end()) {
    try { length = std::stoull(lengthHeader->second); } catch (...) { return false; }
  }
  if (length > 1024 * 1024) return false;
  request.body = raw.substr(split + 4);
  while (request.body.size() < length) {
    const auto count = recv(socket, buffer, sizeof(buffer), 0);
    if (count <= 0) return false;
    request.body.append(buffer, static_cast<std::size_t>(count));
  }
  request.body.resize(length);
  return true;
}

bool writeResponse(SubmitSocket socket, const Request& request, const Response& response) {
  std::ostringstream output;
  output << "HTTP/1.1 " << response.status << ' ' << response.reason << "\r\n"
         << "Content-Type: " << response.type << "\r\n"
         << "Content-Length: " << response.body.size() << "\r\n"
         << "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
         << "Access-Control-Allow-Headers: Content-Type\r\n"
         << "Connection: close\r\n";
  const auto origin = request.headers.find("origin");
  if (origin != request.headers.end() && origin->second.rfind("chrome-extension://", 0) == 0)
    output << "Access-Control-Allow-Origin: " << origin->second << "\r\n";
  output << "\r\n" << response.body;
  return sendAll(socket, output.str());
}

}  // namespace submit
