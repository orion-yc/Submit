#include "submit/http.hpp"
#include "submit/server.hpp"
#include "submit/store.hpp"
#include <filesystem>

#include <iostream>
#include <string>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace submit {
namespace {
#ifdef _WIN32
using Socket = SubmitSocket;
constexpr Socket kInvalid = INVALID_SOCKET;
void closeSocket(Socket value) { closesocket(value); }
#else
using Socket = int;
constexpr Socket kInvalid = -1;
void closeSocket(Socket value) { close(value); }
#endif

void setTimeout(Socket socket) {
#ifdef _WIN32
  const DWORD milliseconds = 2000;
  setsockopt(socket, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&milliseconds), sizeof(milliseconds));
#else
  timeval timeout{}; timeout.tv_sec = 2;
  setsockopt(socket, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
#endif
}
}

int runServer(unsigned short port, const std::string& dataDirectory) {
#ifdef _WIN32
  WSADATA winsock{};
  if (WSAStartup(MAKEWORD(2, 2), &winsock) != 0) return 1;
#endif
  const Socket listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (listener == kInvalid) return 1;
  int reuse = 1;
  setsockopt(listener, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&reuse), sizeof(reuse));
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_port = htons(port);
  inet_pton(AF_INET, "127.0.0.1", &address.sin_addr);
  if (bind(listener, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0 || listen(listener, 16) < 0) {
    std::cerr << "无法监听 127.0.0.1:" << port << '\n';
    closeSocket(listener);
#ifdef _WIN32
    WSACleanup();
#endif
    return 1;
  }
  const Store store(std::filesystem::absolute(dataDirectory));
  std::cout << "Submit 本地服务：http://127.0.0.1:" << port << '\n';
  while (true) {
    sockaddr_in peer{};
#ifdef _WIN32
    int peerLength = sizeof(peer);
#else
    socklen_t peerLength = sizeof(peer);
#endif
    const Socket client = accept(listener, reinterpret_cast<sockaddr*>(&peer), &peerLength);
    if (client == kInvalid) continue;
    setTimeout(client);
    Request request;
    if (readRequest(client, request)) writeResponse(client, request, dispatch(request, store));
    closeSocket(client);
  }
}
}
