FROM eclipse-temurin:25-jdk-jammy AS builder
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -q
COPY src/ src/
RUN ./mvnw package -DskipTests -q

FROM eclipse-temurin:25-jre-jammy
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
# glibc otherwise opens one malloc arena per core and never gives the fragmented pages back.
ENV MALLOC_ARENA_MAX=2
# Sized for a small, mostly idle service rather than for the host it happens to run on:
#  - SerialGC: on a 256 MB heap G1's own bookkeeping costs ~50 MB and buys nothing.
#  - Xms + the heap-free ratios: let the heap shrink back after a session instead of sitting at
#    its ceiling for good.
#  - ActiveProcessorCount: stops the JVM sizing thread pools and buffers for every core it sees.
ENTRYPOINT ["java", \
  "-XX:+UseSerialGC", \
  "-Xms64m", "-Xmx256m", \
  "-XX:MinHeapFreeRatio=10", "-XX:MaxHeapFreeRatio=30", \
  "-XX:MaxMetaspaceSize=160m", \
  "-XX:ReservedCodeCacheSize=64m", \
  "-XX:MaxDirectMemorySize=64m", \
  "-XX:ActiveProcessorCount=2", \
  "-Xss512k", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-jar", "app.jar"]
