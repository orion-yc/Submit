#pragma once

#include <map>
#include "submit/store.hpp"
#include <string>
#ifdef _WIN32
#include <winsock2.h>
using SubmitSocket = SOCKET;
#else
using SubmitSocket = int;
#endif

namespace submit {

struct Request {
  std::string method;
  std::string path;
  std::map<std::string, std::string> headers;
  std::string body;
};

struct Response {
  int status = 200;
  std::string reason = "OK";
  std::string type = "application/json; charset=utf-8";
  std::string body;
};

bool readRequest(SubmitSocket socket, Request& request);
bool writeResponse(SubmitSocket socket, const Request& request, const Response& response);
Response dispatch(const Request& request, const Store& store);

}  // namespace submit
