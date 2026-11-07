cmake_minimum_required(VERSION 3.20)
project(submit_service VERSION 2.0 LANGUAGES CXX)

add_executable(submit_service
  src/main.cpp
  src/server.cpp
  src/http.cpp
  src/router.cpp
  src/store.cpp
)
target_include_directories(submit_service PRIVATE include)
target_compile_features(submit_service PRIVATE cxx_std_17)
set_target_properties(submit_service PROPERTIES CXX_EXTENSIONS OFF)

if(WIN32)
  target_link_libraries(submit_service PRIVATE ws2_32)
endif()
if(MSVC)
  target_compile_options(submit_service PRIVATE /utf-8 /W4 /permissive-)
else()
  target_compile_options(submit_service PRIVATE -Wall -Wextra -Wpedantic)
endif()
