#include "submit/store.hpp"

#include <fstream>
#include <sstream>

namespace submit {
namespace {
constexpr const char* kEmptyObject = "{}";
}

Store::Store(std::filesystem::path root) : root_(std::move(root)) {}

std::string Store::settings() const {
  std::ifstream input(root_ / "config.json", std::ios::binary);
  if (!input) return kEmptyObject;
  std::ostringstream data;
  data << input.rdbuf();
  return data.str().empty() ? kEmptyObject : data.str();
}

std::string Store::records() const {
  std::ifstream input(root_ / "records.ndjson", std::ios::binary);
  std::string line;
  std::string result = "[";
  bool first = true;
  while (std::getline(input, line)) {
    if (line.empty()) continue;
    if (!first) result += ',';
    result += line;
    first = false;
  }
  result += ']';
  return result;
}

bool Store::saveSettings(const std::string& body) const {
  std::filesystem::create_directories(root_);
  std::ofstream output(root_ / "config.json", std::ios::binary | std::ios::trunc);
  return output && static_cast<bool>(output << body);
}

bool Store::appendRecord(const std::string& body) const {
  std::filesystem::create_directories(root_);
  std::ofstream output(root_ / "records.ndjson", std::ios::binary | std::ios::app);
  return output && static_cast<bool>(output << body << '\n');
}

bool Store::clearRecords() const {
  std::filesystem::create_directories(root_);
  std::ofstream output(root_ / "records.ndjson", std::ios::binary | std::ios::trunc);
  return static_cast<bool>(output);
}

}  // namespace submit
