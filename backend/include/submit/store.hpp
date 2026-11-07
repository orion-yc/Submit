#pragma once

#include <filesystem>
#include <string>

namespace submit {

class Store {
 public:
  explicit Store(std::filesystem::path root);
  std::string settings() const;
  std::string records() const;
  bool saveSettings(const std::string& body) const;
  bool appendRecord(const std::string& body) const;
  bool clearRecords() const;

 private:
  std::filesystem::path root_;
};

}  // namespace submit
